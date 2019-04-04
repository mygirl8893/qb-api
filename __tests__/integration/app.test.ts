import * as aesjs from 'aes-js'
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
  encryptionKey: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]'
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

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

jest.setTimeout(180000)

describe('App endpoint', () => {
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

  let encryptedHexSecret = ''
  it('Returns 200 and hex string for infura', async () => {

    const response = await request(app).get('/app/infura')

    encryptedHexSecret = response.body.key

    expect(response.status).toEqual(HttpStatus.OK)
  })

  it('Returns correct infura API key - decrypt and check', async () => {

    const decryptionKey = JSON.parse(INTEGRATION_TEST_CONFIGURATION.encryptionKey)

    // decrypt
    const aesCtr = new aesjs.ModeOfOperation.ctr(decryptionKey, new aesjs.Counter(5))
    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHexSecret)
    const decryptedBytes = aesCtr.decrypt(encryptedBytes)
    const decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes)

    expect(decryptedText).toEqual(INTEGRATION_TEST_CONFIGURATION.infuraApiKey)
  })

})
