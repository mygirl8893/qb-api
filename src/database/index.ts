import * as sequelize from 'sequelize'
import * as qbDB from 'qb-db-migrations'

const Token = qbDB.models.token
const Op = sequelize.Op;

const getTransactionHistory = async (address: string, limit: number, offset: number) => {
  const transactions = await qbDB.models.transaction.findAll({
    where: {
      $or: {
        toAddress: { $eq: address},
        fromAddress: { $eq: address},
      }
    },
    order: [ ['blockNumber', 'DESC'] ],
    limit: limit,
    offset: offset,
    include: [qbDB.models.token]
  })

  transactions.forEach((t) => {
    t.dataValues.to = t.toAddress
    delete t.dataValues.toAddress

    t.dataValues.from = t.fromAddress
    delete t.dataValues.fromAddress

    if (t.token) {
      delete t.token.dataValues.id
      delete t.token.dataValues.brandId
    }

    delete t.dataValues.confirms
  })

  return transactions
}

const getTransaction = async (hash: string) => {
  const transaction = await qbDB.models.transaction.findAll({
    where: {
      hash: hash,
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

const addPendingTransaction = async (transaction: PendingTransaction) => {
  const keys = Object.keys(transaction)

  /* insert if the primary key (transaction hash) is not present; do nothing otherwise.
     if it's already there it means it was already synched to the database.
   */
  const r = await qbDB.models.sequelize.query(`INSERT IGNORE INTO transactions
    (${keys.join(',')})
    VALUES (${Array(keys.length).fill('?').join(',')})`, {
    replacements: keys.map(k => transaction[k]),
    type: qbDB.models.sequelize.QueryTypes.INSERT
  })
  return r
}

const getToken = async (contractAddress) => {
  return await Token.find({ where: { contractAddress }, raw: true })
}

const getTokens = async () => {
  return await Token.findAll({
    where: {
      contractAddress: { [Op.ne]: null }
    },
    raw: true }
  )
}

async function close() {
  await qbDB.models.sequelize.close()
}

export default {
  getTransaction,
  getTransactionHistory,
  addPendingTransaction,
  getToken,
  getTokens,
  close
}
