import * as aesjs from 'aes-js'
import axios from 'axios'
import * as _ from 'lodash'

import Config from '../config'
import Database from '../database'

const baseEtherscanUrl = Config.getEtherscanUrl()
const encryptionDecryptionKey = JSON.parse(Config.getInfuraEncryptionKey())
const etherscanApiKey = Config.getEtherscanApiKey()

const publicHistoryAllowedFields = ['blockNumber', 'timestamp', 'hash', 'nonce', 'blockHash',
  'from', 'to', 'value', 'status', 'contractAddress', 'token.symbol']

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
  const etherscanUrl = baseEtherscanUrl +
    `/api?module=account&action=txlist&address=${wallet}&apikey=${etherscanApiKey}&sort=desc`

  try {
    // tslint:disable-next-line:no-string-literal
    const transactionHistory = (await axios.get(etherscanUrl))['data']['result']
    const transferTransactions = transactionHistory.filter((tx) => parseInt(tx.value, 10) > 0)

    const ethHistory = transferTransactions
      .slice(0, limit)
      .map((tx) => {
        tx.blockNumber = parseInt(tx.blockNumber, 10)
        tx.token = { symbol: 'ETH' }
        tx.timestamp = parseInt(tx.timeStamp, 10)
        tx.nonce = parseInt(tx.nonce, 10)
        // tslint:disable-next-line:triple-equals
        tx.status = tx.txreceipt_status == '1' ? true : false

        return _.pick(tx, publicHistoryAllowedFields)
      })

    return ethHistory
  } catch (err) {
    throw err
  }
}

async function getQbxTxHistory(wallet: string, limit: number = 1000) {
  const qbxHistory = await Database.getQbxTransactionHistory(wallet, limit)
  return qbxHistory.map((tx) => {
    tx.token = { symbol: 'QBX' }
    // tslint:disable-next-line:triple-equals
    tx.status = tx.status == '1' ? true : false

    return _.pick(tx, publicHistoryAllowedFields)
  })
}

export default {
  encryptString,
  getEthTxHistory,
  getQbxTxHistory
}
