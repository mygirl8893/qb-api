import validation from '../validation'
import * as Joi from 'joi'
import database from '../database'
import User from '../users/controller'
import Config from '../config'
import log from "../logging";
import * as HttpStatus from 'http-status-codes'

const web3 = Config.getPrivateWeb3()

const getAddressSchema = Joi.object().keys({
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  })
})
async function getAddress(req, res) {
  req = validation.validateRequestInput(req, getAddressSchema)
  const address = req.params.address

  let transactionCount = null
  const tokenBalances = []
  let qbxBalance = null
  try {
    transactionCount = await web3.eth.getTransactionCount(address.toLowerCase())
    const tokens = await database.getTokens()
    for (const token of tokens) {
      let balance = await User.getBalance(address, token.contractAddress)

      tokenBalances.push({
        symbol: token.symbol,
        amount: balance,
        contractAddress: token.contractAddress
      })
    }

    qbxBalance = await User.getQBXToken(address)
  } catch (e) {
    if (validation.isInvalidWeb3AddressMessage(e.message, address.toLowerCase())) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }

  res.json({
    transactionCount: transactionCount,
    balances: {
      private: tokenBalances,
      public: [{
        symbol: qbxBalance.symbol,
        balance: qbxBalance.balance,
        contractAddress: qbxBalance.contractAddress
      }]
    }
  })
}

export default {
  getAddress
}
