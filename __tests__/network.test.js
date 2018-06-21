import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from 'supertest'
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

const latestBlockNumber = 3100
const latestBlock =  {
  "number": latestBlockNumber,
  "hash": "0xef95f2f1ed3ca60b048b4bf67cde2195961e0bba6f70bcbea9a2c4e133e34b46",
  "parentHash": "0x2302e1c0b972d00932deb5dab9eb2982f570597d9d42504c05d9c2147eaf9c88",
  "nonce": "0xfb6e1a62d119228b",
  "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
  "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "transactionsRoot": "0x3a1b03875115b79539e5bd33fb00d8f7b7cd61929d5a3c574f507b8acf415bee",
  "stateRoot": "0xf1133199d44695dfa8fd1bcfe424d82854b5cebef75bddd7e40ea94cda515bcb",
  "miner": "0x8888f1f195afa192cfee860698584c030f4c9db1",
  "difficulty": 444,
  "totalDifficulty": 555,
  "size": 616,
  "extraData": "0x",
  "gasLimit": 3141592,
  "gasUsed": 21662,
  "timestamp": 1429287689,
  "transactions": [
    "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b"
  ],
  "uncles": []
}

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
    getBlockNumber: async () => latestBlockNumber,
    getBlock: async (blockNumber) => {
      if (blockNumber === latestBlockNumber) {
        return latestBlock
      }
      throw Error(`Unexpected block number ${blockNumber}`)
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

describe('Network API', () => {

    it('returns network info succesfully', async () => {
      const r = await request(app).get('/net/')

      expect(r.status).to.equal(HttpStatus.OK)

      expect(r.body.hash).to.equal(latestBlock.hash)
      expect(r.body.number).to.equal(latestBlock.number)
    })
})
