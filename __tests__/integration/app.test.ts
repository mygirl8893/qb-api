import * as aesjs from 'aes-js'
import BigNumber from 'bignumber.js'
import * as HttpStatus from 'http-status-codes'
import * as _ from 'lodash'
import * as nock from 'nock'
import * as qbDB from 'qb-db-migrations'
import * as request from 'supertest'

import log from '../../src/logging'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'

const ACCOUNTS = APITesting.ACCOUNTS
const PRIVATE_WEB3_PORT = 8545
const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  coinsuperAPIKeys: {
    accessKey: '',
    secretKey: ''
  },
  port: 3000,
  infuraApiKey: 'A secret API key',
  infuraEncryptionKey: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]',
  etherscanURL: 'https://api-ropsten.etherscan.io',
  etherscanAPIKey: 'etherscanApiKey'
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

const publicHistoryAllowedFields = ['blockNumber', 'timestamp', 'hash', 'nonce', 'blockHash',
  'from', 'to', 'value', 'status', 'contractAddress', 'token.symbol']

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('App endpoint', () => {
  let app = null
  let privateChain = null
  let testDbConn = null
  let apiDbConn = null

  const fakeEthHistoryResponse = Array(1000).fill(null).map((val, index) => ({
    blockNumber: (6389500 + index).toString(10),
    timeStamp: (1537775300 + index).toString(10),
    hash: '0x45a5213c27bcbd2c51cdc3ef4840ee27e0ef98b29689fa6bb48fe1e5abbc8814',
    nonce: '9',
    blockHash: '0x40795f9968485b6c15558215cba3a7484507ef59964325778f52da191b1eea33',
    transactionIndex: '22',
    from: '0x9636de4952a215b1e69c8a777bee9bdc231c22c8',
    to: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae',
    value: (10000000 * Math.round(Math.random())).toString(10),
    gas: '29229',
    gasPrice: '8000000000',
    isError: '0',
    txreceipt_status: '1',
    input: '0x',
    contractAddress: '',
    cumulativeGasUsed: '7874881',
    gasUsed: '22484',
    confirmations: '1412055'
  })).reverse()

  const fakeQbxHistory = Array(1000).fill(null).map((val, index) => ({
    blockNumber: 6389500 + index,
    timestamp: 1537775300 + index,
    // `1000 + index` to fill up last 4 places with random
    hash: '0x45a5213c27bcbd2c51cdc3ef4840ee27e0ef98b29689fa6bb48fe1e5abbc' + (1000 + index),
    nonce: 9,
    blockHash: '0x40795f9968485b6c15558215cba3a7484507ef59964325778f52da191b1eea33',
    transactionIndex: 22,
    from: '0x9636de4952a215b1e69c8a777bee9bdc231c22c8',
    to: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae',
    value: (10 * Math.round(Math.random() + 1)).toString(),
    status: '1',
    input: '0x',
    confirms: 123,
    contractAddress: '0xc736de4952a215b1e69c8a777bee9bdc231y68x9',
    contractFunction: 'transfer'
  })).reverse() // reverse to make timestamp in desc order

  const formattedEthHistory = fakeEthHistoryResponse
    .filter((tx) => parseInt(tx.value, 10) > 0)
    .map((tx) => {
      const temp = { ...tx }  // so that main object does not get edited
      // // tslint:disable-next-line:no-string-literal
      // temp['timestamp'] = temp.timeStamp
      // delete temp.timeStamp
      // return temp

      // @ts-ignore - Type 'number' is not assignable to type 'string'
      temp.blockNumber = parseInt(temp.blockNumber, 10)
      // @ts-ignore - Type 'number' is not assignable to type 'string'
      temp.nonce = parseInt(temp.nonce, 10)

      // tslint:disable-next-line:no-string-literal
      temp['token'] = { symbol: 'ETH' }
      // tslint:disable-next-line:no-string-literal
      temp['timestamp'] = parseInt(temp.timeStamp, 10)
      // tslint:disable-next-line:no-string-literal
      temp['status'] = temp.txreceipt_status

      return _.pick(temp, publicHistoryAllowedFields)
    })

  beforeAll(async () => {

    try {

      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()

      TOKEN.totalSupply = privateChain.initialLoyaltyTokenAmount
      TOKEN.contractAddress = privateChain.loyaltyTokenContractAddress

      testDbConn = new APITesting.TestDatabaseConn()
      await testDbConn.setup(TOKEN, ACCOUNTS[2].address, ACCOUNTS[0].address)

      app = require('../../app').default
      const Config = require('../../src/config').default

      apiDbConn = require('../../src/database').default

      await APITesting.waitForAppToBeReady(Config)

      const allowedFields = ['blockNumber', 'timestamp', 'hash', 'nonce', 'blockHash', 'transactionIndex',
        'fromAddress', 'toAddress', 'value', 'status', 'input', 'confirms', 'contractAddress', 'contractFunction']

      const dbTXs = fakeQbxHistory.map((tx) => {
        const histItem = { ...tx }
        // tslint:disable-next-line:no-string-literal
        histItem['toAddress'] = histItem.to
        // tslint:disable-next-line:no-string-literal
        histItem['fromAddress'] = histItem.from

        return _.pick(histItem, allowedFields)
      })

      await qbDB.models.mainnetTransaction.bulkCreate(dbTXs)

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
      await apiDbConn.close()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e.stack}`)
      throw e
    }
  })

  let encryptedHexSecret = ''
  it('Returns 200 and hex string for infura', async () => {

    const response = await request(app).get('/app/infura')

    encryptedHexSecret = response.body.key

    expect(response.status).toEqual(HttpStatus.OK)
  })

  it('Returns correct infura API key - decrypt and check', async () => {

    const decryptionKey = JSON.parse(INTEGRATION_TEST_CONFIGURATION.infuraEncryptionKey)

    // decrypt
    const aesCtr = new aesjs.ModeOfOperation.ctr(decryptionKey, new aesjs.Counter(5))
    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHexSecret)
    const decryptedBytes = aesCtr.decrypt(encryptedBytes)
    const decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes)

    expect(decryptedText).toEqual(INTEGRATION_TEST_CONFIGURATION.infuraApiKey)
  })

  it('Returns 400 and error if missing wallet query param', async () => {

    const errorResponse = {
      // tslint:disable-next-line:max-line-length
      message: 'ValidationError: child \"query\" fails because [child \"wallet\" fails because [\"wallet\" is required]]'
    }

    const response = await request(app).get(
      '/app/mainnet/transactions')

    expect(response.status).toEqual(HttpStatus.BAD_REQUEST)
    expect(errorResponse).toEqual(response.body)
  })

  it('Returns 200 and transaction history for ETH', async (done) => {

    const ethHistoryScope = nock(INTEGRATION_TEST_CONFIGURATION.etherscanURL)
      .get('/api?module=account&action=txlist&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae' +
        `&apikey=${INTEGRATION_TEST_CONFIGURATION.etherscanAPIKey}&sort=desc`)
      .times(1)
      .reply(200, {
        result: fakeEthHistoryResponse
      })

    const response = await request(app).get(
      '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&symbol=ETH')

    expect(response.status).toEqual(HttpStatus.OK)
    expect(response.body.length).toEqual(100)
    expect(ethHistoryScope.isDone()).toBeTruthy()
    // only TXs where crypto was transferred
    expect(response.body).toEqual(formattedEthHistory.slice(0, 100))
    done()
  })

  it('Returns 200 and transaction history for ETH with limit 3', async (done) => {

    const ethHistoryScope = nock(INTEGRATION_TEST_CONFIGURATION.etherscanURL)
      .get('/api?module=account&action=txlist&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae' +
        `&apikey=${INTEGRATION_TEST_CONFIGURATION.etherscanAPIKey}&sort=desc`)
      .times(1)
      .reply(200, {
        result: fakeEthHistoryResponse
      })

    const response = await request(app).get(
      '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&symbol=ETH&limit=3')

    expect(response.status).toEqual(HttpStatus.OK)
    expect(response.body.length).toEqual(3)
    expect(ethHistoryScope.isDone()).toBeTruthy()
    // only TXs where crypto was transferred
    expect(response.body).toEqual(formattedEthHistory.slice(0, 3))
    done()
  })

  // it('Returns 200 and transaction history for QBX', async (done) => {

  //   const response = await request(app).get(
  //     '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&symbol=QBX')

  //   expect(response.status).toEqual(HttpStatus.OK)
  //   expect(response.body).toEqual(fakeQbxHistory.slice(0, 100))
  //   done()
  // })

  // it('Returns 200 and transaction history for QBX with limit 10', async (done) => {

  //   const response = await request(app).get(
  //     '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&symbol=QBX&limit=10')

  //   expect(response.status).toEqual(HttpStatus.OK)
  //   expect(response.body).toEqual(fakeQbxHistory.slice(0, 10))
  //   done()
  // })

  // it('Returns 200 and mixed transaction history in correct order for QBX and ETH', async (done) => {

  //   const ethHistoryScope = nock(INTEGRATION_TEST_CONFIGURATION.etherscanURL)
  //     .get('/api?module=account&action=txlist&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae' +
  //       `&apikey=${INTEGRATION_TEST_CONFIGURATION.etherscanAPIKey}&sort=desc`)
  //     .times(1)
  //     .reply(200, {
  //       result: fakeEthHistoryResponse
  //     })

  //   // have to slice since the fake generated history has consecutive timestamps
  //   // the contoller will take a default limit of 100 from each and then merge them
  //   const mixedHistory = [...formattedEthHistory.slice(0, 100), ...fakeQbxHistory.slice(0, 100)]
  //     .sort((history1, history2) => {
  //       // tslint:disable-next-line:no-string-literal
  //       const a = new BigNumber(history1['timestamp'])
  //       // tslint:disable-next-line:no-string-literal
  //       const b = new BigNumber(history2['timestamp'])
  //       return a.minus(b).toNumber()
  //     })

  //   const response = await request(app).get(
  //     '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae')

  //   expect(response.status).toEqual(HttpStatus.OK)
  //   expect(ethHistoryScope.isDone()).toBeTruthy()
  //   expect(response.body).toEqual(mixedHistory.slice(0, 100))
  //   done()
  // })

  it('Returns 200 and mixed transaction history in correct order for QBX and ETH with limit 10', async (done) => {

    const ethHistoryScope = nock(INTEGRATION_TEST_CONFIGURATION.etherscanURL)
      .get('/api?module=account&action=txlist&address=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae' +
        `&apikey=${INTEGRATION_TEST_CONFIGURATION.etherscanAPIKey}&sort=desc`)
      .times(1)
      .reply(200, {
        result: fakeEthHistoryResponse
      })

    // take 100 of each and combine and return `limit` number of entries
    const mixedHistory = [...formattedEthHistory.slice(0, 100), ...fakeQbxHistory.slice(0, 100)]
      .sort((history1, history2) => {
        // tslint:disable-next-line:no-string-literal
        const a = new BigNumber(history1['timestamp'])
        // tslint:disable-next-line:no-string-literal
        const b = new BigNumber(history2['timestamp'])
        return a.minus(b).toNumber()
      })

    const response = await request(app).get(
      '/app/mainnet/transactions?wallet=0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae&limit=10')

    expect(response.status).toEqual(HttpStatus.OK)
    expect(ethHistoryScope.isDone()).toBeTruthy()
    expect(response.body).toEqual(mixedHistory.slice(0, 10))
    done()
  })
})
