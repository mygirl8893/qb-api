import HttpStatus from 'http-status-codes'
import request from 'supertest'
import Web3 from 'web3'
import APITesting from './apiTesting'

APITesting.setupTestConfiguration(APITesting.UNIT_TEST_CONFIGURATION)

const LATEST_BLOCK_NUMBER = 3100
const LATEST_BLOCK = APITesting.getSampleBlock(LATEST_BLOCK_NUMBER)

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)

const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)

privateWeb3Rpc.eth.getBlockNumber = jest.fn()
privateWeb3Rpc.eth.getBlock = jest.fn()

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

describe('Network API', () => {

    beforeAll(async () => {
      await APITesting.waitForAppToBeReady(app)
    })

    it('returns network info successfully', async () => {

      privateWeb3Rpc.eth.getBlockNumber.mockImplementation(async () => LATEST_BLOCK_NUMBER)
      privateWeb3Rpc.eth.getBlock.mockImplementation(async () => LATEST_BLOCK)

      const r = await request(app).get('/net/')

      expect(r.status).toBe(HttpStatus.OK)

      expect(privateWeb3Rpc.eth.getBlockNumber).toHaveBeenCalled()
      expect(privateWeb3Rpc.eth.getBlock).toHaveBeenCalledWith(LATEST_BLOCK_NUMBER)

      expect(r.body.hash).toBe(LATEST_BLOCK.hash)
      expect(r.body.number).toBe(LATEST_BLOCK.number)
    })

    it('fails gracefully to return network info when web3.eth.getBlockNumber fails', async () => {
      privateWeb3Rpc.eth.getBlockNumber.mockImplementation(async () => {
        throw new Error("Failed to fetch block number")
      })

      const r = await request(app).get('/net/')

      expect(r.status).toBe(HttpStatus.BAD_REQUEST)

      expect(privateWeb3Rpc.eth.getBlockNumber).toHaveBeenCalled()
    })
})
