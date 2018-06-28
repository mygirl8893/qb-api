import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from 'supertest'
import Web3 from 'web3'
import APITesting from './apiTesting'

APITesting.setupTestConfiguration(APITesting.UNIT_TEST_CONFIGURATION)

const LATEST_BLOCK_NUMBER = 3100
const LATEST_BLOCK = APITesting.getSampleBlock(LATEST_BLOCK_NUMBER)

const publicWeb3Rpc = APITesting.getBaseWeb3Mock(1234)

const privateWeb3Rpc = APITesting.getBaseWeb3Mock(9876)
/* eslint-disable no-undef */
privateWeb3Rpc.eth.getBlockNumber = jest.fn()
privateWeb3Rpc.eth.getBlock = jest.fn()
/* eslint-enable no-undef */

Web3.mockImplementation((url) => {

  if (url === APITesting.UNIT_TEST_CONFIGURATION.rpc.public) {
    return publicWeb3Rpc
  } else if (url === APITesting.UNIT_TEST_CONFIGURATION.rpc.private) {
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

describe('Network API', () => {

    it('returns network info successfully', async () => {

      privateWeb3Rpc.eth.getBlockNumber.mockImplementation(async () => LATEST_BLOCK_NUMBER)
      privateWeb3Rpc.eth.getBlock.mockImplementation(async () => LATEST_BLOCK)

      const r = await request(app).get('/net/')

      chai.expect(r.status).to.equal(HttpStatus.OK)

      /* eslint-disable no-undef */
      expect(privateWeb3Rpc.eth.getBlockNumber).toHaveBeenCalled()
      expect(privateWeb3Rpc.eth.getBlock).toHaveBeenCalledWith(LATEST_BLOCK_NUMBER)
      /* eslint-enable no-undef */

      chai.expect(r.body.hash).to.equal(LATEST_BLOCK.hash)
      chai.expect(r.body.number).to.equal(LATEST_BLOCK.number)
    })

    it('fails gracefully to return network info when web3.eth.getBlockNumber fails', async () => {
      privateWeb3Rpc.eth.getBlockNumber.mockImplementation(async () => {
        throw new Error("Failed to fetch block number")
      })

      const r = await request(app).get('/net/')

      chai.expect(r.status).to.equal(HttpStatus.BAD_REQUEST)

      /* eslint-disable no-undef */
      expect(privateWeb3Rpc.eth.getBlockNumber).toHaveBeenCalled()
      /* eslint-enable no-undef */
    })
})
