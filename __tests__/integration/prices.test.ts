import * as request from 'supertest'
import * as HttpStatus from 'http-status-codes'
const axios = require('axios/index')

import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import database from '../../src/database'
import log from '../../src/logging'

const ETH_PRICE_USD = 500
const ETH_PRICE_EUR = 400
const ETH_PRICE_CHF = 480
const ETH_PRICE_QBX = 0.0001

const PRIVATE_WEB3_PORT = 8545

const START_BALANCE = 10 ** 20

const ACCOUNTS = [{
  address: '0x87265a62c60247f862b9149423061b36b460f4bb',
  secretKey: 'e8280389ca1303a2712a874707fdd5d8ae0437fab9918f845d26fd9919af5a92',
  balance: START_BALANCE
}, {
  address: '0xb99c958777f024bc4ce992b2a0efb2f1f50a4dcf',
  secretKey: 'ed095a912033d26dc444d2675b33414f0561af170d58c33f394db8812c87a764',
  balance: START_BALANCE
}]

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  tokenDB: 'ADDRESS_PLACEHOLDER_UNTIL_CONTRACT_DEPLOYMENT',
  port: 3000
}

const TOKEN = {
  name: "MagicCarpetsWorld",
  symbol: "MCW",
  decimals: 18,
  rate: 10
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.mock('../../src/database', () => ({
    default: {
      getTransactionHistory: jest.fn(),
      addPendingTransaction: jest.fn(),
    }
  }))

jest.genMockFromModule('axios')
jest.mock('axios')

jest.setTimeout(180000)

describe('Prices API Integration', () => {
  let app = null
  let privateChain = null

  beforeAll(async () => {

    try {
      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()
      INTEGRATION_TEST_CONFIGURATION.tokenDB = privateChain.tokenDBContractAddress

      app = require('../../app').default
      const Config = require('../../src/config').default

      await APITesting.waitForAppToBeReady(Config)
    } catch (e) {
      log.error(`Failed setting up the test context ${e}`)
      throw e
    }
  })

  afterAll(async () => {
    try {
      await privateChain.tearDown()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e}`)
      throw e
    }
  })

  it('Gets price of LoyaltyToken MCW in USD successfully', async () => {

    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          'USD': ETH_PRICE_USD,
        }
      })
    )

    const pricesParams = `from=${privateChain.loyaltyTokenContractAddress}&to=USD`
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      "USD": ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4),
    })
  })

  it('Gets price of LoyaltyToken MCW in multiple currencies successfully', async () => {

    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          'USD': ETH_PRICE_USD,
          'CHF': ETH_PRICE_CHF,
          'EUR': ETH_PRICE_EUR,
        }
      })
    )

    const pricesParams = `from=${privateChain.loyaltyTokenContractAddress}&to=USD,CHF,EUR`
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      "USD": ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4),
      "CHF": ((ETH_PRICE_QBX * ETH_PRICE_CHF) / TOKEN.rate).toFixed(4),
      "EUR": ((ETH_PRICE_QBX * ETH_PRICE_EUR) / TOKEN.rate).toFixed(4),
    })
  })

  it('Gets price of LoyaltyToken MCW should not fail if no currency is given', async () => {

    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          'USD': ETH_PRICE_USD
        }
      })
    )

    const pricesParams = `from=${privateChain.loyaltyTokenContractAddress}`
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      "USD": ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4),
    })
  })

  it('Gets price of LoyaltyToken MCW should not fail if currency unknown', async () => {
    const CURR = 'AAA'
    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.BAD_REQUEST,
        data: {
          "Response": "Error",
          "Message": "There is no data for any of the toSymbols AAA .",
          "Type": 1,
          "Aggregated": false,
          "Data": [],
          "Warning": "There is no data for the toSymbol/s AAA ",
          "HasWarning": true
        }
      })
    )

    const pricesParams = `from=${privateChain.loyaltyTokenContractAddress}&to=${CURR}`
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.BAD_REQUEST)
    expect(response.body.message).toEqual(`There is no data for any of the toSymbols ${CURR} .`)
  })

})

