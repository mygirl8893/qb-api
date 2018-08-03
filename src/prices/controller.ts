import axios from "axios/index"
import * as HttpStatus from 'http-status-codes'
import TokenController from '../tokens/controller'

const CRYPTO_COMPARE = 'https://min-api.cryptocompare.com/data'
const QBX_ETH = 0.0001

const tokenRate = async (tokenAddress) => {
  const TokenDB = TokenController.tokenDB()
  const token = await TokenDB.getToken(tokenAddress).call()
  const tokenRate = Number(token['2'])
  return tokenRate
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

  if (status !== HttpStatus.OK || data.Response) {
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

export default {
  getPrice,
}
