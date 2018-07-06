import request from 'supertest'
import HttpStatus from 'http-status-codes'
import Tx from 'ethereumjs-tx'

import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import database from '../../src/database'

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
    getTransactionHistory: jest.fn(),
    addPendingTransaction: jest.fn()
  }))

jest.setTimeout(180000)

describe('Transactions API Integration', () => {
  let app = null
  let privateChain = null

  beforeAll(async () => {

    privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

    await privateChain.setup()
    INTEGRATION_TEST_CONFIGURATION.tokenDB = privateChain.tokenDBContractAddress

    /* eslint-disable-next-line global-require */
    app = require('../../app')

    await APITesting.waitForAppToBeReady(app)
  })

  afterAll(async () => {
    await privateChain.tearDown()

  })

  it('Gets empty transactions history successfully', async () => {

    database.getTransactionHistory.mockImplementation(async () => [])
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

    database.getTransactionHistory.mockImplementation(async () => [{
      fromAddress: rawTransactionParams.from,
      toAddress: rawTransactionParams.to,
      value: rawTransactionParams.transferAmount.toString(),
      contract: rawTransactionParams.contractAddress
    }])

    database.addPendingTransaction.mockImplementation(async () => null)

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

    expect(transactions).toHaveLength(1)
    const singleTransaction = transactions[0]
    expect(singleTransaction.contract).toBe(privateChain.loyaltyTokenContractAddress)
    expect(singleTransaction.value).toBe(rawTransactionParams.transferAmount.toString())
    expect(singleTransaction.from.toLowerCase()).toBe(ACCOUNTS[0].address)
    expect(singleTransaction.to.toLowerCase()).toBe(ACCOUNTS[1].address)
  })
})

