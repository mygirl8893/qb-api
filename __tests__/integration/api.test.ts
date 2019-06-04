import * as HttpStatus from 'http-status-codes'
import * as request from 'supertest'
import log from '../../src/logging'
import APITesting from '../apiTesting'
import TestPrivateChain from './testPrivateChain'

const ACCOUNTS = APITesting.ACCOUNTS
const PRIVATE_WEB3_PORT = 8545
const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  port: 3000,
  infuraApiKey: 'A secret API key',
  infuraEncryptionKey: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]'
}

const TOKEN = {
  name: 'MagicCarpetsWorld',
  symbol: 'MCW',
  decimals: 18,
  rate: 100,
  description: 'Magic is in the air.',
  website: 'otherworldlymagicalcarpets.com',
  totalSupply: undefined,
  contractAddress: undefined,
  hidden: false
}

const HIDDEN_UNOWNED_TOKEN = {
  id: undefined,
  name: 'HiddenUnownedToken',
  symbol: 'HUT',
  decimals: 18,
  rate: 100,
  description: 'Token is hidden and no one owns it.',
  website: 'idgaftoken.com',
  totalSupply: '100000000',
  contractAddress: '0x7cD0C5436B4087E145387eBF3Da7401f8295bcb5',
  hidden: true
}

const HIDDEN_OWNED_TOKEN = {
  id: undefined,
  name: 'HiddenOwnedToken',
  symbol: 'HOT',
  decimals: 18,
  rate: 100,
  description: 'Token is hidden and at someone owns it.',
  website: 'hottoken.com',
  totalSupply: '100000000',
  contractAddress: '0x814332F1073a9830601A588fBEdd1D5608f1E548',
  hidden: true
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('Network, Users, Tokens API', () => {
  let app = null
  let privateChain = null
  let testDbConn = null
  let apiDbConn = null
  beforeAll(async () => {

    try {

      privateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

      await privateChain.setup()

      TOKEN.totalSupply = privateChain.initialLoyaltyTokenAmount
      TOKEN.contractAddress = privateChain.loyaltyTokenContractAddress

      testDbConn = new APITesting.TestDatabaseConn()
      await testDbConn.setup(TOKEN, ACCOUNTS[2].address, ACCOUNTS[0].address)

      const hutResult = await testDbConn.createToken(HIDDEN_UNOWNED_TOKEN)
      HIDDEN_UNOWNED_TOKEN.id = hutResult.id
      const hotResult = await testDbConn.createToken(HIDDEN_OWNED_TOKEN)
      HIDDEN_OWNED_TOKEN.id = hotResult.id

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

  beforeEach(async () => {
    try {
      await testDbConn.clearTransactions()
    } catch (e) {
      log.error(`Failed beforeEach`)
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

    expect(r.body.message.includes(`"${badAddress}"`)).toBeTruthy()
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
    expect(token.website).toBe(TOKEN.website)
    expect(token.description).toBe(TOKEN.description)
    expect(token.rate).toBe(TOKEN.rate)
    expect(token).toHaveProperty('logoUrl')
    expect(token.balance).toBe('0')
    expect(token.totalSupply).toBe(`${privateChain.initialLoyaltyTokenAmount}`)
  })

  it('Gets token by contract address successfully', async () => {

    const r = await request(app)
      .get(`/tokens/${privateChain.loyaltyTokenContractAddress.toLowerCase()}?from=${ACCOUNTS[0].address}`)

    expect(r.status).toBe(HttpStatus.OK)
    const token = r.body.private

    expect(token.contractAddress.toLowerCase()).toBe(privateChain.loyaltyTokenContractAddress.toLowerCase())
    expect(token.name).toBe(TOKEN.name)
    expect(token.symbol).toBe(TOKEN.symbol)
    expect(token.decimals).toBe(TOKEN.decimals)
    expect(token.website).toBe(TOKEN.website)
    expect(token.description).toBe(TOKEN.description)
    expect(token.rate).toBe(TOKEN.rate)
    expect(token).toHaveProperty('logoUrl')
    expect(token.balance).toBe(`${ACCOUNTS[0].balance}`)
    expect(token.totalSupply).toBe(`${privateChain.initialLoyaltyTokenAmount}`)
  })

  it('Fails to get token for invalid contract address', async () => {

    const badAddress = privateChain.loyaltyTokenContractAddress
                        .substring(0, privateChain.loyaltyTokenContractAddress.length - 2) + 'xx'
    const r = await request(app).get(`/tokens/${badAddress}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    // is not a contract address
    expect(r.body.message.includes(`"${badAddress}"`)).toBeTruthy()
  })

  it('Fails to get token for non-existent contract address', async () => {

    const badAddress = privateChain.loyaltyTokenContractAddress
                        .substring(0, privateChain.loyaltyTokenContractAddress.length - 2) + '11'
    const r = await request(app).get(`/tokens/${badAddress}`)

    expect(r.status).toBe(HttpStatus.BAD_REQUEST)

    expect(r.body.message.includes(`Token has not been found`)).toBeTruthy()
  })

  it('Fetches owned hidden token successfully', async () => {

    const fromAddress = ACCOUNTS[0].address
    const toAddress = ACCOUNTS[3].address
    const chainId = 13
    const testHash = '0x557c39f6cad68f0790e10493300b7f1cf0b0ec0e5869a2f27ac45bdeb7abd099'
    const confirms = 1
    const tx = APITesting.makeTestTx(testHash, chainId, '10', HIDDEN_OWNED_TOKEN.contractAddress,
      HIDDEN_OWNED_TOKEN.id, confirms, fromAddress, toAddress)
    await testDbConn.insertTransaction(tx)

    const r = await request(app).get(`/tokens?walletAddress=${toAddress}`)

    expect(r.status).toBe(HttpStatus.OK)

    expect(r.body.private.length).toBe(2)
    const tokenInResponse = r.body.private.find(t => t.symbol === HIDDEN_OWNED_TOKEN.symbol)
    expect(tokenInResponse).toBeDefined()
  })
})
