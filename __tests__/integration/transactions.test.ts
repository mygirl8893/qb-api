import * as request from 'supertest'
import * as HttpStatus from 'http-status-codes'
import Tx = require('ethereumjs-tx')

import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import database from '../../src/database'
import log from '../../src/logging'


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
  decimals: 10,
  rate: 100
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.mock('../../src/database', () => ({
    default: {
      getTransactionHistory: jest.fn(),
      addPendingTransaction: jest.fn()
    }
  }))

jest.setTimeout(180000)

describe('Transactions API Integration', () => {
  let app = null
  let privateChain = null

  beforeAll(async () => {

    try {
      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()
      INTEGRATION_TEST_CONFIGURATION.tokenDB = privateChain.tokenDBContractAddress

      app = require('../../app').default
      const Config = require('../../src/config').default

      await APITesting.waitForAppToBeReady(Config)
    } catch (e) {
      log.error(`Failed setting up the test context ${e}`)
      throw e
    }
  })

  afterAll(async () => {
    try {
      await privateChain.tearDown()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e}`)
      throw e
    }
  })

  it('Gets empty transactions history successfully', async () => {

    ;(database.getTransactionHistory as any).mockImplementation(async () => [])
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

    ;(database.getTransactionHistory as any).mockImplementation(async () => [{
      fromAddress: rawTransactionParams.from,
      toAddress: rawTransactionParams.to,
      value: rawTransactionParams.transferAmount.toString(),
      contract: rawTransactionParams.contractAddress
    }])

    ;(database.addPendingTransaction as any).mockImplementation(async () => {})

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

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    expect(transactionsAfterResponse.status).toBe(HttpStatus.OK)
    const transactions = transactionsAfterResponse.body

    expect(database.addPendingTransaction).toBeCalledWith(expect.objectContaining({
      fromAddress: rawTransactionParams.from.toLowerCase(),
      toAddress: rawTransactionParams.to.toLowerCase(),
      contractAddress: rawTransactionParams.contractAddress.toLowerCase(),
      state: 'pending'
    }))

    expect(transactions).toHaveLength(1)
    const singleTransaction = transactions[0]
    expect(singleTransaction.contract).toBe(privateChain.loyaltyTokenContractAddress)
    expect(singleTransaction.value).toBe(rawTransactionParams.transferAmount.toString())
    expect(singleTransaction.from.toLowerCase()).toBe(ACCOUNTS[0].address)
    expect(singleTransaction.to.toLowerCase()).toBe(ACCOUNTS[1].address)
  })

  it('Executes 5 transactions successfully with incrementing nonce', async () => {
    const rawTransactionParams = {
        from: ACCOUNTS[1].address,
        to: ACCOUNTS[0].address,
        transferAmount: 1,
        contractAddress: privateChain.loyaltyTokenContractAddress
      }

    const transactionCount = 5

    ;(database.getTransactionHistory as any).mockImplementation(async () => [{
      fromAddress: rawTransactionParams.from,
      toAddress: rawTransactionParams.to,
      value: rawTransactionParams.transferAmount.toString(),
      contract: rawTransactionParams.contractAddress
    }])

    ;(database.addPendingTransaction as any).mockImplementation(async () => null)

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

      expect(database.addPendingTransaction).toBeCalledWith(expect.objectContaining({
        fromAddress: rawTransactionParams.from.toLowerCase(),
        toAddress: rawTransactionParams.to.toLowerCase(),
        contractAddress: rawTransactionParams.contractAddress.toLowerCase(),
        state: 'pending'
      }))
    }
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

  it('Rejects 1 transfer with the wrong "to" wrong address', async () => {

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

