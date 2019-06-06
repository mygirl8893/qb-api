import Config from '../config/'
import Service from './service'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import validation from '../validation'
import addressesHelpers from '../addresses/helpers'
import qbxFeeCalculator from '../lib/qbxFeeCalculator'
import database from '../database'

const web3 = Config.getPrivateWeb3()

async function getInfuraApiKey(req, res) {

  const infuraKeyPlaintext = Config.getInfuraApiKey()

  try {
    const encryptedKey = await Service.encryptString(infuraKeyPlaintext)
    return res.status(200).json({ key: encryptedKey })
  } catch (err) {
    return errorResponse(res, err.message() || 'Something went wrong')
  }
}

const getAddressValuesSchema = Joi.object().keys({
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  })
})
async function getAddressValues(req, res) {
  req = validation.validateRequestInput(req, getAddressValuesSchema)
  const address = req.params.address

  const [qbxToETHRate, ethToUSDRate, tokens, ownedTokens] = await Promise.all([
    qbxFeeCalculator.getQBXToETHExchangeRate(),
    qbxFeeCalculator.getETHToUSDExchangeRate(),
    database.getTokens(),
    database.getOwnedTokens(address.toLowerCase())])

  const addressData = addressesHelpers.getAddress(address, true, web3, tokens, ownedTokens)

  const aggregateValueInUSD = await computeWalletAggregateValueInUSD(address, tokens, qbxToETHRate, ethToUSDRate)

  addressData['aggregateValue'] = {
    USD: aggregateValueInUSD.toFixed()
  }
  res.json(addressData)
}

function errorResponse(res, message: string, status = 500) {
  return res.status(status).json({ message })
}

export default {
  getInfuraApiKey,
  getAddressValues
}
