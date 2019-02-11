import axios from 'axios'
import * as Tx from 'ethereumjs-tx'
import apiTesting from '../__tests__/apiTesting'
import TestPrivateChain from '../__tests__/integration/testPrivateChain'
import log from '../src/logging'

/*
 *  This script creates a local dev environment to experiment with the API
 */

const API_PORT = 3000

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
  }, {
  address: '0x3f1776f56bc9e9585612fe7790f0dda5b299517f',
  secretKey: 'dc355b8dbd5a7fceb6e9278e01a4ec692c87e15706c40df8053867ee3dd76645',
  balance: START_BALANCE
}]

const TOKEN = {
    name: 'MagicCarpetsWorld',
    symbol: 'MCW',
    decimals: 18,
    rate: 100
  }

const BRAND_ADDRESS = ACCOUNTS[0].address
const TEMP_EXCHANGE_WALLET_ADDRESS = ACCOUNTS[2].address

async function launch() {

  const testPrivateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

  await testPrivateChain.setup()

  log.info('Local test chain is setup and running.')

  const token = {
    contractAddress: testPrivateChain.loyaltyTokenContractAddress,
    symbol: TOKEN.symbol,
    name: TOKEN.name,
    rate: TOKEN.rate,
    totalSupply: 10 ** 27, // this is innacurate pick a valid value from the actual chain
    decimals: TOKEN.decimals,
    description: 'carpets for everyone',
    website: 'magiccarpets.com'
  }

  const testDbConn = new apiTesting.TestDatabaseConn()
  await testDbConn.setup(token, TEMP_EXCHANGE_WALLET_ADDRESS, BRAND_ADDRESS)

  const app = require('../app')

  const ConfigValues = require('../src/config/config').default
  ConfigValues.qbxContract = '0x988f24d8356bf7e3D4645BA34068a5723BF3ec6B'

  const Config = require('../src/config').default

  const port = process.env.PORT || Config.getPort()
  app.default.listen(port)

  log.info(`Running API in ${Config.getEnv()} mode. Listening on port: ${port}`)

  await apiTesting.waitForAppToBeReady(Config)

  log.info('API is ready.')

}

async function sendTransaction(from, to, transferAmount) {
  log.info('Get raw transaction.')
  const rawTransactionRequest = {
    params: {
      from,
      to,
      transferAmount,
      contractAddress: '0x988f24d8356bf7e3D4645BA34068a5723BF3ec6B'
    }
  }
  const baseUrl = `http://localhost:${API_PORT}`
  const rawTransactionResponse = await axios.get(`${baseUrl}/transactions/raw`, rawTransactionRequest)
  log.info(JSON.stringify(rawTransactionResponse.data))

  const account = ACCOUNTS.filter((a) => a.address === from)[0]

  const privateKey = new Buffer(account.secretKey, 'hex')
  const transaction = new Tx(rawTransactionResponse.data)
  transaction.sign(privateKey)
  const serializedTx = transaction.serialize().toString('hex')

  const transferRequest = {
    data: '0x' + serializedTx
  }

  log.info('POST signed transaction..')
  const sendTransactionResponse = await axios.post(`${baseUrl}/transactions/`, transferRequest)
  log.info(JSON.stringify(sendTransactionResponse.data))
  log.info('Query transaction history again.')
  const newRawHistoryResponse = await axios.get(`${baseUrl}/transactions/${from}/history`)
  log.info(JSON.stringify(newRawHistoryResponse.data))
}

(async () => {
  const command = process.argv[2]
  switch (command) {
    case 'launch':
      await launch()
      break
    case 'transfer':
      await sendTransaction(BRAND_ADDRESS, ACCOUNTS[1].address, 10)
      break
    case 'exchange':
      await sendTransaction(ACCOUNTS[1].address, TEMP_EXCHANGE_WALLET_ADDRESS, '100000000000')
      break
    default:
      log.error(`Wrong command ${command}. Use 'launch' first, run your API, and then 'seed'.`)
  }

})().catch((e) => {
  log.error(`Failed command with ${e.stack}`)
  if (e.response) {
    log.error(`Request failed with ${JSON.stringify(e.response.data)}`)
  }
})
