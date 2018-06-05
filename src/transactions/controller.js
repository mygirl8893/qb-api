import abiDecoder from 'abi-decoder'
import unsign from '@warren-bank/ethereumjs-tx-unsign'
import BigNumber from 'bignumber.js'

import Config from '../config'
import TokenController from '../tokens/controller'
import User from '../users/controller'

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
      ? BigNumber(decoded.params[1].value).toString(10)
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
const getHistory = async (req, res) => {
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
    const block = await web3.eth.getBlock(blockNumber, true) // eslint-disable-line no-await-in-loop
    if (block !== null && block.transactions !== null) {
      for (const tx of block.transactions) { // eslint-disable-line no-restricted-syntax
        const decodedTx = abiDecoder.decodeMethod(tx.input)
        if (typeof decodedTx !== 'undefined') {
          if (txBelongsTo(address, tx, decodedTx)) {
            // eslint-disable-next-line no-await-in-loop
            historyArray.push(await getTx(tx.hash)) // TODO: Promise.all()? NO, We want to keep the exact order...
          }
        }
      }
    }
  }
  return res.json(historyArray)
}

const transfer = async (req, res) => {
  abiDecoder.addABI(Config.getTokenABI())

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
  const txHash = await web3.utils.sha3(req.body.data, { encoding: 'hex' })
  const result = await web3.eth.sendSignedTransaction(req.body.data).then(
    receipt => ({ hash: txHash, status: 'pending', tx: receipt }),
    error => ({ hash: txHash, status: error.toString() }) // TODO: fix, not sending bback error
  )
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
  transfer
}
