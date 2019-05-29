import * as Joi from 'joi'

import Config from '../config/'
import logger from '../logging'
import Validation from '../validation'
import Service from './service'

async function getInfuraApiKey(req, res) {

  const infuraKeyPlaintext = Config.getInfuraApiKey()

  try {
    const encryptedKey = await Service.encryptString(infuraKeyPlaintext)
    return res.status(200).json({ key: encryptedKey })
  } catch (err) {
    return errorResponse(res, err.message() || 'Something went wrong')
  }
}

const getTransactionsSchema = Joi.object().keys({
  query: Joi.object().keys({
    wallet: Joi.string().alphanum().required(),
    limit: Joi.number().integer().min(1).max(100).default(100),
    symbol: Joi.string().valid('QBX', 'ETH')
  })
})

async function getTransactions(req, res) {

  req = Validation.validateRequestInput(req, getTransactionsSchema)
  const { wallet, limit, symbol } = req.query

  if (!symbol) {
    // get both and combine
  } else if (symbol === 'ETH') {
    // get ETH
    const ethHistory = await Service.getEthTxHistory(wallet, limit)
    return res.json(ethHistory)
  } else if (symbol === 'QBX') {
    // get QBX
    const qbxHistory = await Service.getQbxTxHistory(wallet, limit)
    return res.json(qbxHistory)
  } else {
    logger.error(`'getTransactions' failed with symbol ${symbol}`)
    return errorResponse(res, 'Something went wrong', 500)
  }

  res.status(200).json({ key: 'encryptedKey' })
}

function errorResponse(res, message: string, status = 500) {
  return res.status(status).json({ message })
}

export default {
  getInfuraApiKey,
  getTransactions
}
