import * as abiDecoder from 'abi-decoder'
import { BigNumber } from 'bignumber.js'
import * as qbDB from 'qb-db-migrations'
import utils from '../src/lib/utils'
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

async function setupDatabaseTables() {
  await qbDB.runMigrations(qbDB.models.sequelize, true)
}

function makeStoreableTransaction(original, receipt, block) {

  const decoded = abiDecoder.decodeMethod(original.input)

  if (!decoded) { // it's not a loyalty token transaction
    return null
  }

  if (decoded.name !== 'transfer') {
    log.info(`Encountered loyalty transaction of type: ${decoded.name}. Skipping.`)
    return null
  }

  const transaction = JSON.parse(JSON.stringify(original))

  transaction.status = receipt.status
  transaction.contractAddress = transaction.to

  transaction.toAddress =
    decoded && decoded.params[0] && decoded.params[0].value
      ? decoded.params[0].value
      : transaction.to
  transaction.toAddress = transaction.toAddress.toLowerCase()
  delete transaction.to
  transaction.fromAddress = transaction.from.toLowerCase()
  delete transaction.from

  transaction.value =
    decoded && decoded.params && decoded.params[1].value
      ? new BigNumber(decoded.params[1].value).toString(10)
      : transaction.value.toString(10)
  transaction.timestamp = block.timestamp
  transaction.confirms = 0
  transaction.state = 'processed'
  transaction.contractFunction = decoded.name

  delete transaction.gas
  delete transaction.gasPrice
  delete transaction.v
  delete transaction.r
  delete transaction.s

  return transaction
}

class TestDatabaseConn {
  private testToken

  public async setup(existingToken): Promise<void> {
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

  public async updateMinedStatus(tx, txReceipt, block, brandAddresses) {
    const storeable = makeStoreableTransaction(tx, txReceipt, block)
    storeable.tokenId = this.testToken.id

    if (storeable.contractFunction === 'transfer') {
      const lowerCased = brandAddresses.map((a) => a.toLowerCase())
      const addressSet = new Set(lowerCased)
      if (addressSet.has(storeable.toAddress.toLowerCase())) {
        storeable.txType = 'redeem'
      } else if (addressSet.has(storeable.fromAddress.toLowerCase())) {
        storeable.txType = 'reward'
      }
    }
    const r = await qbDB.models.transaction.update(storeable, { where: { hash: tx.hash }})
    return r
  }

  public async close() {
    await qbDB.models.sequelize.close()
  }
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  TestDatabaseConn
}
