import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from "supertest"
import Web3 from 'web3'
import APITesting from "./apiTesting"


const TEST_USER_ADDRESS = "fakeuseraddress"
const TEST_USER_TRANSACTION_COUNT = 99

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)
const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)
/* eslint-disable-next-line no-undef */
privateWeb3Rpc.eth.getTransactionCount = jest.fn()

Web3.mockImplementation((url) => {

  if (url === APITesting.TEST_CONFIGURATION.rpc.public) {
    return publicWeb3Rpc
  } else if (url === APITesting.TEST_CONFIGURATION.rpc.private) {
    return privateWeb3Rpc
  }
  throw new Error(`Unexpected web3 url ${url}`)
})

/* eslint-disable-next-line no-undef */
jest.genMockFromModule('web3')
/* eslint-disable-next-line no-undef */
jest.mock('web3')

/* using require for the app in order to allow the mocks to take effect
   before the module is actually loaded
 */
const app = require('../app')

describe('Users API', () => {

  it('returns user info successfully', async () => {
    privateWeb3Rpc.eth.getTransactionCount.mockImplementation(async () => TEST_USER_TRANSACTION_COUNT)

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    chai.expect(r.status).to.equal(HttpStatus.OK)

    /* eslint-disable-next-line no-undef */
    expect(privateWeb3Rpc.eth.getTransactionCount).toHaveBeenCalled()

    chai.expect(r.body.address).to.equal(TEST_USER_ADDRESS)
    chai.expect(r.body.transactionCount).to.equal(TEST_USER_TRANSACTION_COUNT)
  })

  it('fails to return user info when web3.eth.getTransactionCount fails', async () => {
    privateWeb3Rpc.eth.getTransactionCount.mockImplementation(async () => {
      throw new Error("Failed to get transaction count")
    })

    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    chai.expect(r.status).to.equal(HttpStatus.BAD_REQUEST)

    /* eslint-disable-next-line no-undef */
    expect(privateWeb3Rpc.eth.getTransactionCount).toHaveBeenCalled()
  })
})
