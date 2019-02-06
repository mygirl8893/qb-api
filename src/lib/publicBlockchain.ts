import Config from '../config'

const publicWeb3 = Config.getPublicWeb3()

const contract = new publicWeb3.eth.Contract(
  Config.getQBXTokenABI(),
  Config.getQBXAddress(),
  {}
)

async function estimateTxGas(to: string, txValue: string) {
  const gas = await contract.methods.transfer(to, txValue).estimateGas()
  return new BigNumber(gas)
}

export default {
  estimateTxGas
}
