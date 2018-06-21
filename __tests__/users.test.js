import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from "supertest"
import Web3 from 'web3'
import APITesting from "./apiTesting"


const TEST_USER_ADDRESS = "fakeuseraddress"
const TEST_USER_TRANSACTION_COUNT = 99

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)
const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)
privateWeb3Rpc.eth.getTransactionCount = async (address) => {
  if (address === TEST_USER_ADDRESS) {
    return TEST_USER_TRANSACTION_COUNT
  }
  throw Error(`Unexpected user address ${TEST_USER_ADDRESS}`)
}

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

const { expect } = chai

describe('Users API', () => {

  it('returns user info succesfully', async () => {
    const r = await request(app).get(`/users/${TEST_USER_ADDRESS}`)

    expect(r.status).to.equal(HttpStatus.OK)

    expect(r.body.address).to.equal(TEST_USER_ADDRESS)
    expect(r.body.transactionCount).to.equal(TEST_USER_TRANSACTION_COUNT)
  })
})
