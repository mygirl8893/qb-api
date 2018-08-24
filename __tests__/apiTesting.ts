import utils from '../src/lib/utils'
import Sequelize from 'sequelize'
import log from '../src/logging'
import * as mysql from "promise-mysql";

const setupTestConfiguration = (testConfiguration) => {
  // patch the Config module to have a test configuration
  const Config = require('../src/config/config')

  Config.default.test = testConfiguration
}

const waitForAppToBeReady = async (config) => {

  while (true) {
    if (config.getWeb3ConnectionsAreReady()) {
      break
    }

    await utils.sleep(100)
  }
}

async function setupDatabaseTables(mysqlConn) {
  await mysqlConn.query('DROP TABLE IF EXISTS tokens')

  await mysqlConn.query(`
  CREATE TABLE tokens (
    id int(11) NOT NULL AUTO_INCREMENT,
    contractAddress char(42) DEFAULT NULL,
    symbol varchar(64) DEFAULT NULL,
    name varchar(256) DEFAULT NULL,
    rate bigint(20) unsigned DEFAULT NULL,
    totalSupply decimal(36,0) DEFAULT NULL,
    decimals int(10) unsigned DEFAULT NULL,
    PRIMARY KEY (id)
    );`)

  await mysqlConn.query('DROP TABLE IF EXISTS transactions')
  await mysqlConn.query(`
  CREATE TABLE transactions (
    id int(11) NOT NULL AUTO_INCREMENT,
    hash char(66) NOT NULL,
    nonce bigint(20) unsigned DEFAULT NULL,
    blockHash varchar(66) DEFAULT NULL,
    blockNumber bigint(20) unsigned DEFAULT NULL,
    transactionIndex bigint(20) unsigned DEFAULT NULL,
    fromAddress char(42) DEFAULT NULL,
    toAddress char(42) DEFAULT NULL,
    value decimal(36,0) DEFAULT NULL,
    input text,
    status varchar(3) DEFAULT NULL,
    timestamp bigint(20) unsigned DEFAULT NULL,
    confirms bigint(20) unsigned DEFAULT NULL,
    contractAddress char(42) DEFAULT NULL,
    state varchar(50) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY hash (hash)
  );`)
}

async function setupDatabase(dbConfig, existingToken) {
  const mysqlConn = await mysql.createConnection({
    host     : dbConfig.host,
    user     : dbConfig.user,
    password : dbConfig.password,
    database : dbConfig.database
  })

  log.info('Successfully connected to mysql.')

  await setupDatabaseTables(mysqlConn)

  log.info(`Adding test token ${existingToken.symbol}.`)

  await mysqlConn.query(`INSERT INTO tokens SET ?`, existingToken)

  return mysqlConn
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  setupDatabase
}
