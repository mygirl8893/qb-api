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
    coinsuperAPIKeys: {
      accessKey: process.env.COINSUPER_ACCESS_KEY,
      secretKey: process.env.COINSUPER_SECRET_KEY
    }
  },
  beta: {
    rpc: {
      private: process.env.RPC_HOST,
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    port: process.env.PORT,
    S3Url: 'http://tokensbeta.qiibee.com',
    coinsuperAPIKeys: {
      accessKey: process.env.COINSUPER_ACCESS_KEY,
      secretKey: process.env.COINSUPER_SECRET_KEY
    }
  },
  testing: {
    rpc: {
      private: process.env.RPC_HOST,
      public: process.env.PUBLIC_RPC_HOST
    },
    port: process.env.PORT,
    S3Url: 'http://tokenstesting.qiibee.com',
    coinsuperAPIKeys: {
      accessKey: process.env.COINSUPER_ACCESS_KEY,
      secretKey: process.env.COINSUPER_SECRET_KEY
    }
  },
  development: {
    rpc: {
      private: 'http://localhost:8545',
      public: 'https://localhost:8600'
    },
    port: 3000,
    S3Url: 'http://tokensdevelopment.qiibee.com',
    coinsuperAPIKeys: {
      accessKey: '',
      secretKey: ''
    }
  },
  qbxContract: process.env.ETH_NET_QBX_CONTRACT_ADDRESS || '0x2467aa6b5a2351416fd4c3def8462d841feeecec',
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
