import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import Config from '../config'
import database from '../database'
import log from '../logging'
import User from '../users/controller'
import validation from '../validation'

const web3 = Config.getPrivateWeb3()

const getAddressSchema = Joi.object().keys({
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  }),
  query: Joi.object().keys({
    public: Joi.boolean().optional().default(false)
  })
})
async function getAddress(req, res) {
  req = validation.validateRequestInput(req, getAddressSchema)
  const address = req.params.address

  let transactionCount = null
  const tokenBalances = {}
  let qbxBalance = null
  let publicEthBalance = 0
  try {
    transactionCount = await web3.eth.getTransactionCount(address.toLowerCase())
    const tokens = await database.getTokens()
    for (const token of tokens) {
      if (token.hidden) {
        continue
      }

      const balance = await User.getBalance(address, token.contractAddress)

      tokenBalances[token.symbol] = {
        balance,
        contractAddress: token.contractAddress
      }
    }

    if (req.query.public) {
      qbxBalance = await User.getQBXToken(address)
      publicEthBalance = await User.getETHBalance(address)
    }
  } catch (e) {
    if (validation.isInvalidWeb3AddressMessage(e.message, address.toLowerCase())) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }

  const response = {
    transactionCount,
    balances: {
      private: tokenBalances,
      public: undefined
    }
  }

  if (req.query.public) {
    response.balances.public = {}
    response.balances.public[qbxBalance.symbol] = {
      balance: qbxBalance.balance,
      contractAddress: qbxBalance.contractAddress
    }
    response.balances.public.ETH = { balance: publicEthBalance }
  }

  res.json(response)
}

export default {
  getAddress
}
