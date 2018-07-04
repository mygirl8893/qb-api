import mysql from 'promise-mysql'
import TestPrivateChain from '../__tests__/integration/testPrivateChain'
import apiTesting from '../__tests__/apiTesting'
import qbAPI from '../index'
import utils from '../src/lib/utils'

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
    decimals: 10,
    rate: 100
  }

;(async () => {

  const mysqlConn = await mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'a12345678$X',
    database : 'qiibee'
  })

  console.log('Successfully connected to mysql.')

  console.log('Clear out existing tables, and set up new tables..')

  await mysqlConn.query('DROP TABLE IF EXISTS tokens')
  await mysqlConn.query(`
  CREATE TABLE tokens
    (
      contractAddress CHAR(42) PRIMARY KEY,
      symbol VARCHAR(64),
      name VARCHAR(256),
      rate BIGINT UNSIGNED,
      totalSupply BIGINT UNSIGNED,
      decimals INT UNSIGNED
    );`)

  await mysqlConn.query('DROP TABLE IF EXISTS transactions')
  await mysqlConn.query(`
  CREATE TABLE transactions
  (
    hash  CHAR(66) PRIMARY KEY,
    nonce BIGINT UNSIGNED,
    blockHash VARCHAR(64),
    blockNumber BIGINT UNSIGNED,
    transactionIndex BIGINT UNSIGNED,
    fromAddress CHAR(42),
    toAddress CHAR(42),
    value BIGINT UNSIGNED,
    input TEXT,
    status VARCHAR(3),
    timestamp BIGINT UNSIGNED,
    confirms BIGINT UNSIGNED,
    contractAddress CHAR(42)
  );`)

  const testPrivateChain = new TestPrivateChain(ACCOUNTS, TOKEN, PRIVATE_WEB3_PORT)

  await testPrivateChain.setup()

  await mysqlConn.query(`INSERT INTO tokens SET ?`, {
    contractAddress: testPrivateChain.loyaltyTokenContractAddress,
    symbol: TOKEN.symbol,
    name: TOKEN.name,
    rate: TOKEN.rate,
    totalSupply: 12345678, // this is innacurate pick a valid value from the actual chain
    decimals: TOKEN.decimals,
  })

  const r = await mysqlConn.query('SELECT * FROM tokens')

  // console.log(`Launching qb-api app on ${API_PORT} ..`)
  //
  // const app = qbAPI.getApp()
  //
  // app.listen(API_PORT)
  //
  // await apiTesting.waitForAppToBeReady(app)
  //
  // console.log('qb-api is ready.')


  await utils.sleep(10000000000)

})().catch(e => {
  console.log(`ERROR ${e}`)
})
