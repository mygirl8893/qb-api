import BigNumber from 'bignumber.js'
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
    // get both and combine; while getting get 100 of each and combine
    // 100 since max is 100
    const ethHistory = await Service.getEthTxHistory(wallet, 100)
    const qbxHistory = await Service.getQbxTxHistory(wallet, 100)
    const mixedHistory = [...ethHistory, ...qbxHistory]
      .sort((h1, h2) => {
        const a = new BigNumber(h1.timestamp)
        const b = new BigNumber(h2.timestamp)
        return a.minus(b).toNumber()
      })
    return res.json(mixedHistory.slice(0, limit))
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
}

function errorResponse(res, message: string, status = 500) {
  return res.status(status).json({ message })
}

export default {
  getInfuraApiKey,
  getTransactions
}
