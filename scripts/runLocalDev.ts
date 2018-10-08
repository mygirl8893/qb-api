import TestPrivateChain from '../__tests__/integration/testPrivateChain'
import apiTesting from '../__tests__/apiTesting'
import * as Tx from 'ethereumjs-tx'
import axios from 'axios/index'
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
  }]

const TOKEN = {
    name: "MagicCarpetsWorld",
    symbol: "MCW",
    decimals: 18,
    rate: 100
  }

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
  }

  const testDbConn = new apiTesting.TestDatabaseConn()
  await testDbConn.setup(token)

  const configValues = require('../src/config/config')

  configValues.default.development.tokenDB = testPrivateChain.tokenDBContractAddress

  const app = require('../app')
  const Config = require('../src/config').default

  const port = process.env.PORT || Config.getPort()
  app.default.listen(port)

  log.info(`Running API in ${Config.getEnv()} mode. Listening on port: ${port}`)

  await apiTesting.waitForAppToBeReady(Config)

  log.info('API is ready.')

}

async function seed() {
  log.info("Get raw transaction.")

  const rawTransactionRequest = {
    params: {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: '0x988f24d8356bf7e3D4645BA34068a5723BF3ec6B'
    }
  }

  const baseUrl = `http://localhost:${API_PORT}`

  const rawTransactionResponse = await axios.get(`${baseUrl}/transactions/raw`, rawTransactionRequest)

  log.info(rawTransactionResponse.data)

  const privateKey = new Buffer(ACCOUNTS[0].secretKey, 'hex')
  const transaction = new Tx(rawTransactionResponse.data)
  transaction.sign(privateKey)
  const serializedTx = transaction.serialize().toString('hex')

  const transferRequest = {
    data: serializedTx
  }

  log.info('POST signed transaction..')

  const sendTransactionResponse = await axios.post(`${baseUrl}/transactions/`, transferRequest)

  log.info(sendTransactionResponse)

  log.info("Query transaction history again.")

  const newRawHistoryResponse = await axios.get(`${baseUrl}/transactions/${ACCOUNTS[0].address}/history`)

  log.info(newRawHistoryResponse.data)
}

;(async () => {

  const command = process.argv[2]
  switch(command) {
    case 'launch':
      await launch()
      break;

    case 'seed':
      await seed()
      break;
    default:
      log.error(`Wrong command ${command}. Use 'launch' first, run your API, and then 'seed'.`)
  }

})().catch(e => {
  log.error(`${e.stack}`)
})
