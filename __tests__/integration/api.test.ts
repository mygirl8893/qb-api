import * as request from 'supertest'
import * as HttpStatus from 'http-status-codes'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'
import log from '../../src/logging'

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
  name: 'MagicCarpetsWorld',
  symbol: 'MCW',
  decimals: 18,
  rate: 100,
  description: 'Magic is in the air.',
  website: 'otherworldlymagicalcarpets.com'
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('Network, Users and Tokens API', () => {
  let app = null
  let privateChain = null
  let testDbConn = null
  let apiDbConn = null
  beforeAll(async () => {

    try {

      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()
      INTEGRATION_TEST_CONFIGURATION.tokenDB = privateChain.tokenDBContractAddress

      TOKEN['totalSupply'] = privateChain.initialLoyaltyTokenAmount
      TOKEN['contractAddress'] = privateChain.loyaltyTokenContractAddress

      testDbConn = new APITesting.TestDatabaseConn()
      await testDbConn.setup(TOKEN)

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
      await testDbConn.close()
      await apiDbConn.close()
    } catch (e) {
      log.error(`Failed to tear down the test context ${e.stack}`)
      throw e
    }
  })

  it('Gets network info successfully', async () => {
    const r = await request(app).get('/net/')

    expect(r.status).toBe(HttpStatus.OK)

    expect(r.body.number).toBe(privateChain.setupBlockCount)
  })

  it('Gets user info successfully', async () => {

    const r = await request(app).get(`/users/${ACCOUNTS[0].address}`)

    expect(r.status).toBe(HttpStatus.OK)

    expect(r.body.address).toBe(ACCOUNTS[0].address)
    expect(r.body.transactionCount).toBe(privateChain.setupBlockCount)
  })

  it('Fails to get user info for a bad address', async () => {

    const badAddress = ACCOUNTS[0].address.substring(0, ACCOUNTS[0].address.length - 2) + 'xx'
    const r = await request(app).get(`/users/${badAddress}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    expect(r.body.message.includes(`Provided address "${badAddress}" is invalid`)).toBeTruthy()
  })

  it('Fails to get user info for an address with 0 transactions', async () => {

    const badAddress = ACCOUNTS[0].address.substring(0, ACCOUNTS[0].address.length - 2) + '11'
    const r = await request(app).get(`/users/${badAddress}`)

    expect(r.status).toBe(HttpStatus.OK)

    expect(r.body.transactionCount).toBe(0)
  })

  it('Gets tokens successfully', async () => {

    const r = await request(app).get(`/tokens`)

    expect(r.status).toBe(HttpStatus.OK)

    expect(r.body.private.length).toBe(1)
    const token = r.body.private[0]

    expect(token.contractAddress.toLowerCase()).toBe(privateChain.loyaltyTokenContractAddress.toLowerCase())
    expect(token.name).toBe(TOKEN.name)
    expect(token.symbol).toBe(TOKEN.symbol)
    expect(token.decimals).toBe(TOKEN.decimals)
    expect(token.balance).toBe('0')
    expect(token.totalSupply).toBe(`${privateChain.initialLoyaltyTokenAmount}`)
  })

  it('Gets token by contract address successfully', async () => {

    const r = await request(app).get(`/tokens/${privateChain.loyaltyTokenContractAddress.toLowerCase()}?from=${ACCOUNTS[0].address}`)

    expect(r.status).toBe(HttpStatus.OK)
    const token = r.body.private

    expect(token.contractAddress.toLowerCase()).toBe(privateChain.loyaltyTokenContractAddress.toLowerCase())
    expect(token.name).toBe(TOKEN.name)
    expect(token.symbol).toBe(TOKEN.symbol)
    expect(token.decimals).toBe(TOKEN.decimals)
    expect(token.balance).toBe(`${privateChain.initialLoyaltyTokenAmount}`)
    expect(token.totalSupply).toBe(`${privateChain.initialLoyaltyTokenAmount}`)
  })

  it('Fails to get token for invalid contract address', async () => {

    const badAddress = privateChain.loyaltyTokenContractAddress.substring(0, privateChain.loyaltyTokenContractAddress.length - 2) + 'xx'
    const r = await request(app).get(`/tokens/${badAddress}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    // is not a contract address
    expect(r.body.message.includes(`Provided address "${badAddress.toLowerCase()}" is invalid`)).toBeTruthy()
  })

  it('Fails to get token for non-existent contract address', async () => {

    const badAddress = privateChain.loyaltyTokenContractAddress.substring(0, privateChain.loyaltyTokenContractAddress.length - 2) + '11'
    const r = await request(app).get(`/tokens/${badAddress}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    expect(r.body.message.includes(`is not a contract address`)).toBeTruthy()
  })
})
