import axios from 'axios'
import BigNumber from 'bignumber.js'
import * as md5 from 'md5'
import * as utf8 from 'utf8'
import log from '../logging'
import Config from './../config'

const QBX_FEE_PERCENTAGE = new BigNumber(0.01)
const QBX_FEE_DISPLAY_PERCENTAGE = new BigNumber(0.01).multipliedBy(100)
const GAS_PRICE_API_URL = 'https://www.etherchain.org/api/gasPriceOracle'
const COINSUPER_API_URL = 'https://api.coinsuper.com/api/v1'

interface QBXTxValueAndFees {
  qbxValueGross: BigNumber
  qbxTxValue: BigNumber
  qbxFee: BigNumber
  estimatedEthFee: BigNumber,
  costOfGasInQBX: BigNumber
}

interface QBXTxValueComputationData {
  gasPrice: BigNumber
  qbxToETHExchangeRate: BigNumber,
  ethToUSDExchangeRate: BigNumber,
  qbxTxValueAndFees: QBXTxValueAndFees
}

function calculateQBXTxValue(qbxValueGross: BigNumber,
                             estimatedGasAmount: BigNumber,
                             gasPrice: BigNumber,
                             qbxToETHExchangeRate: BigNumber): QBXTxValueAndFees {
  const qbxFee = qbxValueGross.multipliedBy(QBX_FEE_PERCENTAGE).integerValue(BigNumber.ROUND_FLOOR)
  const estimatedEthFee = estimatedGasAmount.multipliedBy(gasPrice)
  const costOfGasInQBX = estimatedEthFee.dividedBy(qbxToETHExchangeRate)
  const qbxTxValueRaw = qbxValueGross.minus(qbxFee).minus(costOfGasInQBX)
  const qbxTxValue = qbxTxValueRaw.integerValue(BigNumber.ROUND_FLOOR)
  return {
    qbxValueGross,
    qbxTxValue,
    qbxFee,
    estimatedEthFee,
    costOfGasInQBX
  }
}

const gweiInWei = new BigNumber('1000000000')

async function getGasPrice(): Promise<BigNumber> {
  try {
    log.info(` Requesting ${GAS_PRICE_API_URL}`)
    const response = await axios.get(GAS_PRICE_API_URL)
    log.info(` Received response from gas API: ${JSON.stringify(response.data)}`)
    const lastGasPrice = new BigNumber(response.data.standard)
    // convert from gew to wei
    return new BigNumber(lastGasPrice).multipliedBy(gweiInWei)
  } catch (e) {
    if (e.response) {
      log.error(`Failed ${GAS_PRICE_API_URL} request: ${e} ${JSON.stringify(e.response.data)}`)
    } else {
      log.error(`Failed ${GAS_PRICE_API_URL} request: ${e.stack}`)
    }
    throw e
  }

}

function getCoinSuperRequestData(params) {
  const paramsForSigning = JSON.parse(JSON.stringify(params))
  const timestamp = Date.now()

  paramsForSigning.accesskey = Config.getCoinsuperAPIKeys().accessKey
  paramsForSigning.secretkey = Config.getCoinsuperAPIKeys().secretKey
  paramsForSigning.timestamp = timestamp
  const paramsKeys = Object.keys(paramsForSigning)
  paramsKeys.sort()
  const sign = paramsKeys.map((k) => `${k}=${paramsForSigning[k]}`).join('&')
  const encodedSign = utf8.encode(sign)
  const md5Hash = md5(encodedSign)

  const requestData = {
    common: {
      accesskey: Config.getCoinsuperAPIKeys().accessKey,
      timestamp,
      sign: md5Hash
    },
    data: params
  }

  return requestData
}

async function getQBXToETHExchangeRate(): Promise<BigNumber> {
  const requestData =  getCoinSuperRequestData({
    num: 50,
    symbol: 'QBX/ETH'
  })
  const postURL = COINSUPER_API_URL + '/market/orderBook'
  try {
    const response = await axios.post(postURL, requestData)
    const qbxToETH = new BigNumber(response.data.data.result.bids[0].limitPrice)
    return qbxToETH
  } catch (e) {
    if (e.response) {
      log.error(`Failed ${postURL} request: ${e} ${JSON.stringify(e.response.data)}`)
    } else {
      log.error(`Failed ${postURL} request: ${e.stack}`)
    }
    throw e
  }
}

async function getETHToUSDExchangeRate(): Promise<BigNumber> {
  const requestData =  getCoinSuperRequestData({
    num: 50,
    symbol: 'ETH/USD'
  })
  const postURL = COINSUPER_API_URL + '/market/orderBook'
  try {
    const response = await axios.post(postURL, requestData)
    const ethToUSD = new BigNumber(response.data.data.result.bids[0].limitPrice)
    return ethToUSD
  } catch (e) {
    if (e.response) {
      log.error(`Failed ${postURL} request: ${e} ${JSON.stringify(e.response.data)}`)
    } else {
      log.error(`Failed ${postURL} request: ${e.stack}`)
    }
    throw e
  }
}

async function pullDataAndCalculateQBXTxValue(
  privateChainTxValue: BigNumber,
  rate: BigNumber,
  estimatedGasAmount: BigNumber,
  isFiatBacked: boolean): Promise<QBXTxValueComputationData> {

  if (!isFiatBacked) {
    const qbxValueGross = privateChainTxValue.dividedBy(rate)
    const qbxToETHExchangeRate = await getQBXToETHExchangeRate()
    const gasPrice = await getGasPrice()

    const qbxTxValueAndFees = calculateQBXTxValue(qbxValueGross, estimatedGasAmount, gasPrice, qbxToETHExchangeRate)

    return {
      gasPrice,
      qbxToETHExchangeRate,
      ethToUSDExchangeRate: null,
      qbxTxValueAndFees
    }
  } else {
    const txRawAmountInUSD = privateChainTxValue.dividedBy(rate)
    const qbxToETHExchangeRate = await getQBXToETHExchangeRate()
    const ethToUSDExchangeRate = await getETHToUSDExchangeRate()
    const qbxToUSDExchangeRate = qbxToETHExchangeRate.multipliedBy(ethToUSDExchangeRate)

    const decimalsMultiplier = (new BigNumber(10)).pow(18)
    const qbxValueGross = txRawAmountInUSD.dividedBy(qbxToUSDExchangeRate)
      .multipliedBy(decimalsMultiplier)
      .integerValue(BigNumber.ROUND_FLOOR)
    const gasPrice = await getGasPrice()

    const qbxTxValueAndFees = calculateQBXTxValue(qbxValueGross, estimatedGasAmount, gasPrice, qbxToETHExchangeRate)

    return {
      gasPrice,
      qbxToETHExchangeRate,
      ethToUSDExchangeRate,
      qbxTxValueAndFees
    }
  }
}

function getRate(token) {
  if (token.fiatBacked) {
    // calculate rate of 1 wei to the fiat currency
    const multiplier = (new BigNumber(10)).pow(token.decimals)
    const weiToFiatRate = (new BigNumber(token.fiatRate)).multipliedBy(multiplier)
    return weiToFiatRate
  } else {
    return new BigNumber(token.rate)
  }
}

export default {
  calculateQBXTxValue,
  pullDataAndCalculateQBXTxValue,
  getQBXToETHExchangeRate,
  getRate,
  getETHToUSDExchangeRate,
  QBX_FEE_DISPLAY_PERCENTAGE
}
