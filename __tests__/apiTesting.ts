import utils from '../src/lib/utils'
import Sequelize from 'sequelize'
import log from '../src/logging'
import * as mysql from 'promise-mysql'
import * as qbDB from 'qb-db-migrations'

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

class TestDatabaseConn {
  Token = null
  Transaction = null
  sequelize = null
  constructor() {
  }

  async setup(dbConfig, existingToken): Promise<void> {
    const sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.user,
      dbConfig.password, {
        host: dbConfig.host,
        dialect: 'mysql',
        operatorsAliases: false,

        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      })
    await sequelize.authenticate()

    log.info('Authenticated with the database. synching the model and deleting previously existing data.')

    this.Token = qbDB.token(sequelize, Sequelize.DataTypes)
    await this.Token.sync({force: true})
    await this.Token.destroy({ where: {} })

    this.Transaction = qbDB.transaction(sequelize, Sequelize.DataTypes)
    await this.Transaction.sync({force: true})
    await this.Transaction.destroy({ where: {} })

    log.info(`Adding test token ${existingToken.symbol}.`)
    await this.Token.create(existingToken)

    log.info('Successfully setup database.')

    this.sequelize = sequelize
  }

  async updateMinedStatus(txHash, blockNumber) {
    const r = await this.Transaction.update({ blockNumber: blockNumber, state: 'processed'}, { where: { hash: txHash }})
    return r
  }

  async close() {
    await this.sequelize.close()
  }
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  TestDatabaseConn
}
