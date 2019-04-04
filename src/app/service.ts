import * as aesjs from 'aes-js'

import Config from '../config'

/**
 *
 * @param plainText string to encrypt
 *
 * Returns encrypted text hex
 */
async function encryptString(plainText): Promise<string> {
  const encryptionDecryptionKey = JSON.parse(Config.getEncryptionKey())

  const textBytes = aesjs.utils.utf8.toBytes(plainText)

  // counter is optional; if omitted will begin at 1
  const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionDecryptionKey, new aesjs.Counter(5))

  const encryptedBytes = aesCtr.encrypt(textBytes)

  const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes)

  return encryptedHex
}

export default {
  encryptString
}
