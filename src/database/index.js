import mysql from 'promise-mysql'
import Config from './config'

const env = process.env.NODE_ENV || 'development',
  dbConfig = Config[env]

const pool = mysql.createPool(dbConfig)

const getTransactionHistory = async (address) => {

  const conn = await pool.getConnection()

  // prevent SQL injections
  const escapedAddress = conn.escape(address)

  const transactions = await conn.query(`SELECT * from transactions
    JOIN tokens ON transactions.contractAddress = tokens.contractAddress
    WHERE toAddress=${escapedAddress} OR fromAddress=${escapedAddress}`)
  return transactions
}

const addPendingTransaction = async (transaction) => {
  const conn = await pool.getConnection()

  const r = await conn.query(`INSERT INTO transactions SET ?`, transaction)
  return r
}

export default {
  getTransactionHistory,
  addPendingTransaction
}
