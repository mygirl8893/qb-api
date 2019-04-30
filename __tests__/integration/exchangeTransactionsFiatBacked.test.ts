import Web3Connection from 'web3'
// tslint:disable-next-line
const Web3 = require('web3')
import BigNumber from 'bignumber.js'
import Tx = require('ethereumjs-tx')
import * as HttpStatus from 'http-status-codes'
import * as nock from 'nock'
import * as request from 'supertest'
import database from '../../src/database'
import utils from '../../src/lib/utils'
import log from '../../src/logging'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'

const { sendTransaction } = APITesting

const ACCOUNTS = APITesting.ACCOUNTS
const PRIVATE_WEB3_PORT = 8545
const TEMP_EXCHANGE_WALLET_ADDRESS = ACCOUNTS[2].address
const PRE_MIGRATION_CHAIN_ID = '1234567'

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  tempExchangeWalletAddress: TEMP_EXCHANGE_WALLET_ADDRESS,
  coinsuperAPIKeys: {
    accessKey: '',
    secretKey: ''
  },
  port: 3000,
  oldChainId: PRE_MIGRATION_CHAIN_ID,
  infuraApiKey: 'A secret API key',
  infuraEncryptionKey: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]'
}

let TOKEN = null

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

let app = null
let privateChain: TestPrivateChain = null
let testDbConn = null
let web3Conn: Web3Connection = null
let apiDBConn = null
let totalTransactionsSoFar = 0
let Config = null
let estimateTxGasMock = null

beforeAll(async () => {
  try {
    privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

    await privateChain.setup()

    TOKEN.totalSupply = privateChain.initialLoyaltyTokenAmount
    TOKEN.contractAddress = privateChain.loyaltyTokenContractAddress

    testDbConn = new APITesting.TestDatabaseConn()

    await testDbConn.setup(TOKEN, TEMP_EXCHANGE_WALLET_ADDRESS, ACCOUNTS[0].address)

    web3Conn = new Web3(`http://localhost:${PRIVATE_WEB3_PORT}`)
    await web3Conn.eth.net.isListening()
    log.info('Web3 connection established.')

    app = require('../../app').default
    Config = require('../../src/config').default

    apiDBConn = require('../../src/database').default

    const publicBlockchain = require('../../src/lib/publicBlockchain')
    estimateTxGasMock = jest.spyOn(publicBlockchain.default, 'estimateTxGas')

    await APITesting.waitForAppToBeReady(Config)
  } catch (e) {
    log.error(`Failed setting up the test context ${e.stack}`)
    throw e
  }
})

beforeEach(async () => {
  nock.cleanAll()
})

afterAll(async () => {
  try {
    await privateChain.tearDown()
    await testDbConn.close()
    await apiDBConn.close()
  } catch (e) {
    log.error(`Failed to tear down the test context ${e.stack}`)
    throw e
  }
})

/* this mimics the actions of a listener process which updates  */
async function markTransactionAsMined(txHash) {

  const tx = await web3Conn.eth.getTransaction(txHash)
  const txReceipt = await web3Conn.eth.getTransactionReceipt(txHash)
  const block = await web3Conn.eth.getBlock(txReceipt.blockNumber)
  const r = await testDbConn.updateMinedStatus(tx, txReceipt, block, [ACCOUNTS[0].address], Config.getChainID())
  log.info(`Updated tx ${txHash} with its mined status from block ${txReceipt.blockNumber}`)
  totalTransactionsSoFar++
}

describe('Exchange Transactions API for fiat-backed tokens', () => {
  TOKEN = {
    name: 'MagicCarpetsWorld',
    symbol: 'MCW',
    decimals: 18,
    rate: null,
    description: 'Magic is in the air.',
    website: 'otherworldlymagicalcarpets.com',
    totalSupply: undefined,
    contractAddress: undefined,
    hidden: false,
    fiatBacked: true,
    fiatRate: 1
  }

  const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
  const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'

  const estimatedGasAmount = new BigNumber('38157')
  const conservativeGasEstimate = estimatedGasAmount
  const generousGasEstimate = estimatedGasAmount.multipliedBy(2)

  const gasPriceInGwei = new BigNumber('3.0')
  const gasPriceInWei = gasPriceInGwei.multipliedBy(new BigNumber(Math.pow(10, 9)))

  const QBX_ETH_PAIR = 'QBX/ETH'
  const ETH_USD_PAIR = 'ETH/USD'

  const FIAT_EXCHANGE_RATES: Record<string, BigNumber>  = {}
  FIAT_EXCHANGE_RATES[QBX_ETH_PAIR] =  new BigNumber('0.00000416')
  FIAT_EXCHANGE_RATES[ETH_USD_PAIR] =  new BigNumber('170')

  it('Successfully processes exchange transaction', async () => {
    const txRawAmountInLoyaltyToken = new BigNumber('1000000000000000000')

    const tokenDecimals = 18
    const rate = new BigNumber('10').pow(tokenDecimals)

    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPriceInGwei.toString(),
        standard : gasPriceInGwei.toString(),
        fast: gasPriceInGwei.toString(),
        fastest: '20'
      })

    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(2)
      .reply((uri, requestBody) => {
        requestBody = JSON.parse(requestBody)
        const limitPrice = FIAT_EXCHANGE_RATES[requestBody.data.symbol]
        if (!limitPrice) {
          return [500, {
            message: `No order book available for symbol ${requestBody.symbol}`
          }]
        }
        return [200, {
          data: {
            result: {
              bids: [{
                limitPrice: limitPrice.toFixed(),
                amount: '10000'
              }]
            }
          }
        }]
      })

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: TEMP_EXCHANGE_WALLET_ADDRESS,
      transferAmount: txRawAmountInLoyaltyToken.toFixed(),
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    estimateTxGasMock.mockImplementation(() => {
      return {
        conservativeGasEstimate,
        generousGasEstimate
      }
    })

    const sendTransactionResponse = await sendTransaction(rawTransactionParams, privateChain, app)
    expect(sendTransactionResponse.status).toBe(HttpStatus.OK)

    await markTransactionAsMined(sendTransactionResponse.body.hash)

    expect(gasPriceScope.isDone()).toBeTruthy()
    expect(coinsuperScope.isDone()).toBeTruthy()
  })

  it('Successfully gets qbx exchange values', async () => {
    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPriceInGwei.toString(),
        standard : gasPriceInGwei.toString(),
        fast: gasPriceInGwei.toString(),
        fastest: '20'
      })
    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(2)
      .reply((uri, requestBody) => {
        requestBody = JSON.parse(requestBody)
        const limitPrice = FIAT_EXCHANGE_RATES[requestBody.data.symbol]
        if (!limitPrice) {
          return [500, {
            message: `No order book available for symbol ${requestBody.symbol}`
          }]
        }
        return [200, {
          data: {
            result: {
              bids: [{
                limitPrice: limitPrice.toFixed(),
                amount: '10000'
              }]
            }
          }
        }]
      })

    estimateTxGasMock.mockImplementation(() => {
      return {
        conservativeGasEstimate,
        generousGasEstimate
      }
    })


    const transferAmount = '1000000000000000000'

    const costOfGasInQBX = (new BigNumber('114471000000000')).dividedBy(FIAT_EXCHANGE_RATES[QBX_ETH_PAIR])

    const sendTransactionResponse =
      await request(app).get(`/transactions/qbxExchangeValues?symbol=${TOKEN.symbol}&transferAmount=${transferAmount}`)
    expect(sendTransactionResponse.status).toBe(HttpStatus.OK)
    expect(sendTransactionResponse.body.qbxFeePercentage).toBe('1')
    expect(sendTransactionResponse.body.exchangeWalletAddress).toBe(TEMP_EXCHANGE_WALLET_ADDRESS)
    expect(sendTransactionResponse.body.qbxFeeAmount).toBe('14140271493212669683')
    expect(sendTransactionResponse.body.qbxValueReceived).toBe('1372369810520361990949')
    expect(sendTransactionResponse.body.costOfGasInQBX).toBe(costOfGasInQBX.toFixed())
    expect(sendTransactionResponse.body.loyaltyTokenToQBXRate).toBeUndefined()

    expect(gasPriceScope.isDone()).toBeTruthy()
    expect(coinsuperScope.isDone()).toBeTruthy()
  })
})
