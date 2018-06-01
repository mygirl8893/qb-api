'use strict'

const config = require('../../config.js').getConfig
const Web3 = require('web3')
var web3 = new Web3(config.private.rpc)
const User = require('./userController.js')

exports.tokenDB = async () => {
  var contract = await new web3.eth.Contract(
    config.private.tokenDBABI,
    config.private.tokenDB,
    {}
  )

  return contract
}

/**
 * @swagger
 * /tokens:
 *   get:
 *     tags:
 *       - Tokens
 *     description: Returns a List of all Loyalty Tokens in the private ecosystem
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Users Wallet Address.
 *         in: query
 *         required: false
 *         type: string
 *       - name: public
 *         description: Add public Balances.
 *         in: query
 *         required: false
 *         type: boolean
 *     responses:
 *       200:
 *          description: Returns successfully a List of all Loyalty Tokens in the private ecosystem
 *       400:
 *          description: Request failed, see error message.
 */
/**
 * Returns a List of all Loyalty Tokens in the private ecosystem.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.list = async function(req, res) {
  var privateBalance = 0,
    publicBalance = 0

  privateBalance = await User.getBalance(req.query.from)

  if (req.query.public === 'true') {
    publicBalance = await User.getPublicBalance(req.query.from)
  }

  return res.json({
    private: privateBalance,
    public: publicBalance
  })
}

/**
 * @swagger
 * /tokens/{contract}:
 *   get:
 *     tags:
 *       - Tokens
 *     description: Returns a specific Loyalty Token in the private ecosystem
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: contract
 *         description: Contract Address.
 *         in: path
 *         required: true
 *         type: string
 *       - name: from
 *         description: Users Wallet Address.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: Returns successfully a specific Loyalty Token in the private ecosystem
 *       400:
 *          description: Request failed, see error message.
 */
/**
 * Returns a specific Loyalty Token in the private ecosystem
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.contract = async function(req, res) {
  var privateBalance = 0,
    publicBalance = 0

  privateBalance = await User.getBalanceOnContract(
    req.query.from,
    req.params.contract
  )

  return res.json({
    private: privateBalance,
    public: publicBalance
  })
}
