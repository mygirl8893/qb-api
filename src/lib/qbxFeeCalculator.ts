import axios from 'axios'
import BigNumber from 'bignumber.js'
import * as md5 from 'md5'
import * as utf8 from 'utf8'
import log from '../logging'
import Config from './../config'

const QBX_FEE_FRACTION = new BigNumber(0.01)
const QBX_FEE_PERCENTAGE = QBX_FEE_FRACTION.multipliedBy(100)
const GAS_PRICE_API_URL = 'https://www.etherchain.org/api/gasPriceOracle'
const COINSUPER_API_URL = 'https://api.coinsuper.com/api/v1'

interface QBXTxValueAndFees {
  qbxTxValue: BigNumber
  qbxFee: BigNumber
  estimatedEthFee: BigNumber,
  costOfGasInQBX
}

interface QBXTxValueComputationData {
  gasPrice: BigNumber
  qbxToETHExchangeRate: BigNumber,
  qbxTxValueAndFees: QBXTxValueAndFees
}

function calculateQBXTxValue(txRawAmountInQBXWei: BigNumber,
                             estimatedGasAmount: BigNumber,
                             gasPrice: BigNumber,
                             qbxToETHExchangeRate: BigNumber): QBXTxValueAndFees {
  const qbxFee = txRawAmountInQBXWei.multipliedBy(QBX_FEE_FRACTION)
  const estimatedEthFee = estimatedGasAmount.multipliedBy(gasPrice)
  const costOfGasInQBX = estimatedEthFee.dividedBy(qbxToETHExchangeRate)
  const qbxTxValueRaw = txRawAmountInQBXWei.minus(qbxFee).minus(costOfGasInQBX)
  const qbxTxValue = qbxTxValueRaw.integerValue(BigNumber.ROUND_FLOOR)
  return {
    qbxTxValue,
    qbxFee,
    estimatedEthFee,
    costOfGasInQBX
  }
}

async function getGasPrice(): Promise<BigNumber> {
  try {
    log.info(` Requesting ${GAS_PRICE_API_URL}`)
    const response = await axios.get(GAS_PRICE_API_URL)
    log.info(` Received response from gas API: ${JSON.stringify(response.data)}`)
    const lastGasPrice = response.data.standard
    return new BigNumber(lastGasPrice).integerValue(BigNumber.ROUND_FLOOR)
  } catch (e) {
    log.error(`Failed ${GAS_PRICE_API_URL} request: ${e} ${JSON.stringify(e.response.data)}`)
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
    log.error(`Failed ${postURL} request: ${e} ${JSON.stringify(e.response.data)}`)
    throw e
  }
}

async function pullDataAndCalculateQBXTxValue(
  txRawAmountInQBXWei: BigNumber,
  estimatedGasAmount: BigNumber): Promise<QBXTxValueComputationData> {
  const qbxToETHExchangeRate = await getQBXToETHExchangeRate()
  const gasPrice = await getGasPrice()

  const qbxTxValueAndFees = calculateQBXTxValue(txRawAmountInQBXWei, estimatedGasAmount, gasPrice, qbxToETHExchangeRate)

  return {
    gasPrice,
    qbxToETHExchangeRate,
    qbxTxValueAndFees
  }
}

export default {
  pullDataAndCalculateQBXTxValue,
  QBX_FEE_PERCENTAGE
}
