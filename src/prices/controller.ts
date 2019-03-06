import axios from 'axios'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import * as NodeCache from 'node-cache'
import database from '../database'
import qbxFeeCalculator from '../lib/qbxFeeCalculator'
import log from '../logging'
import validation from '../validation'

const CRYPTO_COMPARE = 'https://min-api.cryptocompare.com/data'

const QBX_ETH_RATE_KEY = 'QBX_ETH_RATE'
const cacheTime = 10  // 10 seconds cache
const pricesCache = new NodeCache({ stdTTL: cacheTime, checkperiod: 0 })

async function getCachedQBXETHRate(): Promise<number> {
  const cachedQbxEthRate = pricesCache.get(QBX_ETH_RATE_KEY)
  if (cachedQbxEthRate) {
    // @ts-ignore
    return cachedQbxEthRate
  } else {
    const qbxToEthRate = await qbxFeeCalculator.getQBXToETHExchangeRate()
    const qbxToEthRateAsNumber = qbxToEthRate.toNumber()
    log.info(`Setting QBX/ETH cache value at ${qbxToEthRateAsNumber}`)
    pricesCache.set(QBX_ETH_RATE_KEY, qbxToEthRateAsNumber)
    return qbxToEthRateAsNumber
  }
}

const getPriceSchema = Joi.object().keys({
  query: Joi.object().keys({
    from: Joi.string().alphanum().required(),
    to: Joi.string().default('USD')
  })
})
/**
 * Returns the price of a specific Loyalty Token in the private ecosystem
 * in the desired currency
 * NOTE: this endpoint will be modified after the QBX is tradable on exchanges
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
async function getPrice(req, res) {
  req = validation.validateRequestInput(req, getPriceSchema)
  const {from, to} = req.query

  const api = `${CRYPTO_COMPARE}/price?extraParams=qiibee&fsym=ETH&tsyms=${to}`
  const { status, data } = await axios.get(api)

  const token = await database.getTokenByContractAddress(from)
  if (!token) {
    return res.status(HttpStatus.NOT_FOUND).json({message: `Token with address ${from} does not exist.`})
  }
  const rate = token.rate

  let statusCode = HttpStatus.OK
  let results = {}

  if (status !== HttpStatus.OK || data.Response || rate === 0) {
    statusCode = data.Response ? HttpStatus.BAD_REQUEST : status
    results = {message: data.Message}
  } else {
    const qbxETHRate = await getCachedQBXETHRate()
    Object.keys(data).forEach((key) => {
      const qbxFiat = qbxETHRate * data[key]
      const fiat = qbxFiat / rate
      results[key] = fiat.toFixed(10)
    })
  }
  return res.status(statusCode).json(results)
}

const getHistorySchema = Joi.object().keys({
  query: Joi.object().keys({
    from: Joi.string().alphanum().required(),
    to: Joi.string().default('USD'),
    limit: Joi.number().integer().default(30),
    aggregate: Joi.number().integer().default(1),
    frequency: Joi.string().valid('day', 'hour', 'minute').default('day')
  })
})

/**
 * Returns the historical price values of a specific Loyalty Token on in the private ecosystem
 * in the desired currency
 * NOTE: this endpoint will be modified after the QBX is tradable on exchanges
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
async function getHistory(req, res) {
  req = validation.validateRequestInput(req, getHistorySchema)
  const { from, to, limit, aggregate, frequency} = req.query

  const token = await database.getTokenByContractAddress(from)
  if (!token) {
    return res.status(HttpStatus.NOT_FOUND).json({message: `Token with address ${from} does not exist.`})
  }
  const rate = token.rate
  let statusCode = HttpStatus.OK

  const api =
    `${CRYPTO_COMPARE}/histo${frequency}?extraParams=qiibee&fsym=ETH&tsym=${to}&limit=${limit}&aggregate=${aggregate}`
  log.info(`Querying cryptocompare: ${api}`)
  const { status, data } = await axios.get(api)

  if (status !== HttpStatus.OK || data.Response === 'Error' || rate === 0) {
    log.info(`Cryptocompare request failed: ${data.message}`)
    statusCode = data.Response ? HttpStatus.BAD_REQUEST : status
    const results = {message: data.Message}
    return res.status(statusCode).json(results)
  } else {
    const qbxETHRate = await getCachedQBXETHRate()
    const results = []
    for (const entry of data.Data) {
      const qbxFiat = qbxETHRate * entry.close
      const fiat = qbxFiat / rate
      results.push({time: entry.time, price: fiat.toFixed(10)})
    }
    return res.status(statusCode).json(results)
  }
}

export default {
  getPrice,
  getHistory
}
