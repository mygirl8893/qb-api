import * as _ from 'lodash'
import * as qbDB from 'qb-db-migrations'
import * as sequelize from 'sequelize'

const Token = qbDB.models.token
const Op = sequelize.Op

async function getQbxTransactionHistory(address: string, limit: number) {
  const allowedFields = ['blockNumber', 'timestamp', 'hash', 'nonce', 'blockHash', 'transactionIndex',
      'from', 'to', 'value', 'status', 'input', 'confirms', 'contractAddress', 'contractFunction']

  const dbHistory = await qbDB.models.mainnetTransaction.findAll({
    where: {
      $or: {
        toAddress: { $eq: address },
        fromAddress: { $eq: address }
      }
    },
    order: [['timestamp', 'DESC']],
    limit
  })
  const transactions = dbHistory.map((tx) => {
    tx.to = tx.toAddress
    tx.from = tx.fromAddress

    return _.pick(tx, allowedFields)
  })
  return transactions
}

async function getTransactions(limit: number, offset: number, symbol: string,
                               contractAddress: string,
                               walletAddress: string) {
  const tokenFilters = {}
  if (symbol) {
    // @ts-ignore
    tokenFilters.symbol = symbol
  }
  if (contractAddress) {
    // @ts-ignore
    tokenFilters.contractAddress = contractAddress
  }

  const txFilters = {}
  if (walletAddress) {
    // @ts-ignore
    txFilters.$or = {
      toAddress: { $eq: walletAddress },
      fromAddress: { $eq: walletAddress }
    }
  }

  const transactions = await qbDB.models.transaction.findAll({
    where: txFilters,
    order: [['timestamp', 'DESC'], ['blockNumber', 'DESC']],
    limit,
    offset,
    include: [{
      model: qbDB.models.token,
      where: {
        $and: tokenFilters
      }
    }]
  })
  return transactions
}

async function getTransactionHistory(address: string, limit: number, offset: number) {
  const transactions = await qbDB.models.transaction.findAll({
    where: {
      $or: {
        toAddress: { $eq: address },
        fromAddress: { $eq: address }
      }
    },
    order: [['timestamp', 'DESC'], ['blockNumber', 'DESC']],
    limit,
    offset,
    include: [qbDB.models.token]
  })
  return transactions
}

async function getTransaction(hash: string) {
  const transaction = await qbDB.models.transaction.find({
    where: {
      hash
    },
    include: [qbDB.models.token]
  })
  return transaction
}

interface PendingTransaction {
  hash: string
  fromAddress: string
  toAddress: string
  contractAddress: string
  state: string
}

/*
  Security NOTE: sequelize escapes the inputs if the '?' placeholder is used
 */

async function addPendingTransaction(transaction: PendingTransaction) {
  const keys = Object.keys(transaction)

  /* insert if the primary key (transaction hash) is not present; do nothing otherwise.
     if it's already there it means it was already synched to the database.
   */
  const r = await qbDB.models.sequelize.query(`INSERT IGNORE INTO transactions
    (${keys.join(',')})
    VALUES (${Array(keys.length).fill('?').join(',')})`, {
      replacements: keys.map((k) => transaction[k]),
      type: qbDB.models.sequelize.QueryTypes.INSERT
    })
  return r
}

async function getTokenByContractAddress(contractAddress: string) {
  const token = await Token.find({ where: { contractAddress }, raw: true })
  return token
}

async function getTokenBySymbol(symbol: string) {
  const token = await Token.find({ where: { symbol }, raw: true })
  return token
}

async function getTokens() {
  const tokens = await Token.findAll({
    where: {
      contractAddress: { [Op.ne]: null },
      hidden: false
    },
    raw: true,
  }
  )
  return tokens
}

async function getTempExchangeWallets() {
  const response = await qbDB.models.tempExchangeWallet.findAll({
    order: [['id', 'DESC']]
  })
  return response
}

async function getPublicOrOwnedTokens(walletAddress: string) {
  const response = await qbDB.models.sequelize.query(
    `SELECT tokens.* FROM tokens LEFT JOIN transactions ON
      (transactions.tokenId = tokens.id AND transactions.toAddress = ?) 
      WHERE (tokens.hidden = 0 OR transactions.id IS NOT NULL) 
        AND tokens.contractAddress IS NOT NULL GROUP BY tokens.id;`, {
      replacements: [walletAddress],
      type: qbDB.models.sequelize.QueryTypes.SELECT
    })

  return response
}

async function close() {
  await qbDB.models.sequelize.close()
}

export default {
  getQbxTransactionHistory,
  getTransaction,
  getTransactions,
  getTransactionHistory,
  addPendingTransaction,
  getTokenByContractAddress,
  getTokenBySymbol,
  getTokens,
  getTempExchangeWallets,
  getPublicOrOwnedTokens,
  close
}
