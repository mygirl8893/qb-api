import utils from '../src/lib/utils'
import log from '../src/logging'
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

async function setupDatabaseTables() {
  await qbDB.runMigrations(qbDB.models.sequelize, true)
}

class TestDatabaseConn {
  testToken
  constructor() {
  }

  async setup(existingToken): Promise<void> {
    log.info(`Adding test token ${existingToken.symbol}.`)

    await setupDatabaseTables()

    const firstBrand = {
      legalName: 'MagicWorld'
    }
    await qbDB.models.brand.create(firstBrand)
    const newBrand = await qbDB.models.brand.find({where: {legalName: firstBrand.legalName}})

    existingToken.brandId = newBrand.id
    this.testToken = await qbDB.models.token.create(existingToken)

    // add non-deployed token
    const nonDeployedToken = JSON.parse(JSON.stringify(existingToken))
    delete nonDeployedToken.contractAddress
    nonDeployedToken.symbol = 'SDS'
    nonDeployedToken.name = 'Not deployed token'
    await qbDB.models.token.create(nonDeployedToken)

    log.info('Successfully setup database.')
  }

  async updateMinedStatus(txHash, blockNumber) {
    const r = await qbDB.models.transaction.update({
      blockNumber: blockNumber,
      state: 'processed',
      tokenId: this.testToken.id
    }, { where: { hash: txHash }})
    return r
  }

  async close() {
    await qbDB.models.sequelize.close()
  }
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  TestDatabaseConn
}
