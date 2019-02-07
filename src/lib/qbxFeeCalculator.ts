import axios from 'axios'
import BigNumber from 'bignumber.js'
import * as md5 from 'md5'
import * as utf8 from 'utf8'
import Config from './../config'

const QBX_FEE_PERCENTAGE = new BigNumber(0.01)
const GAS_PRICE_API_URL = 'https://www.etherchain.org/api/gasPriceOracle'

interface QBXTxValueAndFees {
  qbxTxValue: BigNumber
  qbxFee: BigNumber
  estimatedEthFee: BigNumber
}

function calculateQBXTxValue(txRawAmountInQBXWei: BigNumber,
                             estimatedGasAmount: BigNumber,
                             gasPrice: BigNumber,
                             qbxToETHExchangeRate: BigNumber): QBXTxValueAndFees {
  const qbxFee = txRawAmountInQBXWei.multipliedBy(QBX_FEE_PERCENTAGE)
  const estimatedEthFee = estimatedGasAmount.multipliedBy(gasPrice)
  const costOfGasInQBX = estimatedEthFee.dividedBy(qbxToETHExchangeRate)
  const qbxTxValue = txRawAmountInQBXWei.minus(qbxFee).minus(costOfGasInQBX)
  return {
    qbxTxValue,
    qbxFee,
    estimatedEthFee
  }
}

async function getGasPrice(): Promise<BigNumber> {
  const response = await axios.get(GAS_PRICE_API_URL)
  const lastGasPrice = response.data.standard
  return new BigNumber(lastGasPrice)
}

const COINSUPER_API_URL = 'https://api.coinsuper.com/api/v1'

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
  const response = await axios.post(COINSUPER_API_URL + '/market/orderBook', requestData)
  const qbxToETH = new BigNumber(response.data.data.result.bids[0].limitPrice)
  return qbxToETH
}

interface QBXTxValueComputationData {
  gasPrice: BigNumber
  qbxToETHExchangeRate: BigNumber,
  qbxTxValueAndFees: QBXTxValueAndFees
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
  pullDataAndCalculateQBXTxValue
}
