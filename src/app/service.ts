import * as aesjs from 'aes-js'
import axios from 'axios'
import Config from '../config'

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

async function getEthTxHistory(wallet: string) {
  const etherscanUrl = `http://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&sort=desc`
  try {
    // tslint:disable-next-line:no-string-literal
    const transactionHistory = (await axios.get(etherscanUrl))['data']['result']
    const transferTransactions = transactionHistory.filter((tx) => parseInt(tx.value, 10) > 0)
    return transferTransactions
  } catch (err) {
    throw err
  }
}

export default {
  encryptString,
  getEthTxHistory
}
