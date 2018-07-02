import HttpStatus from 'http-status-codes'
import request from "supertest"
import Web3 from 'web3'
import APITesting from "./apiTesting"

APITesting.setupTestConfiguration(APITesting.UNIT_TEST_CONFIGURATION)

const TEST_USER_ADDRESS = "fakeuseraddress"
const TEST_USER_TRANSACTION_COUNT = 99

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)
const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)

privateWeb3Rpc.eth.getTransactionCount = jest.fn()

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

/* using require for the app in order to allow the mocks to take effect
   before the module is actually loaded
 */
const app = require('../app')

describe('Users API', () => {

  beforeAll(async () => {
    await APITesting.waitForAppToBeReady(app)
  })

  it('returns user info successfully', async () => {
    privateWeb3Rpc.eth.getTransactionCount.mockImplementation(async () => TEST_USER_TRANSACTION_COUNT)

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    expect(r.status).toBe(HttpStatus.OK)

    expect(privateWeb3Rpc.eth.getTransactionCount).toHaveBeenCalled()

    expect(r.body.address).toBe(TEST_USER_ADDRESS)
    expect(r.body.transactionCount).toBe(TEST_USER_TRANSACTION_COUNT)
  })

  it('fails to return user info when web3.eth.getTransactionCount fails', async () => {
    privateWeb3Rpc.eth.getTransactionCount.mockImplementation(async () => {
      throw new Error("Failed to get transaction count")
    })

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    expect(privateWeb3Rpc.eth.getTransactionCount).toHaveBeenCalled()
  })
})
