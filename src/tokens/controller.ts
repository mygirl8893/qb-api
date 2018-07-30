import User from '../users/controller'
import Config from '../config'
import * as HttpStatus from "http-status-codes";

const web3 = Config.getPrivateWeb3()

const tokenDB = () => new web3.eth.Contract(
  Config.getTokenDBABI(),
  Config.getTokenDBAddress(),
  {}
).methods

const loyaltyToken = (contractAddress) => new web3.eth.Contract(
  Config.getTokenABI(),
  contractAddress,
  {}
).methods

const getTokens = async (req, res) => {
  let publicBalance = undefined

  const privateBalance = await User.getBalances(req.query.from)

  if (req.query.public) {
    publicBalance = await User.getPublicBalance(req.query.from)
  }

  return res.json({
    private: privateBalance,
    public: publicBalance
  })
}

/**
 * Returns a specific Loyalty Token in the private ecosystem
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
const getToken = async (req, res) => {
  const publicBalance = 0

  const contractAddress = req.params.contract
  try {
    const privateBalance = await User.getBalanceOnContract(
      req.query.from,
      contractAddress
    )

    return res.json({
      private: privateBalance,
      public: publicBalance
    })
  } catch (e) {
    if (e.message.includes(`Provided address "${contractAddress.toLowerCase()}" is invalid`)) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message})
    }
  }
}

export default {
  getToken,
  getTokens,
  tokenDB,
  loyaltyToken
}
