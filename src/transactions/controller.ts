import * as abiDecoder from 'abi-decoder'
import unsign = require('@warren-bank/ethereumjs-tx-unsign')
import EthereumTx = require('ethereumjs-tx')
import  {BigNumber } from 'bignumber.js'

import Config from '../config'
import TokenController from '../tokens/controller'
import database from '../database'
import log from '../logging'
import * as HttpStatus from "http-status-codes";
import utils from "../lib/utils";

const web3 = Config.getPrivateWeb3()

const getTx = async (txHash) => {
  const endBlockNumber = await web3.eth.getBlock('latest'),
    transactionReceipt = await web3.eth.getTransactionReceipt(txHash.toLowerCase())

  const transaction = await web3.eth.getTransaction(txHash.toLowerCase())

  if (transaction === null) {
    return transactionReceipt
  }

  const blockInfo = await web3.eth.getBlock(transaction.blockNumber)
  abiDecoder.addABI(Config.getTokenABI())
  const decoded = abiDecoder.decodeMethod(transaction.input)

  transaction.status = transactionReceipt.status
  transaction.contract = transaction.to
  transaction.to =
    decoded && decoded.params[0] && decoded.params[0].value
      ? decoded.params[0].value
      : transaction.to
  transaction.value =
    decoded && decoded.params && decoded.params[1].value
      ? new BigNumber(decoded.params[1].value).toString(10)
      : transaction.value.toString(10)
  transaction.timestamp = blockInfo.timestamp
  transaction.confirms = endBlockNumber.number - transaction.blockNumber
  delete transaction.gas
  delete transaction.gasPrice
  delete transaction.v
  delete transaction.r
  delete transaction.s

  const token = await utils.getToken(transaction.contract)
  delete token.balance

  transaction.token = token || null
  return transaction
}

const txBelongsTo = (address, tx, decodedTx) => (
  tx.from.toLowerCase() === address ||
  tx.to.toLowerCase() === address ||
  decodedTx.params[0].value.toLowerCase() === address
)

const getTransaction = async (req, res) => {
  const tx = await getTx(req.params.hash)
  return res.json(tx) // TODO: improve response
}

const DEFAULT_HISTORY_LIMIT = 100
const MAX_HISTORY_LIMIT = 100

function isPositiveNumber(value) {
  return !isNaN(value) && value >= 0
}

const getHistory = async (req, res) => {
  let {limit = DEFAULT_HISTORY_LIMIT, offset = 0} = req.query

  limit = Math.min(limit, MAX_HISTORY_LIMIT) // cap it

  limit = parseInt(limit)
  offset = parseInt(offset)
  if (!isPositiveNumber(limit)) {
    return res.status(HttpStatus.BAD_REQUEST).json({ message: 'limit parameter is not a positive number.'})
  }
  if (!isPositiveNumber(offset)) {
    return res.status(HttpStatus.BAD_REQUEST).json({ message: 'offset parameter is not a positive number.'})
  }

  const address = req.params.address.toLowerCase()
  log.info(`Fetching transaction history for address ${address} with limit ${limit} and offset ${offset}`)

  const history = await database.getTransactionHistory(address, limit, offset)


  return res.json(history)
}

const transfer = async (req, res) => {
  abiDecoder.addABI(Config.getTokenABI())

  try {

    if (!req.body.data) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing data field.' })
    }
    const signedTransaction = new EthereumTx(req.body.data)
    const sender = `0x${signedTransaction.getSenderAddress().toString('hex')}`

    const { txData } = unsign(req.body.data)
    const decodedTx = abiDecoder.decodeMethod(txData.data)
    const toAddress = decodedTx.params[0].value
    const Token = TokenController.tokenDB()

    const loyaltyToken = await Token.getToken(txData.to).call()

    if (
      typeof loyaltyToken[0] === 'undefined' ||
      (decodedTx && decodedTx.name !== 'transfer')
    ) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Loyalty Token not found' }) // TODO: use Error object
    }

    const sendSignedTransactionPromise = web3.eth.sendSignedTransaction(req.body.data)

    const transactionHash = await new Promise((resolve, reject) => {
      sendSignedTransactionPromise.once('transactionHash', txHash => {
        resolve(txHash)
      })
      sendSignedTransactionPromise.on('error', error => {
        reject(error)
      })
    })

    log.info(`Successfully sent transaction  with hash ${transactionHash}`)

    const storeableTransaction = {
      hash: transactionHash as string,
      fromAddress: sender,
      toAddress: toAddress,
      contractAddress: txData.to,
      state: 'pending'
    }

    await database.addPendingTransaction(storeableTransaction)

    const result = { hash: transactionHash, status: 'pending'}

    return res.json(result)

  } catch (e) {
    if (e.message.includes(`the tx doesn't have the correct nonce.`) ||
      e.message.includes(`is not a contract address`)) {
      log.error(e)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }

}

const buildRawTransaction = async (req, res) => {
  const { from, to, contractAddress, transferAmount } = req.query

  if (!from || !to || !contractAddress || !transferAmount) {
    return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing one or more query params.' })
  }

  try {
    const Token = new web3.eth.Contract(Config.getTokenABI(), contractAddress, {
      from
    }).methods

    const txCount = await web3.eth.getTransactionCount(from, 'pending')

    // TODO: return a real unsigned transaction and not just a JSON file.
    return res.json({
      from,
      nonce: `0x${txCount.toString(16)}`,
      gasPrice: web3.utils.toHex(0),
      gasLimit: web3.utils.toHex(1000000),
      to: contractAddress,
      value: '0x0',
      data: Token.transfer(to, transferAmount).encodeABI(),
      chainId: Config.getChainID()
    })

  } catch (e) {
    if (utils.isInvalidWeb3AddressMessage(e.message, contractAddress)) {
      const errorMessage = `Contract address invalid: ${e.message}`
      log.error(errorMessage)
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage})
    } else if (utils.isInvalidWeb3AddressMessage(e.message, from.toLowerCase())) {
      const errorMessage = `Transaction From address invalid: ${e.message}`
      log.error(errorMessage)
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage})
    } else {
      throw e
    }
  }
}

export default {
  buildRawTransaction,
  getTransaction,
  getHistory,
  transfer,
}
