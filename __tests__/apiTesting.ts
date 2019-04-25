import * as abiDecoder from 'abi-decoder'
import { BigNumber } from 'bignumber.js'
import * as qbDB from 'qb-db-migrations'
import utils from '../src/lib/utils'
import log from '../src/logging'

const START_BALANCE = '1000000000000000000000000000000'

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
},  {
  address: '0xbe3128803d95484af5c160c65ad5a74a4729c6cf',
  secretKey: '7319d2eaad81fae222fe3c0799bfde840c0df744d3aebea8bb48250956f04e61',
  balance: START_BALANCE
}]

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

function makeTestTx(hash, chainId, value, contractAddress, tokenId, confirms) {
  return {
    hash,
    nonce: 32,
    blockHash: '0x557c39f6cad68f0790e10493300b7f1cf0b0ec0e5869a2f27ac45bdeb7abd099',
    blockNumber: 2027,
    transactionIndex: 0,
    fromAddress: '0x91d48cc009bc27e712b356093d9f5088d8f81e3d',
    toAddress: '0x91d48cc009bc27e712b356093d9f5088d8f81e3a',
    value,
    input: '0xa9059cbb00000000000000000000000091d48cc009bc27e712b356093d9f5088d8' +
      'f81e3a000000000000000000000000000000000000000000000000000000000000000a',
    status: '1',
    timestamp: 1533293245,
    confirms,
    contractAddress,
    state: 'processed',
    tokenId,
    txType: 'reward',
    contractFunction: 'transfer',
    chainId
  }
}

class TestDatabaseConn {
  private testToken

  public async setup(existingToken, tempWalletAddress: string, brandAddress: string): Promise<void> {
    log.info(`Adding test token ${existingToken.symbol}.`)

    await setupDatabaseTables()

    const firstBrand = {
      legalName: 'MagicWorld'
    }
    await qbDB.models.brand.create(firstBrand)
    const newBrand = await qbDB.models.brand.find({where: {legalName: firstBrand.legalName}})
    await qbDB.models.brandAddress.create({ address: brandAddress, brandId: newBrand.id })

    existingToken.brandId = newBrand.id
    this.testToken = await qbDB.models.token.create(existingToken)

    // add non-deployed token
    const nonDeployedToken = JSON.parse(JSON.stringify(existingToken))
    delete nonDeployedToken.contractAddress
    nonDeployedToken.symbol = 'SDS'
    nonDeployedToken.name = 'Not deployed token'
    await qbDB.models.token.create(nonDeployedToken)

    await qbDB.models.tempExchangeWallet.create({
      address: tempWalletAddress
    })

    log.info('Successfully setup database.')
  }

  public async updateMinedStatus(tx, txReceipt, block, brandAddresses, chainId) {
    const storeable = makeStoreableTransaction(tx, txReceipt, block)
    storeable.chainId = chainId
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

  public async insertTransaction(tx) {
    await qbDB.models.transaction.create(tx)
  }

  public async close() {
    await qbDB.models.sequelize.close()
  }
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady,
  TestDatabaseConn,
  makeTestTx,
  ACCOUNTS
}
