import * as HttpStatus from 'http-status-codes'
import * as request from "supertest"
const Web3 = require('web3')
import APITesting from "./apiTesting"

APITesting.setupTestConfiguration(APITesting.UNIT_TEST_CONFIGURATION)

const TEST_USER_ADDRESS = "fakeuseraddress"
const TEST_USER_TRANSACTION_COUNT = 99

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)
const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)

;(privateWeb3Rpc.eth as any).getTransactionCount = jest.fn()

Web3.mockImplementation((url) => {

  if (url === APITesting.UNIT_TEST_CONFIGURATION.rpc.public) {
    return publicWeb3Rpc
  } else if (url === APITesting.UNIT_TEST_CONFIGURATION.rpc.private) {
    return privateWeb3Rpc
  }
  throw new Error(`Unexpected web3 url ${url}`)
})

jest.genMockFromModule('web3')
jest.mock('web3')

jest.mock('../src/database', () => ({
    getTransactionHistory: jest.fn(),
    addPendingTransaction: jest.fn()
  }))

/* using require for the app in order to allow the mocks to take effect
   before the module is actually loaded
 */
const app = require('../app').default
const Config = require('../src/config').default

describe('Users API', () => {

  beforeAll(async () => {
    await APITesting.waitForAppToBeReady(Config)
  })

  it('returns user info successfully', async () => {
    ;(privateWeb3Rpc.eth as any).getTransactionCount.mockImplementation(async () => TEST_USER_TRANSACTION_COUNT)

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    expect(r.status).toBe(HttpStatus.OK)

    expect((privateWeb3Rpc.eth as any).getTransactionCount).toHaveBeenCalled()

    expect(r.body.address).toBe(TEST_USER_ADDRESS)
    expect(r.body.transactionCount).toBe(TEST_USER_TRANSACTION_COUNT)
  })

  it('fails to return user info when web3.eth.getTransactionCount fails', async () => {

    const errorMessage = "Failed to get transaction count"
    ;(privateWeb3Rpc.eth as any).getTransactionCount.mockImplementation(async () => {
      throw new Error(errorMessage)
    })

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    expect(r.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(r.body.message).toBe(errorMessage)

    expect((privateWeb3Rpc.eth as any).getTransactionCount).toHaveBeenCalled()
  })
})
