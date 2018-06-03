import BigNumber from 'bignumber.js'
import Config from '../config'
import TokenController from '../tokens/controller'

const web3 = Config.getPrivateWeb3()
const web3Pub = Config.getPublicWeb3()

const getBalanceOnContract = async (from = null, contractAddress) => {
  const Token = TokenController.loyaltyToken(contractAddress.toLowerCase())
  const totalSupply = BigNumber(await Token.totalSupply().call()).toString(10)
  let balance = 0

  if (from) {
    balance = await Token.balanceOf(from.toLowerCase()).call()
    balance = BigNumber(balance).toString(10)
  }

  return {
    contractAddress: contractAddress.toLowerCase(),
    symbol: await Token.symbol().call(),
    name: await Token.name().call(),
    balance,
    totalSupply,
    decimals: parseInt(await Token.decimals().call(), 10)
  }
}

const getBalances = async from => {
  const TokenDB = TokenController.tokenDB(),
        tokens = await TokenDB.getTokens().call()
  const balances = []
  for (const token of tokens) { // eslint-disable-line no-restricted-syntax
    balances.push(await getBalanceOnContract(from, token)) // eslint-disable-line no-await-in-loop
  }
  return balances
}

const getPublicBalance = async (from = null) => {
  const QiibeeToken = new web3Pub.eth.Contract(Config.getTokenABI(), Config.getQBXAddress(), {}).methods
  const totalSupply = await QiibeeToken.totalSupply().call()
  let balance = 0
    // ethBalance = 0
  if (from) {
    // ethBalance = await web3Pub.eth.getBalance(from.toLowerCase())
    balance = await QiibeeToken.balanceOf(from.toLowerCase()).call()
  }

  return [
    {
      contractAddress: Config.getQBXAddress(),
      symbol: await QiibeeToken.symbol().call(),
      name: await QiibeeToken.name().call(),
      balance: BigNumber(balance).toString(10),
      totalSupply,
      decimals: parseInt(await QiibeeToken.decimals().call(), 10)
    }
    // {
    //   contractAddress: 'Ethereum',
    //   symbol: 'ETH',
    //   name: 'ETH',
    //   balance: BigNumber(ethBalance).toString(10),
    //   decimals: 18
    // }
  ]
}

const getInfo = async function(req, res) {
  // TODO: include more info? Otherwise, just rename this route to /users/{from}/transactions.
  // TODO: validate input. If from is false should throw an error.
  const address = req.params.from,
    transactionCount =
      address === null
        ? 0
        : await web3.eth.getTransactionCount(address.toLowerCase())
  const info = {
    address,
    transactionCount: await transactionCount
  }
  res.json(info)
}

export default {
  getBalanceOnContract,
  getBalances,
  getPublicBalance,
  getInfo
}
