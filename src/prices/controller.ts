import axios from "axios/index"
import * as HttpStatus from 'http-status-codes'
import TokenController from '../tokens/controller'

const CRYPTO_COMPARE = 'https://min-api.cryptocompare.com/data'
const QBX_ETH = 0.0001

const tokenRate = async (tokenAddress) => {
  const TokenDB = TokenController.tokenDB()
  const token = await TokenDB.getToken(tokenAddress).call()
  const tokenRate = Number(token['2'])
  return tokenRate !== 0 ? tokenRate : undefined
}

/**
 * Returns the price of a specific Loyalty Token in the private ecosystem
 * in the desired currency
 * NOTE: this endpoint will be modified after the QBX is tradable on exchanges
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
const getPrice = async (req, res) => {
  const { from, to = 'USD' } = req.query
  const api =`${CRYPTO_COMPARE}/price?extraParams=qiibee&fsym=ETH&tsyms=${to}`
  const { status, data } = await axios.get(api)
  const rate = await tokenRate(from)

  let statusCode = HttpStatus.OK
  let results = {}

  if (status !== HttpStatus.OK || data.Response || rate === 0) {
    statusCode = data.Response ? HttpStatus.BAD_REQUEST : status
    results = {message: data.Message}
  } else {
    Object.keys(data).forEach((key) => {
      const qbxFiat = QBX_ETH * data[key]
      const fiat = qbxFiat / rate
      results[key] = fiat.toFixed(4)
    }); 
  }
  return res.status(statusCode).json(results)
}

/**
 * Returns the historical price values of a specific Loyalty Token on in the private ecosystem
 * in the desired currency
 * NOTE: this endpoint will be modified after the QBX is tradable on exchanges
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
const getHistory = async (req, res) => {
  const { from, to = 'USD', limit = 30, aggregate = 1, frequency = 'day' } = req.query //TODO: default values could be improve
  const rate = await tokenRate(from)
  let statusCode = HttpStatus.OK

  if (rate) {
    const api =`${CRYPTO_COMPARE}/histo${frequency}?extraParams=qiibee&fsym=ETH&tsym=${to}&limit=${limit}&aggregate=${aggregate}`
    const { status, data } = await axios.get(api)

    if (status !== HttpStatus.OK || data.Response === 'Error' || rate === 0) {
      statusCode = data.Response ? HttpStatus.BAD_REQUEST : status
      let results = {message: data.Message}
      return res.status(statusCode).json(results)
    } else {
      let results = []
      for (let entry of data.Data) {
        const qbxFiat = QBX_ETH * entry.close
        const fiat = qbxFiat / rate
        results.push({time: entry.time, price: fiat.toFixed(10)})
      }
      return res.status(statusCode).json(results)
    }
  } else {
    statusCode = HttpStatus.BAD_REQUEST
    let results = {message: 'LoyaltyToken contract address is invalid.'}
    return res.status(statusCode).json(results)
  }
}

export default {
  getPrice,
  getHistory,
}
