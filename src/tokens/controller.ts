import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import Config from '../config'
import database from '../database'
import log from '../logging'
import User from '../users/controller'
import validation from '../validation'
import helpers from './helpers'

const web3 = Config.getPrivateWeb3()

const loyaltyToken = (contractAddress) => new web3.eth.Contract(
  Config.getTokenABI(),
  contractAddress,
  {}
).methods


const getTokensSchema = Joi.object().keys({
  params: Joi.object().keys({
    walletAddress: validation.ethereumAddress(),
    from: validation.ethereumAddress()
  })
})

async function getTokens(req, res) {
  req = validation.validateRequestInput(req, getTokensSchema)

  const walletAddress = req.query.walletAddress
  let ownedTokenIds = []
  if (walletAddress) {
    log.info(`Requesting tokens with walletAddress = ${walletAddress}`)
    const ownedTokens = await database.getOwnedTokens(walletAddress)
    ownedTokenIds = ownedTokens.map(t => t.id)
  }

  let publicTokens
  const tokens = await database.getTokens()
  const apiTokens = []
  for (const token of tokens) {

    // @ts-ignore
    if (token.hidden && !ownedTokenIds.includes(token.id)) {
      continue
    }

    const balance = await User.getBalance(req.query.from, token.contractAddress)

    const apiToken = helpers.toAPIToken(token)
    // tslint:disable-next-line
    apiToken['balance'] = balance
    // tslint:disable-next-line
    apiToken['logoUrl'] = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
    apiTokens.push(apiToken)
  }

  if (req.query.public) {
    publicTokens = [ await User.getQBXToken(req.query.from) ]
  }

  return res.json({
    private: apiTokens,
    public: publicTokens
  })
}

const getTokenSchema = Joi.object().keys({
  params: Joi.object().keys({
    contract: validation.ethereumAddress().required()
  }),
  query: Joi.object().keys({
    from: validation.ethereumAddress().alphanum()
  })
})

/**
 * Returns a specific Loyalty Token in the private ecosystem
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
async function getToken(req, res) {
  req = validation.validateRequestInput(req, getTokenSchema)
  const contractAddress = req.params.contract
  if (!contractAddress) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing input contractAddress.'})
  }

  if (contractAddress === Config.getQBXAddress()) {
    const qbx = await User.getQBXToken()
    return res.json(qbx) // TODO: we should remove the 'private' property from here
  }

  try {
    const token = await database.getTokenByContractAddress(contractAddress)
    if (token) {
      const balance = await User.getBalance(req.query.from, contractAddress)
      const apiToken = helpers.toAPIToken(token)
      // tslint:disable-next-line
      apiToken['balance'] = balance
      // tslint:disable-next-line
      apiToken['logoUrl'] = `${Config.getS3Url()}/${token.symbol.toLowerCase()}/logo.png`
      return res.json({ private: apiToken }) // TODO: we should remove the 'private' property from here
    } else {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Token has not been found'})
    }
  } catch (e) {
    if (validation.isInvalidWeb3AddressMessage(e.message, contractAddress.toLowerCase()) ||
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
  loyaltyToken
}
