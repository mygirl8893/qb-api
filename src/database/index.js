import mysql from 'promise-mysql'
import Config from './config'

const env = process.env.NODE_ENV || 'development',
  dbConfig = Config[env]

const pool = mysql.createPool(dbConfig)

const getTransactionHistory = async (address) => {

  const conn = await pool.getConnection()

  try {
    // prevent SQL injections
    const escapedAddress = conn.escape(address)

    const transactions = await conn.query(`SELECT * from transactions
    JOIN tokens ON transactions.contractAddress = tokens.contractAddress
    WHERE toAddress=${escapedAddress} OR fromAddress=${escapedAddress}
    ORDER BY blockNumber DESC`)
    return transactions
  } finally {
    conn.release()
  }
}

const addPendingTransaction = async (transaction) => {

  const conn = await pool.getConnection()
  try {
    /* insert if the primary key (transaction hash) is not present; do nothing otherwise.
       if it's already there it means it was already synched to the database.
     */
    const r = await conn.query(`INSERT IGNORE INTO transactions SET ?`, transaction)
    return r
  } finally {
    conn.release()
  }
}

export default {
  getTransactionHistory,
  addPendingTransaction
}
