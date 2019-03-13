import Web3Connection from 'web3'
// tslint:disable-next-line
const Web3 = require('web3')
import BigNumber from 'bignumber.js'
import Tx = require('ethereumjs-tx')
import * as HttpStatus from 'http-status-codes'
import * as nock from 'nock'
import * as request from 'supertest'

import log from '../../src/logging'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import database from '../../src/database'

const ACCOUNTS = APITesting.ACCOUNTS
const PRIVATE_WEB3_PORT = 8545
const TEMP_EXCHANGE_WALLET_ADDRESS = ACCOUNTS[2].address

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
  port: 3000
}

const TOKEN = {
  name: 'MagicCarpetsWorld',
  symbol: 'MCW',
  decimals: 18,
  rate: 100,
  description: 'Magic is in the air.',
  website: 'otherworldlymagicalcarpets.com',
  totalSupply: undefined,
  contractAddress: undefined,
  hidden: false
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('Transactions API Integration', () => {
  let app = null
  let privateChain = null
  let testDbConn = null
  let web3Conn: Web3Connection = null
  let apiDBConn = null
  let totalTransactionsSoFar = 0
  let Config = null
  let estimateTxGasMock = null

  /* this mimics the actions of a listener process which updates  */
  async function markTransactionAsMined(txHash) {

    const tx = await web3Conn.eth.getTransaction(txHash)
    const txReceipt = await web3Conn.eth.getTransactionReceipt(txHash)
    const block = await web3Conn.eth.getBlock(txReceipt.blockNumber)
    const r = await testDbConn.updateMinedStatus(tx, txReceipt, block, [ACCOUNTS[0].address], Config.getChainID())
    log.info(`Updated tx ${txHash} with its mined status from block ${txReceipt.blockNumber}`)
    totalTransactionsSoFar++
  }

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

  it('Gets empty transactions history successfully', async () => {
    const transactionsResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsResponse.status).toBe(HttpStatus.OK)
    expect(transactionsResponse.body).toHaveLength(0)
  })

  it('Builds raw transaction with a high transfer amount', async () => {

    // in the case of high transfer amount we need to use an explicit string so js doesn't reduce it
    // to scientific notation when it calls toString
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: '1000000000000000000000', // > Number.MAX_SAFE_INTEGER
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)
  })

  it('Rejects raw transaction with a fractional transfer amount', async () => {

    // in the case of high transfer amount we need to use an explicit string so js doesn't reduce it
    // to scientific notation when it calls toString
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: '1000000000000000000000.11', // > Number.MAX_SAFE_INTEGER but not integer
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('Executes 1 transaction and the history now has 1 transaction', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)
    const rawTransaction = rawTransactionResponse.body

    expect(rawTransaction.from).toBe(ACCOUNTS[0].address)
    expect(rawTransaction.to).toBe(privateChain.loyaltyTokenContractAddress)

    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    expect(sendTransactionResponse.status).toBe(HttpStatus.OK)

    await markTransactionAsMined(sendTransactionResponse.body.hash)

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
    const transactions = transactionsAfterResponse.body

    expect(transactions).toHaveLength(1)
    const singleTransaction = transactions[0]
    expect(singleTransaction.token.contractAddress).toBe(privateChain.loyaltyTokenContractAddress)
    expect(singleTransaction.token.name).toBe(TOKEN.name)
    expect(singleTransaction.token.symbol).toBe(TOKEN.symbol)
    expect(singleTransaction.token.decimals).toBe(TOKEN.decimals)
    expect(singleTransaction.token.totalSupply).toBe(TOKEN.totalSupply)
    expect(singleTransaction.from.toLowerCase()).toBe(ACCOUNTS[0].address)
    expect(singleTransaction.to.toLowerCase()).toBe(ACCOUNTS[1].address)
    expect(singleTransaction.state).toBe('processed')
    expect(singleTransaction.hash).toBe(sendTransactionResponse.body.hash)
    expect(singleTransaction.txType).toBe('reward')
    expect(singleTransaction.contractFunction).toBe('transfer')
  })

  it ('Filters out migration type of transaction', async () => {

    const fakeTxHash = '0x18e7c2739bab5ea18cb0d9123ba3fc16f9fb3ba039d4a8811089d9f2647d63e6'
    const transactionsHistory = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)
    const historicalTransaction = transactionsHistory.body[0]
    const storeableTransaction = {
      hash: fakeTxHash,
      fromAddress: historicalTransaction.from,
      toAddress: historicalTransaction.to,
      contractAddress: historicalTransaction.contractAddress,
      state: 'pending',
      txType: 'migration'
    }
    await database.addPendingTransaction(storeableTransaction)

    const transactionsResponse = await request(app).get(`/transactions?contractAddress=${privateChain.loyaltyTokenContractAddress}`)
    const txHashes = transactionsResponse.body.map(tx => tx.hash)
    // @ts-ignore
    expect(txHashes).toEqual(expect.not.arrayContaining([fakeTxHash]))

    const transactionsHistoryResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)
    const txHashesFromHistory = transactionsHistoryResponse.body.map(tx => tx.hash)
    // @ts-ignore
    expect(txHashesFromHistory).toEqual(expect.not.arrayContaining([fakeTxHash]))
  })

  it('Builds raw transaction with token symbol', async () => {
    const rawTransactionParamsWithContractAddress = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: '10',
      contractAddress: privateChain.loyaltyTokenContractAddress
    }
    const rawTransactionParamsWithSymbol = JSON.parse(JSON.stringify(rawTransactionParamsWithContractAddress))
    delete rawTransactionParamsWithSymbol.contractAddress
    rawTransactionParamsWithSymbol.symbol = TOKEN.symbol

    const responseFromContractAddress = await request(app).get(`/transactions/raw`)
                                                          .query(rawTransactionParamsWithContractAddress)
    const responseFromSymbol = await request(app).get(`/transactions/raw`)
                                                  .query(rawTransactionParamsWithContractAddress)

    expect(responseFromSymbol.body).toEqual(responseFromContractAddress.body)
  })

  it('Fails to build raw transaction when both token symbol and contractAddress', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: '10',
      contractAddress: privateChain.loyaltyTokenContractAddress,
      symbol: TOKEN.symbol
    }

    const response = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(response.status).toEqual(HttpStatus.BAD_REQUEST)
  })

  it('Rejects raw transaction request because of missing token symbol', async () => {
    const rawTransactionParamsWithSymbol = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: '10',
      symbol: 'LULZ'
    }

    const responseFromSymbol = await request(app).get(`/transactions/raw`).query(rawTransactionParamsWithSymbol)
    expect(responseFromSymbol.status).toEqual(HttpStatus.NOT_FOUND)
  })

  it('Executes 5 transactions successfully with incrementing nonce', async () => {
    const rawTransactionParams = {
        from: ACCOUNTS[1].address,
        to: ACCOUNTS[0].address,
        transferAmount: 1,
        contractAddress: privateChain.loyaltyTokenContractAddress
      }

    const transactionCount = 5

    for (let i = 0; i < transactionCount; i++) {
      const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

      expect(rawTransactionResponse.status).toBe(HttpStatus.OK)
      const rawTransaction = rawTransactionResponse.body

      expect(rawTransaction.from).toBe(ACCOUNTS[1].address)
      expect(rawTransaction.to).toBe(privateChain.loyaltyTokenContractAddress)

      expect(rawTransaction.nonce).toBe(`0x${i}`)

      const privateKey = Buffer.from(ACCOUNTS[1].secretKey, 'hex')
      const transaction = new Tx(rawTransaction)
      transaction.sign(privateKey)
      const serializedTx = transaction.serialize().toString('hex')

      const postTransferParams = {
        data: serializedTx
      }

      const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)
      expect(sendTransactionResponse.status).toBe(HttpStatus.OK)

      await markTransactionAsMined(sendTransactionResponse.body.hash)
    }

    const transactionsHistory = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)
    const historicalTransactions = transactionsHistory.body
    expect(historicalTransactions).toHaveLength(transactionCount + 1)

    let previousBlockNumber = (await web3Conn.eth.getBlock('latest')).number

    for (let i = 0; i < transactionCount; i++) {
      const tx = historicalTransactions[i]
      expect(tx.token.contractAddress).toBe(privateChain.loyaltyTokenContractAddress)
      expect(tx.token.name).toBe(TOKEN.name)
      expect(tx.token.symbol).toBe(TOKEN.symbol)
      expect(tx.token.decimals).toBe(TOKEN.decimals)
      expect(tx.token.totalSupply).toBe(TOKEN.totalSupply)
      expect(tx.from.toLowerCase()).toBe(ACCOUNTS[1].address)
      expect(tx.to.toLowerCase()).toBe(ACCOUNTS[0].address)
      expect(tx.state).toBe('processed')
      expect(tx.txType).toBe('redeem')
      expect(tx.contractFunction).toBe('transfer')

      // check that the transactions are ordered DESC by blockNumber
      expect(tx.blockNumber).toBeLessThanOrEqual(previousBlockNumber)
      previousBlockNumber = tx.blockNumber
    }
  })

  it('Gets transactions by contract address', async () => {
    const transactionsHistory =
      await request(app).get(`/transactions?contractAddress=${privateChain.loyaltyTokenContractAddress}`)
    expect(transactionsHistory.status).toBe(HttpStatus.OK)
    const historicalTransactions = transactionsHistory.body
    expect(historicalTransactions).toHaveLength(6)
  })

  it('Gets transactions by symbol and they match with those by contract address', async () => {
    const transactionsHistoryBySymbol = await request(app).get(`/transactions?symbol=${TOKEN.symbol}`)
    const historicalTransactionsBySymbol = transactionsHistoryBySymbol.body
    expect(transactionsHistoryBySymbol.status).toBe(HttpStatus.OK)
    expect(historicalTransactionsBySymbol).toHaveLength(6)

    const transactionsHistoryByContractAddress =
      await request(app).get(`/transactions?contractAddress=${privateChain.loyaltyTokenContractAddress}`)
    expect(transactionsHistoryBySymbol.body).toEqual(transactionsHistoryByContractAddress.body)
  })

  it('Gets transactions by symbol with wallet filter', async () => {
    const transactionsHistoryBySymbol =
      await request(app).get(`/transactions?symbol=${TOKEN.symbol}&wallet=${ACCOUNTS[0].address}`)
    const historicalTransactionsBySymbol = transactionsHistoryBySymbol.body
    expect(transactionsHistoryBySymbol.status).toBe(HttpStatus.OK)
    expect(historicalTransactionsBySymbol).toHaveLength(6)
  })

  it('Gets transactions by contract address with limit and offset', async () => {
    const offset = 1
    const limit = 2
    const transactionsHistory = await request(app)
      .get(`/transactions?contractAddress=${privateChain.loyaltyTokenContractAddress}&offset=${offset}&limit=${limit}`)
    const historicalTransactions = transactionsHistory.body
    expect(transactionsHistory.status).toBe(HttpStatus.OK)
    expect(historicalTransactions).toHaveLength(2)

    const entireTransactionHistory =
      await request(app).get(`/transactions?contractAddress=${privateChain.loyaltyTokenContractAddress}`)
    expect(historicalTransactions).toEqual(entireTransactionHistory.body.slice(offset, offset + limit))
  })

  it('Returns individual transaction by hash', async () => {
    const transactionsHistory = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)
    const historicalTransactions = transactionsHistory.body
    const someTransaction = historicalTransactions[0]

    const txDataResponse = await request(app).get(`/transactions/${someTransaction.hash.toUpperCase()}`)
    const singleTx = txDataResponse.body

    someTransaction.confirms = 0
    someTransaction.contract = someTransaction.contractAddress
    delete someTransaction.contractAddress
    delete someTransaction.id
    delete someTransaction.tokenId
    delete someTransaction.contractFunction
    delete someTransaction.txType
    delete someTransaction.chainId

    // adjusted for proper comparison
    singleTx.from = singleTx.from.toLowerCase()
    someTransaction.status = true
    expect(singleTx).toEqual(someTransaction)
  })

  it('Pushes 1 extra transaction which before mining confirmation is NOT FOUND', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 1,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    const rawTransaction = rawTransactionResponse.body
    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    const pendingTxResponse = await request(app).get(`/transactions/${sendTransactionResponse.body.hash}`)
    expect(pendingTxResponse.status).toBe(HttpStatus.NOT_FOUND)

    await markTransactionAsMined(sendTransactionResponse.body.hash)

    const processedTxResponse = await request(app).get(`/transactions/${sendTransactionResponse.body.hash}`)
    expect(processedTxResponse.status).toBe(HttpStatus.OK)

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)
    expect(transactionsAfterResponse.body.length).toBe(totalTransactionsSoFar)
  })

  it('Returns transaction history using defined limit and offset', async () => {

    const limitOffsetParams = {
      limit: 3,
      offset: 1
    }

    const transactionHistory =
      await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    const historicalTransactions = transactionHistory.body
    expect(historicalTransactions).toHaveLength(limitOffsetParams.limit)
  })

  it('Fails to return transaction history using invalid limit and offset', async () => {

    const limitOffsetParams = {
      limit: 'waza',
      offset: 0
    }

    const transactionsAfterResponse =
      await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    expect(transactionsAfterResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(transactionsAfterResponse.body.message).toContain('limit')
  })

  it('Returns transaction history using default limit and offset', async () => {
    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
    expect(transactionsAfterResponse.body).toHaveLength(totalTransactionsSoFar)
  })

  it('Returns transaction history using max value for limit when exceeded', async () => {
    const limitOffsetParams = {
      limit: 210,
      offset: 0
    }

    const transactionsAfterResponse =
      await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
  })

  it('Fails to return transaction history when offset is negative', async () => {

    const limitOffsetParams = {
      limit: 50,
      offset: -1
    }

    const transactionsAfterResponse =
      await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    expect(transactionsAfterResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(transactionsAfterResponse.body.message).toContain('offset')
  })

  it('Rejects raw transaction request with missing contractAddress', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[1].address,
      to: ACCOUNTS[0].address,
      transferAmount: 1
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(rawTransactionResponse.body.message).toContain('contractAddress')
  })

  it('Rejects raw transaction request with missing to and from fields', async () => {
    const rawTransactionParams = {
      transferAmount: 1,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(rawTransactionResponse.body.message).toContain('from')
  })

  it('Rejects raw transaction request with extra unwanted fields', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: privateChain.loyaltyTokenContractAddress,
      unwanted: `you don't want this`,
      otherUnwanted: `you don't want this either`
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(rawTransactionResponse.body.message).toContain('unwanted')
    expect(rawTransactionResponse.body.message).toContain('otherUnwanted')
  })

  it('Rejects 1 raw transaction request with bad contract address', async () => {

    const badContractAddress = privateChain.loyaltyTokenContractAddress
      .substring(0, privateChain.loyaltyTokenContractAddress.length - 2) + '11'
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: badContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(rawTransactionResponse.body.message.includes(`"${badContractAddress}"`)).toBeTruthy()
  })

  it('Rejects 1 raw transaction request with bad from address', async () => {

    // add illegal characters 'xx' at the end
    const badFromAddress = ACCOUNTS[0].address.substring(0, ACCOUNTS[0].address.length - 2) + 'xx'
    const rawTransactionParams = {
      from: badFromAddress,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
    expect(rawTransactionResponse.body.message.includes(`"${badFromAddress.toLowerCase()}"`)).toBeTruthy()
  })

  it('Rejects 1 transfer signed with the wrong key', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 1,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)

    const rawTransaction = rawTransactionResponse.body

    const privateKey = Buffer.from(ACCOUNTS[1].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    expect(sendTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('Rejects 1 transfer with the wrong nonce', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)

    const rawTransaction = rawTransactionResponse.body

    rawTransaction.nonce = rawTransaction.nonce - 1

    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    expect(sendTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('Rejects 1 transfer with the wrong "to" address', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 1,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)

    const rawTransaction = rawTransactionResponse.body

    rawTransaction.to = rawTransaction.to.substring(0, rawTransaction.to.length - 2) + '11'

    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    expect(sendTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  async function sendTransaction(rawTransactionParams) {
    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)
    const rawTransaction = rawTransactionResponse.body

    expect(rawTransaction.from).toBe(rawTransactionParams.from)
    expect(rawTransaction.to).toBe(privateChain.loyaltyTokenContractAddress)

    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)
    return sendTransactionResponse
  }

  it('Successfully processes exchange transaction', async () => {
    const gasPrice = '0'
    const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
    const qbxToETHExchangeRate = new BigNumber('0.000000001')
    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPrice.toString(),
        standard : gasPrice.toString(),
        fast: gasPrice.toString(),
        fastest: '20'
      })

    const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'
    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(1)
      .reply(200, {
        data: {
          result: {
            bids: [{
              limitPrice: qbxToETHExchangeRate.toFixed(),
              amount: '10000'
            }]
          }
        }
      })

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: TEMP_EXCHANGE_WALLET_ADDRESS,
      transferAmount: '4000',
      contractAddress: privateChain.loyaltyTokenContractAddress
    }
    estimateTxGasMock.mockImplementation(() => {
      return {
        conservativeGasEstimate: new BigNumber('1'),
        generousGasEstimate: new BigNumber('2')
      }
    })

    const sendTransactionResponse = await sendTransaction(rawTransactionParams)
    expect(sendTransactionResponse.status).toBe(HttpStatus.OK)

    await markTransactionAsMined(sendTransactionResponse.body.hash)

    expect(gasPriceScope.isDone()).toBeTruthy()
    expect(coinsuperScope.isDone()).toBeTruthy()
  })

  it('Rejects exchange transaction with amount too low', async () => {
    const gasPrice = '5'
    const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
    const qbxToETHExchangeRate = new BigNumber('0.000000001')
    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPrice.toString(),
        standard : gasPrice.toString(),
        fast: gasPrice.toString(),
        fastest: '20'
      })

    const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'
    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(1)
      .reply(200, {
        data: {
          result: {
            bids: [{
              limitPrice: qbxToETHExchangeRate.toFixed(),
              amount: '10000'
            }]
          }
        }
      })

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: TEMP_EXCHANGE_WALLET_ADDRESS,
      transferAmount: '4000',
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    estimateTxGasMock.mockImplementation(() => {
      return {
        conservativeGasEstimate: new BigNumber('1'),
        generousGasEstimate: new BigNumber('2')
      }
    })
    const sendTransactionResponse = await sendTransaction(rawTransactionParams)
    expect(sendTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)

    expect(gasPriceScope.isDone()).toBeTruthy()
    expect(coinsuperScope.isDone()).toBeTruthy()
  })

  it('Rejects exchange transaction because of etherchain API failure', async () => {
    const qbxToETHExchangeRate = new BigNumber('0.000000001')
    const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(500, {
        message: 'etherchain - internal failure.'
      })

    const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'
    nock(coinsuperOrderBookURL)
      .post('')
      .times(1)
      .reply(200, {
        data: {
          result: {
            bids: [{
              limitPrice: qbxToETHExchangeRate.toFixed(),
              amount: '10000'
            }]
          }
        }
      })

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: TEMP_EXCHANGE_WALLET_ADDRESS,
      transferAmount: '4000',
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    estimateTxGasMock.mockImplementation(() => new BigNumber('1'))
    const sendTransactionResponse = await sendTransaction(rawTransactionParams)
    expect(sendTransactionResponse.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(gasPriceScope.isDone()).toBeTruthy()
  })

  it('Rejects exchange transaction because of coinsuper API failure', async () => {
    const gasPrice = '5'
    const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
    nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPrice.toString(),
        standard : gasPrice.toString(),
        fast: gasPrice.toString(),
        fastest: '20'
      })

    const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'
    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(1)
      .reply(500, {
        message: 'coinsuper - internal failure.'
      })

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: TEMP_EXCHANGE_WALLET_ADDRESS,
      transferAmount: '4000',
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    estimateTxGasMock.mockImplementation(() => new BigNumber('1'))
    const sendTransactionResponse = await sendTransaction(rawTransactionParams)
    expect(sendTransactionResponse.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(coinsuperScope.isDone()).toBeTruthy()
  })

  it('Rejects 1 transfer which sends funds to itself', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[0].address,
      transferAmount: 10,
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)
    expect(rawTransactionResponse.status).toBe(HttpStatus.OK)

    const rawTransaction = rawTransactionResponse.body
    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)
    expect(sendTransactionResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('Successfully gets qbx exchange values', async () => {
    const gasPrice = '1'
    const GASPRICE_API_HOST = 'https://www.etherchain.org/api/gasPriceOracle'
    const qbxToETHExchangeRate = new BigNumber('0.000000001')
    const gasPriceScope = nock(GASPRICE_API_HOST)
      .get('')
      .times(1)
      .reply(200, {
        safeLow: gasPrice.toString(),
        standard : gasPrice.toString(),
        fast: gasPrice.toString(),
        fastest: '20'
      })

    const coinsuperOrderBookURL = 'https://api.coinsuper.com/api/v1/market/orderBook'
    const coinsuperScope = nock(coinsuperOrderBookURL)
      .post('')
      .times(1)
      .reply(200, {
        data: {
          result: {
            bids: [{
              limitPrice: qbxToETHExchangeRate.toFixed(),
              amount: '10000'
            }]
          }
        }
      })

    estimateTxGasMock.mockImplementation(() => {
      return {
        conservativeGasEstimate: new BigNumber('1'),
        generousGasEstimate: new BigNumber('2')
      }
    })

    const transferAmount = '400000000000000000000'

    const sendTransactionResponse =
      await request(app).get(`/transactions/qbxExchangeValues?symbol=${TOKEN.symbol}&transferAmount=${transferAmount}`)
    expect(sendTransactionResponse.status).toBe(HttpStatus.OK)
    expect(sendTransactionResponse.body.qbxFeePercentage).toBe('1')
    expect(sendTransactionResponse.body.exchangeWalletAddress).toBe(TEMP_EXCHANGE_WALLET_ADDRESS)
    expect(sendTransactionResponse.body.costOfGasInQBX).toBe('1000000000000000000')
    expect(sendTransactionResponse.body.qbxFeeAmount).toBe('40000000000000000')
    expect(sendTransactionResponse.body.qbxValueReceived).toBe('2960000000000000000')
    expect(sendTransactionResponse.body.loyaltyTokenToQBXRate).toBe(TOKEN.rate)

    expect(gasPriceScope.isDone()).toBeTruthy()
    expect(coinsuperScope.isDone()).toBeTruthy()
  })

  it('Successfully gets address by hash', async () => {

    const txCount = 7

    const expectedAddress = {
      transactionCount: txCount,
      balances: {
        private: {
        },
        public: {
          QBX: {
            balance: '0',
            contractAddress: Config.getQBXAddress()
          }
        }
      }
    }
    expectedAddress.balances.private[TOKEN.symbol] = {
      balance: (new BigNumber(ACCOUNTS[0].balance).minus(new BigNumber(4006))).toFixed(), // assuming all value 1
      contractAddress: privateChain.loyaltyTokenContractAddress
    }

    const r = await request(app).get(`/addresses/${ACCOUNTS[0].address}?public=true`)
    expect(r.status).toBe(HttpStatus.OK)
    expect(r.body).toEqual(expectedAddress)
  })
})
