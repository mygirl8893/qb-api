import User from '../users/controller'
import Config from '../config'
import * as HttpStatus from "http-status-codes"
import utils from "../lib/utils"
import log from '../logging'

const web3 = Config.getPrivateWeb3()

const tokenDB = () => new web3.eth.Contract(
  Config.getTokenDBABI(),
  Config.getTokenDBAddress(),
  {}
).methods

const loyaltyToken = (contractAddress) => new web3.eth.Contract(
  Config.getTokenABI(),
  contractAddress,
  {}
).methods

const getTokens = async (req, res) => {
  let publicTokens = undefined
  const tokens = await utils.getTokens()
  for (const token of tokens) {
    let balance = await User.getBalance(req.query.from, token.contractAddress)
    delete token.id
    delete token.brandId
    token.balance = balance
    token.logoUrl = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
  }

  if (req.query.public) {
    publicTokens = [ await User.getQBXToken(req.query.from) ]
  }

  return res.json({
    private: tokens,
    public: publicTokens
  })
}

/**
 * Returns a specific Loyalty Token in the private ecosystem
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
const getToken = async (req, res) => {
  const contractAddress = req.params.contract
  if (!contractAddress)
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing input contractAddress.'})

  if (contractAddress === Config.getQBXAddress()) {
    const qbx = await User.getQBXToken()
    return res.json(qbx) //TODO: we should remove the 'private' property from here
  }

  try {
    const token = await utils.getToken(contractAddress)
    if (token) {
      const balance = await User.getBalance(req.query.from, contractAddress)
      delete token.id
      delete token.brandId
      token.balance = balance
      token.logoUrl = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
      return res.json({ private: token }) //TODO: we should remove the 'private' property from here
    } else {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Token has not been found'})
    }
  } catch (e) {
    if (utils.isInvalidWeb3AddressMessage(e.message, contractAddress.toLowerCase()) ||
        e.message.includes('is not a contract address')) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message})
    } else if (e.message.includes('Couldn\'t decode')) {
      const errorMessage = `Contract address ${contractAddress} is incorrect. error: ${e.message}`
      log.error(errorMessage)
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage})
    } else {
      throw e
    }
  }
}

export default {
  getToken,
  getTokens,
  tokenDB,
  loyaltyToken
}
