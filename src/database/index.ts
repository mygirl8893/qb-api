import * as mysql from 'promise-mysql'
import Config from './config'
import { add } from "winston";

const env = process.env.NODE_ENV || 'development',
  dbConfig = Config[env]

const pool = mysql.createPool(dbConfig)

/*
  Security NOTE: node-mysql escapes the inputs if the '?' placeholder is used
  as documented here https://github.com/mysqljs/mysql#escaping-query-values
 */

const getTransactionHistory = async (address: string, limit: number, offset: number) => {

  const conn = await pool.getConnection()

  try {

    const transactions = await conn.query(`SELECT * from transactions
    JOIN tokens ON transactions.tokenId = tokens.id
    WHERE toAddress=? OR fromAddress=?
    ORDER BY blockNumber DESC LIMIT ? OFFSET ?`, [address, address, limit, offset])
    return transactions
  } finally {
    conn.release()
  }
}

interface PendingTransaction {
  hash: string
  fromAddress: string
  toAddress: string
  contractAddress: string
  state: string
}

const addPendingTransaction = async (transaction: PendingTransaction) => {

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

async function close() {
  await pool.end()
}

export default {
  getTransactionHistory,
  addPendingTransaction,
  close
}
