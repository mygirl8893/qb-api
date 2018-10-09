import { BigNumber } from 'bignumber.js'
import Config from '../config'
import TokenController from '../tokens/controller'
import * as HttpStatus from 'http-status-codes'
import * as qbDB from 'qb-db-migrations'

const Token = qbDB.models.token
import log from '../logging'
import utils from "../lib/utils";

const web3 = Config.getPrivateWeb3()
const web3Pub = Config.getPublicWeb3()

const getTokenByContract = async (from = null, contractAddress) => {
  const Token = TokenController.loyaltyToken(contractAddress.toLowerCase())
  const totalSupply = new BigNumber(await Token.totalSupply().call()).toString(10)
  let balance = '0'

  if (from) {
    balance = await Token.balanceOf(from.toLowerCase()).call()
    balance = new BigNumber(balance).toString(10)
  }

  return {
    contractAddress: contractAddress.toLowerCase(),
    symbol: await Token.symbol().call(),
    name: await Token.name().call(),
    rate: '',
    balance,
    totalSupply,
    decimals: parseInt(await Token.decimals().call(), 10),
    description: '',
    website: '',
    logoUrl: ''
  }
}

const getTokensFromBlockchain = async from => {
  const TokenDB = TokenController.tokenDB(),
    tokens = await TokenDB.getTokens().call()
  const list = []
  for (const token of tokens) {
    list.push(await getTokenByContract(from, token))
  }
  return list
}

const getPublicTokens = async (from = null) => {
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
      balance: new BigNumber(balance).toString(10),
      totalSupply,
      decimals: parseInt(await QiibeeToken.decimals().call(), 10)
    }
  ]
}

const getInfo = async function (req, res) {
  // TODO: include more info? Otherwise, just rename this route to /users/{from}/transactions.

  const address = req.params.from

  if (!address) {
    return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing "from" parameter.' })
  }
  try {
    const transactionCount = await web3.eth.getTransactionCount(address.toLowerCase())
    const info = {
      address,
      transactionCount: transactionCount
    }
    res.json(info)
  } catch (e) {
    if (utils.isInvalidWeb3AddressMessage(e.message, address.toLowerCase())) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }
}

export default {
  getTokenByContract,
  getTokensFromBlockchain,
  getPublicTokens,
  getInfo
}
