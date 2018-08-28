import Web3Connection from 'web3'
const Web3 = require('web3')
import * as request from 'supertest'
import * as HttpStatus from 'http-status-codes'
import Tx = require('ethereumjs-tx')

import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import log from '../../src/logging'
import DBConfig from '../../src/database/config'

const PRIVATE_WEB3_PORT = 8545

const START_BALANCE = 10 ** 20

const ACCOUNTS = [{
  address: '0x87265a62c60247f862b9149423061b36b460f4bb',
  secretKey: 'e8280389ca1303a2712a874707fdd5d8ae0437fab9918f845d26fd9919af5a92',
  balance: START_BALANCE
}, {
  address: '0xb99c958777f024bc4ce992b2a0efb2f1f50a4dcf',
  secretKey: 'ed095a912033d26dc444d2675b33414f0561af170d58c33f394db8812c87a764',
  balance: START_BALANCE
}]

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  tokenDB: 'ADDRESS_PLACEHOLDER_UNTIL_CONTRACT_DEPLOYMENT',
  port: 3000
}

const TOKEN = {
  name: "MagicCarpetsWorld",
  symbol: "MCW",
  decimals: 18,
  rate: 100
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('Transactions API Integration', () => {
  let app = null
  let privateChain = null
  let testDbConn = null
  let web3Conn: Web3Connection = null
  let apiDBConn = null

  /* this mimics the actions of a listener process which updates  */
  async function markTransactionAsMined(txHash) {
    const txReceipt = await web3Conn.eth.getTransactionReceipt(txHash)
    const r = await testDbConn.query(`UPDATE transactions SET blockNumber = ${txReceipt.blockNumber}, state = 'processed' WHERE hash = '${txHash}'`)
    log.info(`Updated tx ${txHash} with its mined status from block ${txReceipt.blockNumber}`)
  }

  beforeAll(async () => {
    try {
      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()
      INTEGRATION_TEST_CONFIGURATION.tokenDB = privateChain.tokenDBContractAddress

      TOKEN['totalSupply'] = privateChain.initialLoyaltyTokenAmount
      TOKEN['contractAddress'] = privateChain.loyaltyTokenContractAddress

      // reuse the development config
      DBConfig['test'] = DBConfig.development
      testDbConn = await APITesting.setupDatabase(DBConfig['test'], TOKEN)

      web3Conn = new Web3(`http://localhost:${PRIVATE_WEB3_PORT}`)
      await web3Conn.eth.net.isListening()
      log.info('Web3 connection established.')


      app = require('../../app').default
      const Config = require('../../src/config').default

      apiDBConn = require('../../src/database').default

      await APITesting.waitForAppToBeReady(Config)
    } catch (e) {
      log.error(`Failed setting up the test context ${e}`)
      throw e
    }
  })

  afterAll(async () => {
    try {
      await privateChain.tearDown()
      await testDbConn.end()
      await apiDBConn.close()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e}`)
      throw e
    }
  })

  it('Gets empty transactions history successfully', async () => {
    const transactionsResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsResponse.status).toBe(HttpStatus.OK)
    expect(transactionsResponse.body).toHaveLength(0)
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
    expect(singleTransaction.token.totalSupply).toBe(TOKEN['totalSupply'])
    expect(singleTransaction.from.toLowerCase()).toBe(ACCOUNTS[0].address)
    expect(singleTransaction.to.toLowerCase()).toBe(ACCOUNTS[1].address)
    expect(singleTransaction.state).toBe('processed')
    expect(singleTransaction.hash).toBe(sendTransactionResponse.body.hash)
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
      expect(tx.token.totalSupply).toBe(TOKEN['totalSupply'])
      expect(tx.from.toLowerCase()).toBe(ACCOUNTS[1].address)
      expect(tx.to.toLowerCase()).toBe(ACCOUNTS[0].address)
      expect(tx.state).toBe('processed')

      // check that the transactions are ordered DESC by blockNumber
      expect(tx.blockNumber).toBeLessThanOrEqual(previousBlockNumber)
      previousBlockNumber = tx.blockNumber
    }
  })

  it('Returns transaction history using defined limit and offset', async () => {

    const limitOffsetParams = {
      limit: 3,
      offset: 1
    }

    const transactionHistory = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    const historicalTransactions = transactionHistory.body
    expect(historicalTransactions).toHaveLength(limitOffsetParams.limit)
  })

  it('Fails to return transaction history using invalid limit and offset', async () => {

    const limitOffsetParams = {
      limit: "waza",
      offset: 0
    }

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    expect(transactionsAfterResponse.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('Returns transaction history using default limit and offset', async () => {
    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
  })

  it('Returns transaction history using max value for limit when exceeded', async () => {
    const limitOffsetParams = {
      limit: 210,
      offset: 0
    }

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
  })

  it('Fails to return transaction history when offset is negative', async () => {

    const limitOffsetParams = {
      limit: 50,
      offset: -1
    }

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`).query(limitOffsetParams)
    expect(transactionsAfterResponse.status).toBe(HttpStatus.BAD_REQUEST)
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
    expect(rawTransactionResponse.body.message.includes(`Provided address "${badContractAddress}" is invalid`)).toBeTruthy()
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
    expect(rawTransactionResponse.body.message.includes(`Provided address "${badFromAddress.toLowerCase()}" is invalid`)).toBeTruthy()
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

  it('Rejects 1 transfer signed with the wrong key', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
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

    expect(sendTransactionResponse.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('Rejects 1 transfer with the wrong "to" address', async () => {

    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
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
})

