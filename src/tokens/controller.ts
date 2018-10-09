import User from '../users/controller'
import Config from '../config'
import * as HttpStatus from "http-status-codes"
import * as qbDB from 'qb-db-migrations'
import utils from "../lib/utils"
import log from '../logging'

const Token = qbDB.models.token
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

const getTokensFromDB = async (tokens) => {
  let dbTokens = await Token.findAll({ raw: true })
  return dbTokens
}

const getTokenFromDB = async (contractAddress) => {
  return await Token.find({ where: { contractAddress }, raw: true })
}

const getTokens = async (req, res) => {
  let publicTokens= undefined
  const privateTokens = await User.getTokensFromBlockchain(req.query.from)
  const dbTokens = await getTokensFromDB(privateTokens)
  for (const token of privateTokens) {
    let tdb = dbTokens.find((t) =>
      t.contractAddress.toLowerCase() == token.contractAddress.toLowerCase())
    if (tdb) {
      token.rate = tdb.rate
      token.description = tdb.description
      token.website = tdb.website
      token.logoUrl = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
    }
  }

  if (req.query.public) {
    publicTokens = await User.getPublicTokens(req.query.from)
  }

  return res.json({
    private: privateTokens,
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
  const publicBalance = 0

  const contractAddress = req.params.contract

  if (!contractAddress) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing input contractAddress.'})
  }
  try {
    const privateToken = await User.getTokenByContract(
      req.query.from,
      contractAddress
    )
    const token = await getTokenFromDB(contractAddress)
    if (token) {
      privateToken.rate = token.rate
      privateToken.description = token.description
      privateToken.website = token.website
      privateToken.logoUrl = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
    }

    return res.json({
      private: privateToken,
      public: publicBalance
    })
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
