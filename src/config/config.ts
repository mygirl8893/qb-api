import * as fs from 'fs'
import * as path from 'path'

const Config = {
  production: {
    rpc: {
      private: process.env.RPC_HOST || 'http://10.0.10.250:28002',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: '0x7c21ac5994ea0c2dc965f6cd998f38a8a896de3c',
    chainID: 29746197,
    port: process.env.PORT,
    S3Url: 'https://s3.eu-central-1.amazonaws.com/tokens.qiibee'
  },
  staging: {
    rpc: {
      private: process.env.RPC_HOST,
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: process.env.TOKEN_DB_CONTRACT_ADDRESS,
    port: process.env.PORT,
    S3Url: 'https://s3.eu-central-1.amazonaws.com/tokens.qiibee/testing'
  },
  testing: {
    rpc: {
      private: process.env.RPC_HOST,
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: process.env.TOKEN_DB_CONTRACT_ADDRESS,
    port: process.env.PORT,
    S3Url: 'https://s3.eu-central-1.amazonaws.com/tokens.qiibee/testing'
  },
  development: {
    rpc: {
      private: 'http://localhost:8545',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    port: 3000,
    S3Url: 'https://s3.eu-central-1.amazonaws.com/tokens.qiibee/testing'
  },
  qbxContract: '0x2467aa6b5a2351416fd4c3def8462d841feeecec',
  tokenABI: JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../contracts/loyaltyToken.json'),
      'utf-8'
    )
  ),
  tokenDBABI: JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../contracts/tokenDB.json'),
      'utf-8'
    )
  ),
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
