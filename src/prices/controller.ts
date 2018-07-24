import axios from "axios/index"
import TokenController from '../tokens/controller'

/**
 * Returns the price of a specific Loyalty Token in the private ecosystem
 * in the desired currency
 * NOTE: this endpoint will be modified after the QBX is tradable on exchanges
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
const getPrice = async (req, res) => {
  const QBX_ETH = 0.0001
  const { from, to } = req.query
  const TokenDB = TokenController.tokenDB()
  const token = await TokenDB.getToken(from).call()
  const tokenRate = token['2']
  const api =`https://min-api.cryptocompare.com/data/price?extraParams=qiibee&fsym=ETH&tsyms=${to}`
  const { status, data } = await axios.get(api)
  
  let statusCode = 200
  let results = {}

  if (status !== 200 || data.Response) {
    statusCode = data.Response ? 400 : status
    results = {message: data.Message, status: statusCode}
  } else {
    Object.keys(data).forEach((key) => {
      const rate = data[key]
      const qbxFiat = QBX_ETH * rate
      const fiat = qbxFiat / tokenRate
      results[key] = fiat
    }); 
  }
  return res.status(statusCode).json(results)
}

export default {
  getPrice,
}
