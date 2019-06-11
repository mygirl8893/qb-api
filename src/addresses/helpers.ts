import User from '../users/controller'

interface Balance {
  balance: string
  contractAddress: string
}

interface Address {
  transactionCount: number
  balances: {
    private: { [key: string]: Balance }
    public: { [key: string]: Balance }
  }
}

async function getAddress(address: string, includePublicBalances: boolean,
                          web3, tokens): Promise<Address> {
  const tokenBalances = {}
  let qbxBalance = null
  let publicEthBalance = 0
  let transactionCount = await web3.eth.getTransactionCount(address.toLowerCase())
  for (const token of tokens) {
    const balance = await User.getBalance(address, token.contractAddress)

    tokenBalances[token.symbol] = {
      balance,
      contractAddress: token.contractAddress
    }
  }

  if (includePublicBalances) {
    qbxBalance = await User.getQBXToken(address)
    publicEthBalance = await User.getETHBalance(address)
  }

  const response = {
    transactionCount,
    balances: {
      private: tokenBalances,
      public: undefined
    }
  }

  if (includePublicBalances) {
    response.balances.public = {}
    response.balances.public[qbxBalance.symbol] = {
      balance: qbxBalance.balance,
      contractAddress: qbxBalance.contractAddress
    }
    response.balances.public.ETH = { balance: publicEthBalance }
  }

  return response
}

export default {
  getAddress
}
