import * as aesjs from 'aes-js'
import axios from 'axios'

import Config from '../config'
import Database from '../database'

const encryptionDecryptionKey = JSON.parse(Config.getInfuraEncryptionKey())

/**
 *
 * @param plainText string to encrypt
 *
 * Returns encrypted text hex
 */
async function encryptString(plainText): Promise<string> {

  const textBytes = aesjs.utils.utf8.toBytes(plainText)

  // counter is optional; if omitted will begin at 1
  const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionDecryptionKey, new aesjs.Counter(5))

  const encryptedBytes = aesCtr.encrypt(textBytes)

  const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes)

  return encryptedHex
}

async function getEthTxHistory(wallet: string, limit: number = 1000) {
  const etherscanUrl = `http://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&sort=desc`
  try {
    // tslint:disable-next-line:no-string-literal
    const transactionHistory = (await axios.get(etherscanUrl))['data']['result']
    const transferTransactions = transactionHistory.filter((tx) => parseInt(tx.value, 10) > 0)
    return transferTransactions.slice(0, limit)
  } catch (err) {
    throw err
  }
}

async function getQbxTxHistory(wallet: string, limit: number = 1000) {
  const qbxHistory = await Database.getQbxTransactionHistory(wallet, limit)
  return qbxHistory
}

export default {
  encryptString,
  getEthTxHistory,
  getQbxTxHistory
}
