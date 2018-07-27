const Web3 = require('web3')
import * as HttpStatus from 'http-status-codes'
import * as request from 'supertest'
import APITesting from './apiTesting'

APITesting.setupTestConfiguration(APITesting.UNIT_TEST_CONFIGURATION)

const LATEST_BLOCK_NUMBER = 3100
const LATEST_BLOCK = APITesting.getSampleBlock(LATEST_BLOCK_NUMBER)

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)

const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)

;(privateWeb3Rpc.eth as any).getBlockNumber = jest.fn()
;(privateWeb3Rpc.eth as any).getBlock = jest.fn()

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

describe('Network API', () => {

    beforeAll(async () => {
      await APITesting.waitForAppToBeReady(Config)
    })

    it('returns network info successfully', async () => {

      ;(privateWeb3Rpc.eth as any).getBlockNumber.mockImplementation(async () => LATEST_BLOCK_NUMBER)
      ;(privateWeb3Rpc.eth as any).getBlock.mockImplementation(async () => LATEST_BLOCK)

      const r = await request(app).get('/net/')

      expect(r.status).toBe(HttpStatus.OK)

      expect((privateWeb3Rpc.eth as any).getBlockNumber).toHaveBeenCalled()
      expect((privateWeb3Rpc.eth as any).getBlock).toHaveBeenCalledWith(LATEST_BLOCK_NUMBER)

      expect(r.body.hash).toBe(LATEST_BLOCK.hash)
      expect(r.body.number).toBe(LATEST_BLOCK.number)
    })

    it('fails gracefully to return network info when web3.eth.getBlockNumber fails', async () => {
      ;(privateWeb3Rpc.eth as any).getBlockNumber.mockImplementation(async () => {
        throw new Error("Failed to fetch block number")
      })

      const r = await request(app).get('/net/')

      expect(r.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)

      expect((privateWeb3Rpc.eth as any).getBlockNumber).toHaveBeenCalled()
    })
})
