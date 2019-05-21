import * as abiDecoder from 'abi-decoder'
import { BigNumber } from 'bignumber.js'
import Config from '../config'
import database from '../database'

import tokenHelpers from '../tokens/helpers'

function toAPITransaction(transaction) {
  const status = transaction.status ?  Boolean(parseInt(transaction.status, 10)) : null

  const token = transaction.token ? tokenHelpers.toAPIToken(transaction.token) : null

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
  transaction.token = token ? tokenHelpers.toAPIToken(token) : null
  return transaction
}

export default  {
  toAPITransaction,
  getTx
}
