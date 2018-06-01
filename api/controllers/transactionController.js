'use strict'

const config = require('../../config.js').getConfig
const token = require('./tokensController.js')
const User = require('./userController.js')
const Web3 = require('web3')
const abiDecoder = require('abi-decoder')
const async = require('async')
const unsign = require('@warren-bank/ethereumjs-tx-unsign')
var bigNumber = require('bignumber.js')
var web3 = new Web3(config.private.rpc)

exports.getInfo = async (txHash = null) => {
  const endBlockNumber = await web3.eth.getBlock('latest')
  var transactionReceipt = await web3.eth.getTransactionReceipt(
    txHash.toLowerCase()
  )
  var transaction = await web3.eth.getTransaction(txHash.toLowerCase())

  if (transaction === null) {
    return transactionReceipt
  }

  var blockInfo = await web3.eth.getBlock(transaction.blockNumber)

  abiDecoder.addABI(config.private.tokenABI)
  const decoded = abiDecoder.decodeMethod(transaction.input)

  transaction.status = transactionReceipt.status
  transaction.contract = transaction.to
  transaction.to = decoded.params[0].value
    ? decoded.params[0].value
    : transaction.to
  transaction.value = decoded.params[1].value
    ? bigNumber(decoded.params[1].value).toString(10)
    : transaction.value.toString(10)
  transaction.timestamp = blockInfo.timestamp
  transaction.confirms = endBlockNumber.number - transaction.blockNumber
  Reflect.deleteProperty(transaction, 'gas')
  Reflect.deleteProperty(transaction, 'gasPrice')
  Reflect.deleteProperty(transaction, 'v')
  Reflect.deleteProperty(transaction, 'r')
  Reflect.deleteProperty(transaction, 's')

  var toBalance = await User.getBalanceOnContract(
    transaction.to,
    transaction.contract
  )

  Reflect.deleteProperty(toBalance, 'balance')
  transaction.token = toBalance || null

  return transaction
}

exports.buildRaw = async (from, to, contractAddress, transferAmount) => {
  const contract = new web3.eth.Contract(
    config.private.tokenABI,
    contractAddress,
    {
      from
    }
  )

  const userInfo = await User.getInfo(from)
  var rawTransaction = {
    from,
    nonce: '0x' + userInfo.transactionCount.toString(16),
    gasPrice: web3.utils.toHex(0),
    gasLimit: web3.utils.toHex(1000000),
    to: contractAddress,
    value: '0x0',
    data: contract.methods.transfer(to, transferAmount).encodeABI(),
    chainId: config.private.chainId
  }

  return rawTransaction
}

exports.sendTransfer = async data => {
  var { txData } = unsign(data)
  console.log(data)
  console.log(txData)

  abiDecoder.addABI(config.private.tokenABI)
  const decoded = abiDecoder.decodeMethod(txData.data)
  console.log(decoded)
  var contract = await token.tokenDB()

  abiDecoder.addABI(config.private.tokenABI)

  var loyaltyToken = await contract.methods.getToken(txData.to).call()

  if (typeof loyaltyToken[0] === 'undefined' || decoded.name !== 'transfer') {
    throw new Error('loyaltyToken not found')
  } else {
    var txHash = web3.utils.sha3(data, { encoding: 'hex' })
    web3.eth.sendSignedTransaction(data).then(
      receipt => {
        var returnData = exports.getInfo(receipt.transactionHash)

        return returnData
      },
      error => ({ hash: txHash, status: error })
    )

    return { hash: txHash, status: 'pending' }
  }
}

exports.getHistory = async req => {
  const historyArray = []
  const defaultBlocks = 200
  const hash = req.params.hash.toLowerCase()
  const latestBlock = await web3.eth.getBlock('latest')
  const startBlock = req.query.startBlock >= 0 ? req.query.startBlock : 0
  const endBlock = req.query.endBlock > 0 ? req.query.endBlock : 0
  let endBlockNumber = endBlock || latestBlock.number
  let startBlockNumber = startBlock || endBlockNumber - defaultBlocks

  if (endBlockNumber > latestBlock.number) {
    endBlockNumber = latestBlock.number
  }

  if (startBlockNumber > latestBlock.number) {
    startBlockNumber = latestBlock.number - defaultBlocks
  }

  if (startBlockNumber < 0) {
    startBlockNumber = 0
  }

  abiDecoder.addABI(config.private.tokenABI)

  for (
    var blockNumber = startBlockNumber;
    blockNumber <= endBlockNumber;
    blockNumber++
  ) {
    var block = await web3.eth.getBlock(blockNumber, true)

    if (block !== null && block.transactions !== null) {
      async.forEach(block.transactions, async result => {
        const decoded = abiDecoder.decodeMethod(result.input)

        if (typeof decoded !== 'undefined') {
          if (
            result.from.toLowerCase() === hash ||
            result.to.toLowerCase() === hash ||
            decoded.params[0].value.toLowerCase() === hash
          ) {
            var transactionInfo = await exports.getInfo(result.hash)

            historyArray.push(await transactionInfo)
          }
        }
      })
    }
  }

  return historyArray
}

/**
 * @swagger
 * /transactions/{from}/history:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Get Transaction History of Wallet Address
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Users Wallet Address.
 *         in: path
 *         required: true
 *         type: string
 *       - name: startBlock
 *         description: Define from wich Block on it should check for transactions.
 *         in: query
 *         required: false
 *         type: integer
 *       - name: endBlock
 *         description: Define to wich Block on it should check for transactions.
 *         in: query
 *         required: false
 *         type: integer
 *     responses:
 *       200:
 *          description: Returns successfully Transaction History of Wallet Address
 *       400:
 *          description: Request failed, see error message.
 * @swagger
 * /transactions/{txHash}:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Get Transaction Information by Transaction Hash from to the private ecosystem
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: txHash
 *         description: Transaction Hash.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns successfully Transaction Information by Transaction Hash from to the private ecosystem
 *       400:
 *          description: Request failed, see error message.
 */
/**
 * hash length Proxy.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.hashProxy = async (req, res) => {
  var result =
    req.params.hash.length > 42
      ? await exports.getInfo(req.params.hash)
      : await exports.getHistory(req)

  return res.json(result)
}

/**
 * @swagger
 * /transactions:
 *   post:
 *     tags:
 *       - Transactions
 *     description: Send a signed transaction to the private ecosystem
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: data
 *         description: Blocknumber from where on it should check for transactions.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: desc
 */
/**
 * Send a signed transaction to the private ecosystem.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.transfer = async (req, res) => {
  var result = await exports.sendTransfer(req.body.data)

  return res.json(result)
}

/**
 * @swagger
 * /transactions/raw:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Build a raw Transaction
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Wallet Address to send Token from.
 *         in: query
 *         required: true
 *         type: string
 *       - name: to
 *         description: Wallet Address to send Token to.
 *         in: query
 *         required: true
 *         type: string
 *       - name: contractAddress
 *         description: Token Contract Address.
 *         in: query
 *         required: true
 *         type: string
 *       - name: transferAmount
 *         description: Amount of Tokens to transfer
 *         in: query
 *         required: true
 *         type: integer
 *     responses:
 *       200:
 *          description: desc
 */
/**
 * Send a signed transaction to the private ecosystem.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.buildRawTransaction = async (req, res) => {
  var result = await exports.buildRaw(
    req.query.from,
    req.query.to,
    req.query.contractAddress,
    req.query.transferAmount
  )

  return res.json(result)
}
