import Config from '../config'

const web3 = Config.getPrivateWeb3()

async function getInfo(req, res) {
  const latestBlockNumber = await web3.eth.getBlockNumber()
  const latestBlock = await web3.eth.getBlock(latestBlockNumber)

  delete latestBlock.gasUsed
  delete latestBlock.gasLimit
  delete latestBlock.uncles
  delete latestBlock.logsBloom
  delete latestBlock.totalDifficulty
  delete latestBlock.difficulty
  delete latestBlock.gasUsed

  return res.json(latestBlock)
}

export default {
  getInfo
}
