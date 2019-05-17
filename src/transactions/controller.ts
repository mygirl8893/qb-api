import unsign = require('@warren-bank/ethereumjs-tx-unsign')
import * as abiDecoder from 'abi-decoder'
import {BigNumber } from 'bignumber.js'
import EthereumTx = require('ethereumjs-tx')
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'

import Config from '../config'
import database from '../database'
import exchangeTxValidation from '../lib/exchangeTxValidation'
import formatting from '../lib/formatting'
import publicBlockchain from '../lib/publicBlockchain'
import qbxFeeCalculator from '../lib/qbxFeeCalculator'
import utils from '../lib/utils'
import log from '../logging'
import validation from '../validation'

const web3 = Config.getPrivateWeb3()

function toAPITransaction(transaction) {
  const status = transaction.status ?  Boolean(parseInt(transaction.status, 10)) : null

  const token = transaction.token ? formatting.toAPIToken(transaction.token) : null

  return {
    to: transaction.toAddress,
    from: transaction.fromAddress,
    contract: transaction.contractAddress,
    blockHash: transaction.blockHash,
    blockNumber: transaction.blockNumber,
    confirms: transaction.confirms,
    hash: transaction.hash,
    input: transaction.input,
    nonce: transaction.nonce,
    state: transaction.state,
    status,
    timestamp: transaction.timestamp,
    transactionIndex: transaction.transactionIndex,
    value: transaction.value,
    txType: transaction.txType,
    contractFunction: transaction.contractFunction,
    token
  }
}

async function getTx(txHash, sourceWeb3) {
  const endBlockNumber = await sourceWeb3.eth.getBlock('latest')
  const transactionReceipt = await sourceWeb3.eth.getTransactionReceipt(txHash.toLowerCase())

  const transaction = await sourceWeb3.eth.getTransaction(txHash.toLowerCase())

  if (transaction === null) {
    return transactionReceipt
  }

  const blockInfo = await sourceWeb3.eth.getBlock(transaction.blockNumber)
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

  const token = await database.getTokenByContractAddress(transaction.contract)
  transaction.token = token ? formatting.toAPIToken(token) : null
  return transaction
}

const getTransactionSchema = Joi.object().keys({
  params: Joi.object().keys({
    hash: validation.ethereumHash().required()
  })
})
async function getTransaction(req, res) {
  req = validation.validateRequestInput(req, getTransactionSchema)

  const storedTx = await database.getTransaction(req.params.hash)

  if (storedTx && storedTx.state !== 'pending') {

    const oldChainId = Config.getOldChainID()
    if (oldChainId && storedTx.chainId && `${storedTx.chainId}` === oldChainId) {
      log.info(`Fetching old chain transaction ${req.params.hash} from the database.`)
      const oldChainTx = toAPITransaction(storedTx)
      delete oldChainTx.contractFunction
      delete oldChainTx.txType
      return res.json(oldChainTx)
    }

    const tx = await getTx(req.params.hash, web3)
    tx.state = 'processed'
    return res.json(tx)
  } else {
    if (storedTx) {
      log.error(`Transaction ${req.params.hash} is in pending state.`)
    } else {
      log.error(`Transaction ${req.params.hash} does not exist.`)
    }
    res.status(HttpStatus.NOT_FOUND).json({message: `Transaction does not exist.`})
  }
}

const DEFAULT_HISTORY_LIMIT = 100
const MAX_HISTORY_LIMIT = 100

const getTransactionsSchema = Joi.object().keys({
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).default(DEFAULT_HISTORY_LIMIT),
    offset: Joi.number().integer().min(0).default(0),
    symbol: Joi.string().max(64).example('QBX'),
    contractAddress: validation.ethereumAddress(),
    wallet: validation.ethereumAddress()
  })
})
async function getTransactions(req, res) {
  req = validation.validateRequestInput(req, getTransactionsSchema)
  const { offset, symbol, contractAddress, wallet } = req.query
  let { limit } = req.query
  limit = Math.min(limit, MAX_HISTORY_LIMIT) // cap it
  const dbHistory = await database.getTransactions(limit, offset, symbol, contractAddress, wallet)
  const history = dbHistory.map((t) => {
    const apiTx = toAPITransaction(t)
    // @ts-ignore
    apiTx.contractAddress = apiTx.contract
    delete apiTx.contract
    return apiTx
  })
  return res.json(history)
}

const getHistorySchema = Joi.object().keys({
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).default(DEFAULT_HISTORY_LIMIT),
    offset: Joi.number().integer().min(0).default(0)
  }),
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  })
})
async function getHistory(req, res) {
  req = validation.validateRequestInput(req, getHistorySchema)
  const offset = req.query.offset
  let limit = req.query.limit
  limit = Math.min(limit, MAX_HISTORY_LIMIT) // cap it

  const address = req.params.address.toLowerCase()
  log.info(`Fetching transaction history for address ${address} with limit ${limit} and offset ${offset}`)

  const dbHistory = await database.getTransactionHistory(address, limit, offset)
  const history = dbHistory.map((t) => {
    const apiTx = toAPITransaction(t)
    // @ts-ignore
    apiTx.contractAddress = apiTx.contract
    delete apiTx.contract
    return apiTx
  })
  return res.json(history)
}

const transferSchema = Joi.object().keys({
  body: Joi.object().keys({
    data: Joi.string().required()
  })
})
async function transfer(req, res) {
  req = validation.validateRequestInput(req, transferSchema)

  abiDecoder.addABI(Config.getTokenABI())

  try {
    const signedTransaction = new EthereumTx(req.body.data)
    const sender = `0x${signedTransaction.getSenderAddress().toString('hex')}`
    const { txData } = unsign(req.body.data)
    const decodedTx = abiDecoder.decodeMethod(txData.data)
    const toAddress = decodedTx.params[0].value

    if (sender.toLowerCase() === toAddress.toLowerCase()) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: `Cannot transfer funds to own wallet at ${toAddress}`
      })
    }

    const loyaltyToken = await database.getTokenByContractAddress(txData.to)

    const validationResponse = await exchangeTxValidation.validateExchangeTx(loyaltyToken, toAddress, decodedTx)
    if (!validationResponse.valid) {
      return res.status(validationResponse.errorResponseCode)
        .json({ message: validationResponse.errorResponseMessage })
    }

    if (!loyaltyToken ||
      (decodedTx && decodedTx.name !== 'transfer')
    ) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Loyalty Token not found' }) // TODO: use Error object
    }

    const sendSignedTransactionPromise = web3.eth.sendSignedTransaction(req.body.data)
    const transactionHash = await new Promise((resolve, reject) => {
      sendSignedTransactionPromise.once('transactionHash', (txHash) => {
        resolve(txHash)
      })
      sendSignedTransactionPromise.on('error', (error) => {
        reject(error)
      })
    })
    log.info(`Successfully sent transaction  with hash ${transactionHash}`)

    const storeableTransaction = {
      hash: transactionHash as string,
      fromAddress: sender,
      toAddress,
      contractAddress: txData.to,
      state: 'pending',
      chainId: Config.getChainID()
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

const buildRawTransactionSchema = Joi.object().keys({
  query: Joi.object().keys({
    from: validation.ethereumAddress().required(),
    to: validation.ethereumAddress().required(),
    contractAddress: validation.ethereumAddress(),
    symbol: Joi.string().min(1).max(64).example('QBX'),
    transferAmount: validation.bigPositiveIntAsString().required()
  }).or('contractAddress', 'symbol')
})
async function buildRawTransaction(req, res) {
  req = validation.validateRequestInput(req, buildRawTransactionSchema)
  const { from, to, symbol, transferAmount } = req.query
  let contractAddress = req.query.contractAddress
  try {
    if (contractAddress && symbol) {
      const errorMessage = `Cannot refer to token by both contractAddress
                            and symbol at the same time. Use one or the other.`
      log.error(errorMessage)
      return res.status(HttpStatus.BAD_REQUEST).json({message: errorMessage})
    }

    if (!contractAddress) {
      const storedToken = await database.getTokenBySymbol(symbol)
      if (!storedToken) {
        return res.status(HttpStatus.NOT_FOUND).json({message: `Token with symbol ${symbol} not found.`})
      }
      contractAddress = storedToken.contractAddress
    }
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
    if (validation.isInvalidWeb3AddressMessage(e.message, contractAddress)) {
      const errorMessage = `Contract address invalid: ${e.message}`
      log.error(errorMessage)
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage})
    } else if (validation.isInvalidWeb3AddressMessage(e.message, from.toLowerCase())) {
      const errorMessage = `Transaction From address invalid: ${e.message}`
      log.error(errorMessage)
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage})
    } else {
      throw e
    }
  }
}

const getQBXExchangeValuesSchema = Joi.object().keys({
  query: Joi.object().keys({
    symbol: Joi.string().min(1).max(64).example('QBX').required(),
    transferAmount: validation.bigPositiveIntAsString().required()
  })
})
async function getQBXExchangeValues(req, res) {
  req = validation.validateRequestInput(req, getQBXExchangeValuesSchema)
  const transferAmount = req.query.transferAmount
  const symbol = req.query.symbol
  log.info(`Fething QBX exchange values for ${transferAmount} ${symbol} tokens.`)
  const loyaltyToken = await database.getTokenBySymbol(symbol)
  const tempExchangeWallets = await database.getTempExchangeWallets()
  const activeTempExchangeWallet = tempExchangeWallets[0].address
  log.info(`Active exchange wallet address is ${activeTempExchangeWallet}`)
  const txLoyaltyTokenValue = new BigNumber(transferAmount)
  const { conservativeGasEstimate } = await publicBlockchain.estimateTxGas(activeTempExchangeWallet)

  const rate = qbxFeeCalculator.getRate(loyaltyToken)
  const qbxTxValueComputationData =
    await qbxFeeCalculator.pullDataAndCalculateQBXTxValue(txLoyaltyTokenValue, rate,
      conservativeGasEstimate, loyaltyToken.fiatBacked)
  const values = {
    // percentage, qbxFeeAmount, gasFee and final receive value
    qbxFeeAmount: qbxTxValueComputationData.qbxTxValueAndFees.qbxFee.toFixed(),
    qbxFeePercentage: qbxFeeCalculator.QBX_FEE_DISPLAY_PERCENTAGE.toFixed(),
    qbxValueReceived: qbxTxValueComputationData.qbxTxValueAndFees.qbxTxValue.toFixed(),
    costOfGasInQBX: qbxTxValueComputationData.qbxTxValueAndFees.costOfGasInQBX.toFixed(),
    exchangeWalletAddress: activeTempExchangeWallet,
    loyaltyTokenToQBXRate: !loyaltyToken.fiatBacked ? loyaltyToken.rate : undefined
  }

  return res.json(values)
}

export default {
  buildRawTransaction,
  getTransaction,
  getTransactions,
  getHistory,
  getQBXExchangeValues,
  transfer
}
