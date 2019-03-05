import BigNumber from 'bignumber.js'
import Config from '../config'

const publicWeb3 = Config.getPublicWeb3()

const contract = new publicWeb3.eth.Contract(
  Config.getQBXTokenABI(),
  Config.getQBXAddress(),
  {}
)

async function estimateTxGas(to: string) {
  const txValue = '0'
  const gasWeb3Estimate = await contract.methods.transfer(to, txValue).estimateGas()
  const baseGas = new BigNumber(gasWeb3Estimate)
  // add 10%
  const extraGas = baseGas.multipliedBy(0.1)
  const conservativeGasEstimate = baseGas.plus(extraGas).integerValue(BigNumber.ROUND_FLOOR)
  const generousGasEstimate = baseGas.multipliedBy(2).integerValue(BigNumber.ROUND_FLOOR)
  return {
    conservativeGasEstimate,
    generousGasEstimate
  }
}

export default {
  estimateTxGas
}
