import path from 'path'
import fs from 'fs'

const Config = {
  production: {
    rpc: {
      private: 'http://10.0.10.250:28002',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: '0x7c21ac5994ea0c2dc965f6cd998f38a8a896de3c',
    chainID: 29746197,
  },
  staging: {
    rpc: {
      private: '',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: '',
    port: 3000
  },
  development: {
    rpc: {
      private: 'http://localhost:8545',
      public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
    },
    tokenDB: '0xF0847D4DE6BBAFf2849384E11fC1eA2FbA004a9f',
    port: 3000
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
