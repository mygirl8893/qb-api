'use strict'

const config = require('../../config.js').getConfig
const utils = require('../utils/utils.js')
const token = require('./tokensController.js')
const Web3 = require('web3')
var bigNumber = require('bignumber.js')
var web3 = new Web3(config.private.rpc)
var web3pub = new Web3(config.public.rpc)

exports.getBalanceOnContract = async (from = null, contractHash) => {
  var itemcontract = new web3.eth.Contract(
    config.private.tokenABI,
    contractHash.toLowerCase(),
    {}
  )
  var balance =
    from === null
      ? 0
      : bigNumber(
          await itemcontract.methods.balanceOf(from.toLowerCase()).call()
        ).toString(10)
  var totalSupply = bigNumber(
    await itemcontract.methods.totalSupply().call()
  ).toString(10)

  return {
    contractAddress: contractHash.toLowerCase(),
    symbol: await itemcontract.methods.symbol().call(),
    name: await itemcontract.methods.name().call(),
    balance,
    totalSupply,
    decimals: parseInt(await itemcontract.methods.decimals().call(), 10)
  }
}

exports.getBalance = async from => {
  var contract = await token.tokenDB()

  return contract.methods
    .getTokens()
    .call()
    .then(async function(result) {
      var balances = []
      const getBalance = async () => {
        await utils.asyncForEach(result, async function(contractHash) {
          balances.push(await exports.getBalanceOnContract(from, contractHash))
        })

        return balances
      }

      return getBalance()
    })
}

exports.getPublicBalance = async (from = null) => {
  var itemcontract = new web3pub.eth.Contract(
    config.private.tokenABI,
    config.public.qbxContract,
    {}
  )
  var ethBalance =
    from === null ? 0 : await web3pub.eth.getBalance(from.toLowerCase())
  var balance =
    from === null
      ? 0
      : await itemcontract.methods.balanceOf(from.toLowerCase()).call()
  var totalSupply = await itemcontract.methods.totalSupply().call()

  return [
    {
      contractAddress: config.public.qbxContract,
      symbol: await itemcontract.methods.symbol().call(),
      name: await itemcontract.methods.name().call(),
      balance: bigNumber(balance).toString(10),
      totalSupply,
      decimals: parseInt(await itemcontract.methods.decimals().call(), 10)
    },
    {
      contractAddress: 'Ethereum',
      symbol: 'ETH',
      name: 'ETH',
      balance: bigNumber(ethBalance).toString(10),
      decimals: 18
    }
  ]
}

exports.getInfo = async (from = null) => {
  var transactionCount =
    from === null ? 0 : await web3.eth.getTransactionCount(from.toLowerCase())

  return {
    from,
    transactionCount: await transactionCount
  }
}

/**
 * @swagger
 * /users/{from}:
 *   get:
 *     tags:
 *       - Users
 *     description: Returns User Information on the private ecosystem
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Users Wallet Address.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns successfully User Information on the private ecosystem
 *       400:
 *          description: Request failed, see error message.
 */
/**
 * Returns User Information on the private ecosystem.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.info = async function(req, res) {
  var userInfo = await exports.getInfo(req.params.from)

  res.json(userInfo)
}
