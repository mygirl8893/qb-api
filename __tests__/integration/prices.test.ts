import axios from 'axios'
import * as HttpStatus from 'http-status-codes'
import * as request from 'supertest'

import log from '../../src/logging'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'

const ETH_PRICE_USD = 500
const ETH_PRICE_EUR = 400
const ETH_PRICE_CHF = 480
const ETH_PRICE_QBX = 0.0001

const ACCOUNTS = APITesting.ACCOUNTS
const PRIVATE_WEB3_PORT = 8545

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  port: 3000
}

const TOKEN = {
  name: 'MagicCarpetsWorld',
  symbol: 'MCW',
  decimals: 18,
  rate: 10,
  description: 'Magic is in the air.',
  website: 'otherworldlymagicalcarpets.com',
  totalSupply: undefined,
  contractAddress: undefined
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.genMockFromModule('axios')
jest.mock('axios')

jest.setTimeout(180000)

describe('Prices API Integration', () => {
  let app = null
  let privateChain = null
  let apiDbConn = null
  let testDbConn = null
  beforeAll(async () => {

    try {
      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()

      TOKEN.totalSupply = privateChain.initialLoyaltyTokenAmount
      TOKEN.contractAddress = privateChain.loyaltyTokenContractAddress

      testDbConn = new APITesting.TestDatabaseConn()
      await testDbConn.setup(TOKEN, ACCOUNTS[2].address, ACCOUNTS[0].address)

      app = require('../../app').default
      const Config = require('../../src/config').default

      apiDbConn = require('../../src/database').default

      await APITesting.waitForAppToBeReady(Config)
    } catch (e) {
      log.error(`Failed setting up the test context ${e.stack}`)
      throw e
    }
  })

  afterAll(async () => {
    try {
      await privateChain.tearDown()
      await apiDbConn.close()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e.stack}`)
      throw e
    }
  })

  it('Gets price of LoyaltyToken MCW in USD successfully', async () => {
    const CURR = 'USD'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          USD: ETH_PRICE_USD
        }
      })
    )

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      to: CURR
    }
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      USD: ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4)
    })
  })

  it('Gets price of LoyaltyToken MCW in multiple currencies successfully', async () => {
    const CURR = 'USD,CHF,EUR'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          USD: ETH_PRICE_USD,
          CHF: ETH_PRICE_CHF,
          EUR: ETH_PRICE_EUR
        }
      })
    )

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      to: CURR
    }
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      USD: ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4),
      CHF: ((ETH_PRICE_QBX * ETH_PRICE_CHF) / TOKEN.rate).toFixed(4),
      EUR: ((ETH_PRICE_QBX * ETH_PRICE_EUR) / TOKEN.rate).toFixed(4)
    })
  })

  it('Gets price of LoyaltyToken MCW should fail if no currency is given', async () => {

    (axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.OK,
        data: {
          USD: ETH_PRICE_USD
        }
      })
    )

    const pricesParams = { from: privateChain.loyaltyTokenContractAddress }
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      USD: ((ETH_PRICE_QBX * ETH_PRICE_USD) / TOKEN.rate).toFixed(4)
    })
  })

  it('Gets price of LoyaltyToken MCW should fail if currency unknown', async () => {
    const CURR = 'AAA'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
        status: HttpStatus.BAD_REQUEST,
        data: {
          Response: 'Error',
          Message: 'There is no data for any of the toSymbols AAA .',
          Type: 1,
          Aggregated: false,
          Data: [],
          Warning: 'There is no data for the toSymbol/s AAA ',
          HasWarning: true
        }
      })
    )

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      to: CURR
    }
    const response = await request(app)
      .get(`/prices`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.BAD_REQUEST)
    expect(response.body.message).toEqual(`There is no data for any of the toSymbols ${CURR} .`)
  })

  it('Get historical values of LoyaltyToken MCW. Should default to USD if no currency is passed', async () => {
    (axios.get as any).mockImplementation(async () => ({
      status: HttpStatus.OK,
      data: {
        Response: 'Success',
        Type: 100,
        Aggregated: false,
        Data: [
          {
            time: 1533582600,
            close: 177.24,
            high: 177.24,
            low: 177.21,
            open: 177.21,
            volumefrom: 0.08624,
            volumeto: 15.29
          },
          {
            time: 1533582660,
            close: 177.11,
            high: 177.24,
            low: 177.11,
            open: 177.24,
            volumefrom: 2.92,
            volumeto: 1424.17
          }
        ]
      }
    }))

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      limit: 30,
      aggregate: 1,
      frequency: 'minute'
    }
    const response = await request(app)
      .get(`/prices/history`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual([
      {price: '0.0017724000', time: 1533582600},
      {price: '0.0017711000', time: 1533582660}])
  })

  it('Get historical values of LoyaltyToken MCW should fail if from is empty', async () => {
    const CURR = 'USD'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
      status: HttpStatus.BAD_REQUEST,
      data: {
        Response: 'Error',
        Message: 'fsym param is empty or null.',
        Type: 1,
        Aggregated: false,
        Data: []
      }
    }))

    const pricesParams = {
      to: CURR,
      limit: 30,
      aggregate: 1,
      frequency: 'minute'
    }
    const response = await request(app)
      .get(`/prices/history`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.BAD_REQUEST)
    expect(response.body.message).toContain('from')
  })

  it('Get historical values of invalid LoyaltyToken', async () => {
    const CURR = 'USD'
    const INVALID_TOKEN_ADDRESS = '0x988f24d8356bf7e3d4645ba34068a5723bf3ec6c'

    const pricesParams = {
      from: INVALID_TOKEN_ADDRESS,
      to: CURR,
      limit: 30,
      aggregate: 1,
      frequency: 'minute'
    }
    const response = await request(app)
      .get(`/prices/history`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.NOT_FOUND)
    expect(response.body.message).toEqual(`Token with address ${INVALID_TOKEN_ADDRESS} does not exist.`)
  })

  it('Get historical values of LoyaltyToken MCW should fail if multiple currencies are passed', async () => {
    const CURR = 'USD,CHF'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
      status: HttpStatus.OK,
      data: {
        Response: 'Error',
        Message: 'There is no data for the toSymbol USD,CHF .',
        Type: 1,
        Aggregated: false,
        Data: []
      }
    }))

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      to: CURR,
      limit: 30,
      aggregate: 1,
      frequency: 'minute'
    }
    const response = await request(app)
      .get(`/prices/history`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.BAD_REQUEST)
    expect(response.body.message).toEqual('There is no data for the toSymbol USD,CHF .')
  })

  it('Get historical values of Loyalty token in USD with limit 30, aggregate 1, frequency minutes', async () => {
    const CURR = 'USD,CHF'
    // tslint:disable-next-line
    ;(axios.get as any).mockImplementation(async () => ({
      status: HttpStatus.OK,
      data: {
        Response: 'Success',
        Type: 100,
        Aggregated: false,
        Data: [
          {
            time: 1533582600,
            close: 177.24,
            high: 177.24,
            low: 177.21,
            open: 177.21,
            volumefrom: 0.08624,
            volumeto: 15.29
          },
          {
            time: 1533582660,
            close: 177.11,
            high: 177.24,
            low: 177.11,
            open: 177.24,
            volumefrom: 2.92,
            volumeto: 1424.17
          }
        ]
      }
    }))

    const pricesParams = {
      from: privateChain.loyaltyTokenContractAddress,
      to: CURR,
      limit: 30,
      aggregate: 1,
      frequency: 'minute'
    }
    const response = await request(app)
      .get(`/prices/history`)
      .query(pricesParams)
    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual([
      {price: '0.0017724000', time: 1533582600},
      {price: '0.0017711000', time: 1533582660}])
  })
})
