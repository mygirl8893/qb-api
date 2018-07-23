import * as abiDecoder from 'abi-decoder'
import unsign = require('@warren-bank/ethereumjs-tx-unsign')
import EthereumTx = require('ethereumjs-tx')
import  {BigNumber } from 'bignumber.js'

import Config from '../config'
import TokenController from '../tokens/controller'
import User from '../users/controller'
import database from '../database'
import log from '../logging'

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

  const toBalance = await User.getBalanceOnContract(
    transaction.to,
    transaction.contract
  )
  delete toBalance.balance

  transaction.token = toBalance || null
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

/*
 * DISCLAIMER: this method is inefficient as it has to go through
 * all the blocks and get the transactions. We will implement an
 * off-chain solution with a database to improve its performance.
 * We also have to take into considerations transactions happening
 * on the public chain.
 */
const getHistoryFromPrivateChain = async (req, res) => {
  const defaultBlocks = 200, // TODO: make it a constant
    address = req.params.address.toLowerCase(),
    latestBlock = await web3.eth.getBlock('latest'),
    startBlock = req.query.startBlock >= 0 ? req.query.startBlock : 0,
    endBlock = req.query.endBlock > 0 ? req.query.endBlock : 0,
    historyArray = []
  let endBlockNumber = endBlock || latestBlock.number,
    startBlockNumber = startBlock || endBlockNumber - defaultBlocks

  abiDecoder.addABI(Config.getTokenABI())

  if (endBlockNumber > latestBlock.number) {
    endBlockNumber = latestBlock.number
  }

  if (startBlockNumber > latestBlock.number) {
    startBlockNumber = latestBlock.number
  }

  if (startBlockNumber < 0) {
    startBlockNumber = 0
  }

  for (
    let blockNumber = startBlockNumber;
    blockNumber <= endBlockNumber;
    blockNumber += 1
  ) {
    const block = await web3.eth.getBlock(blockNumber, true)
    if (block !== null && block.transactions !== null) {
      for (const tx of block.transactions) {
        const decodedTx = abiDecoder.decodeMethod(tx.input)
        if (typeof decodedTx !== 'undefined') {
          if (txBelongsTo(address, tx, decodedTx)) {
            historyArray.push(await getTx(tx.hash)) // TODO: Promise.all()? NO, We want to keep the exact order...
          }
        }
      }
    }
  }
  return res.json(historyArray)
}

const getHistory = async (req, res) => {
  const address = req.params.address.toLowerCase()
  log.info(`Fetching transaction history for address ${address}`)

  const history = await database.getTransactionHistory(address)

  history.forEach((t) => {
    t.to = t.toAddress
    delete t.toAddress

    t.from = t.fromAddress
    delete t.fromAddress

    t.token = {
      contractAddress: t.contractAddress,
      name: t.name,
      rate: t.rate,
      symbol: t.symbol,
      totalSupply: t.totalSupply,
      decimals: t.decimals
    }

    delete t.contractAddress
    delete t.name
    delete t.rate
    delete t.symbol
    delete t.totalSupply
    delete t.decimals
  })

  return res.json(history)
}

const transfer = async (req, res) => {
  abiDecoder.addABI(Config.getTokenABI())

  const signedTransaction = new EthereumTx(req.body.data)
  const sender = `0x${signedTransaction.getSenderAddress().toString('hex')}`

  const { txData } = unsign(req.body.data),
    decodedTx = abiDecoder.decodeMethod(txData.data),
    Token = TokenController.tokenDB(),
    loyaltyToken = await Token.getToken(txData.to).call()

  if (
    typeof loyaltyToken[0] === 'undefined' ||
    (decodedTx && decodedTx.name !== 'transfer')
  ) {
    return res.json({ error: 'Loyalty Token not found' }) // TODO: use Error object
  }

  const receipt = await web3.eth.sendSignedTransaction(req.body.data)

  const storeableTransaction = {
    hash: receipt.transactionHash,
    fromAddress: sender,
    toAddress: decodedTx.params[0].value,
    contractAddress: txData.to,
    state: 'pending'
  }
  await database.addPendingTransaction(storeableTransaction)

  const result = { hash: receipt.transactionHash, status: 'pending', tx: receipt }

  return res.json(result)
}

// TODO: should be POST maybe
const buildRawTransaction = async (req, res) => {
  const { from, to, contractAddress, transferAmount } = req.query
  const Token = new web3.eth.Contract(Config.getTokenABI(), contractAddress, {
    from
  }).methods,
    txCount = (await web3.eth.getTransactionCount(from)).toString(16)

  // TODO: return a real unsigned transaction and not just a JSON file.
  return res.json({
    from,
    nonce: `0x${txCount}`,
    gasPrice: web3.utils.toHex(0),
    gasLimit: web3.utils.toHex(1000000),
    to: contractAddress,
    value: '0x0',
    data: Token.transfer(to, transferAmount).encodeABI(),
    chainId: Config.getChainID()
  })
}

export default {
  buildRawTransaction,
  getTransaction,
  getHistory,
  transfer,
}
