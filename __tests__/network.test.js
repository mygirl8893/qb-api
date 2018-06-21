import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from 'supertest'
import Web3 from 'web3'


const mockWeb3 = {
  eth: {
    net: {
      isListening: async () => null,
      getId: async () => 1235
    }
  }
}

console.log("magic")
Web3.mockImplementation(() => {
  console.log("wooooo")
  return mockWeb3
})


/* eslint-disable-next-line no-undef */
jest.genMockFromModule('web3')
/* eslint-disable-next-line no-undef */
jest.mock('web3')


const app = require('../app')


const { expect } = chai

describe('Network API', () => {

    it('returns swagger docs successfully', async () => {
        const r = await request(app).get('/')
        expect(r.status).to.equal(HttpStatus.OK)
    })
})
