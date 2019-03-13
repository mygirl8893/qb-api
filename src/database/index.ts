import * as qbDB from 'qb-db-migrations'
import * as sequelize from 'sequelize'

const Token = qbDB.models.token
const Op = sequelize.Op

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
      toAddress: { $eq: walletAddress},
      fromAddress: { $eq: walletAddress}
    }
  }

  const transactions = await qbDB.models.transaction.findAll({
    where: {
      txType: {$ne: 'migration'},

    },
    order: [ ['blockNumber', 'DESC'] ],
    limit,
    offset,
    include: [{
      model: qbDB.models.token,
      where: {
        $and: tokenFilters
      }
    }]
  })
  formatTransactionsList(transactions)
  return transactions
}

async function getTransactionHistory(address: string, limit: number, offset: number) {
  const transactions = await qbDB.models.transaction.findAll({
    where: {
      $and: {
        txType: {$ne: 'migration'},
        $or: {
          toAddress: { $eq: address},
          fromAddress: { $eq: address}
        }
      }
    },
    order: [ ['blockNumber', 'DESC'] ],
    limit,
    offset,
    include: [qbDB.models.token]
  })
  formatTransactionsList(transactions)
  return transactions
}

function formatTransactionsList(transactions) {
  transactions.forEach((t) => {
    t.dataValues.to = t.toAddress
    delete t.dataValues.toAddress

    t.dataValues.from = t.fromAddress
    delete t.dataValues.fromAddress

    if (t.token) {
      delete t.token.dataValues.id
      delete t.token.dataValues.brandId
      delete t.token.dataValues.hidden
    }

    delete t.dataValues.confirms
  })
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
    raw: true }
  )
  return tokens
}

async function getTempExchangeWallets() {
  const response = await qbDB.models.tempExchangeWallet.findAll({
    order: [ ['id', 'DESC'] ]
  })
  return response
}

async function close() {
  await qbDB.models.sequelize.close()
}

export default {
  getTransaction,
  getTransactions,
  getTransactionHistory,
  addPendingTransaction,
  getTokenByContractAddress,
  getTokenBySymbol,
  getTokens,
  getTempExchangeWallets,
  close
}
