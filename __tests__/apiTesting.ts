import utils from '../src/lib/utils'
import Sequelize from 'sequelize'
import * as qbDB from 'qb-db-migrations'
import log from '../src/logging'

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

async function setupDatabase(dbConfig, existingToken) {
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

  const Token = qbDB.token(sequelize, Sequelize.DataTypes)
  await Token.sync({force: true})
  await Token.destroy({ where: {} })

  const Transaction = qbDB.transaction(sequelize, Sequelize.DataTypes)
  await Transaction.sync({force: true})
  await Transaction.destroy({ where: {} })

  log.info(`Adding test token ${existingToken.symbol}.`)
  await Token.create(existingToken)

  log.info('Successfully setup database.')

  return sequelize
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  setupDatabase
}
