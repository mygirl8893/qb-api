import * as fs from 'fs'
import * as path from 'path'

const Config = {
  production: {
    rpc: {
      private: process.env.RPC_HOST || 'http://10.0.10.250:28002',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    chainID: 29746197,
    port: process.env.PORT,
    S3Url: 'http://tokens.qiibee.com',
    tempExchangeWalletAddress: process.env.TEMP_EXCHANGE_WALLET_ADDRESS
  },
  beta: {
    rpc: {
      private: process.env.RPC_HOST,
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    port: process.env.PORT,
    S3Url: 'http://tokensbeta.qiibee.com',
    tempExchangeWalletAddress: process.env.TEMP_EXCHANGE_WALLET_ADDRESS
  },
  testing: {
    rpc: {
      private: process.env.RPC_HOST,
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    port: process.env.PORT,
    S3Url: 'http://tokenstesting.qiibee.com',
    tempExchangeWalletAddress: process.env.TEMP_EXCHANGE_WALLET_ADDRESS
  },
  development: {
    rpc: {
      private: 'http://localhost:8545',
      public: 'http://localhost:8600'
    },
    port: 3000,
    S3Url: 'http://tokensdevelopment.qiibee.com',
    coinsuperAPIKeys: {
      accessKey: 'c52eec8c-be4f-4208-ad75-2dcb11202538',
      secretKey: '8a3c41fa-6be6-4b76-ad42-c15ee05e3f40'
    },
    tempExchangeWalletAddress: process.env.TEMP_EXCHANGE_WALLET_ADDRESS
  },
  qbxContract: '0x2467aa6b5a2351416fd4c3def8462d841feeecec',
  tokenABI: JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../contracts/loyaltyToken.json'),
      'utf-8'
    )
  ),
  qbxTokenABI: JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../contracts/qbxToken.json'), 'utf-8')).abi,
  statusMsgs: {
    202: 'Request Accepted',
    400: 'Oops! You seem to have sent some wrong data',
    401: 'Auth failed.',
    403: "Sorry! You don't have access",
    404: "Couldn't find the requested resource",
    500: 'Sorry, something went wrong. This one is on us'
  }
}

export default Config
