import Config from '../config'

const web3 = Config.getPrivateWeb3()

const getInfo = async (req, res) => {
  const latestBlockNumber = await web3.eth.getBlockNumber(),
    latestBlock = await web3.eth.getBlock(latestBlockNumber)

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
