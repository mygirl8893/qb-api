import { BigNumber } from 'bignumber.js'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import Config from '../config'
import log from '../logging'
import TokenController from '../tokens/controller'
import validation from '../validation'

const web3 = Config.getPrivateWeb3()
const web3Pub = Config.getPublicWeb3()

const QBX_TOKEN_DESC = 'With qiibee, businesses around the world can run their loyalty programs on the blockchain.\
Exchange loyalty tokens to QBX and enter the crypto world'

async function getBalance(from: string = null, contractAddress: string): Promise<string> {
  const Token = TokenController.loyaltyToken(contractAddress.toLowerCase())
  let balance = '0'
  if (from) {
    balance = await Token.balanceOf(from.toLowerCase()).call()
    balance = new BigNumber(balance).toString(10)
  }
  return balance
}

async function getQBXToken(from: string = null) {
  const QiibeeToken = new web3Pub.eth.Contract(Config.getTokenABI(), Config.getQBXAddress(), {}).methods
  const totalSupply = await QiibeeToken.totalSupply().call()
  let balance = 0
  if (from) {
    balance = await QiibeeToken.balanceOf(from.toLowerCase()).call()
  }

  return {
      contractAddress: Config.getQBXAddress(),
      symbol: await QiibeeToken.symbol().call(),
      name: await QiibeeToken.name().call(),
      totalSupply,
      decimals: parseInt(await QiibeeToken.decimals().call(), 10),
      balance: new BigNumber(balance).toString(10),
      description: QBX_TOKEN_DESC,
      website: 'https://www.qiibee.com',
      logoUrl: 'https://s3.eu-central-1.amazonaws.com/tokens.qiibee/qbx/logo.png'
    }
}

const getInfoSchema = Joi.object().keys({
  params: {
    from: validation.ethereumAddress().required()
  }
})
async function getInfo(req, res) {
  // TODO: include more info? Otherwise, just rename this route to /users/{from}/transactions.
  req = validation.validateRequestInput(req, getInfoSchema)
  const address = req.params.from

  try {
    const transactionCount = await web3.eth.getTransactionCount(address.toLowerCase())
    const info = {
      address,
      transactionCount
    }
    res.json(info)
  } catch (e) {
    if (validation.isInvalidWeb3AddressMessage(e.message, address.toLowerCase())) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }
}

async function getETHBalance(from: string) {
  const ethBal = await web3Pub.eth.getBalance(from.toLowerCase())
  return ethBal
}

export default {
  getBalance,
  getETHBalance,
  getQBXToken,
  getInfo
}
