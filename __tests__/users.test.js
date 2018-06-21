import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from "supertest"
import Web3 from 'web3'


// patch the Config module to have a test configuration
const testConfiguration = {
  rpc: {
    private: 'http://testprivatechain.com',
    public: 'https://testpublicchain.com'
  },
  tokenDB: '0x988f24d8356bf7e3d4645ba34068a5723bf3ec6b',
  port: 3000
}
const Config = require('../src/config/config.js')

Config.default.test = testConfiguration

const TEST_USER_ADDRESS = "fakeuseraddress"
const TEST_USER_TRANSACTION_COUNT = 99

const publicWeb3Rpc = {
  eth: {
    net: {
      isListening: async () => null,
      getId: async () => 1234
    }
  }
}

const privateWeb3Rpc = {
  eth: {
    net: {
      isListening: async () => null,
      getId: async () => 9876
    },
    getTransactionCount: async (address) => {
      if (address === TEST_USER_ADDRESS) {
        return TEST_USER_TRANSACTION_COUNT
      }
      throw Error(`Unexpected user address ${TEST_USER_ADDRESS}`)
    }
  }
}

Web3.mockImplementation((url) => {

  if (url === testConfiguration.rpc.public) {
    return publicWeb3Rpc
  } else if (url === testConfiguration.rpc.private) {
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
