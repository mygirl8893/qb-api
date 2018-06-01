'use strict'
const currentVersion = require('./package.json').version
const path = require('path')
const fs = require('fs')

exports.getConfig = {
  private: {
    rpc: 'http://10.0.10.250:28002',
    chainId: 29746197,
    tokenDB: '0x7c21ac5994ea0c2dc965f6cd998f38a8a896de3c',
    tokenABI: JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, 'api/contracts/loyaltyToken.json'),
        'utf-8'
      )
    ),
    tokenDBABI: JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, 'api/contracts/tokenDB.json'),
        'utf-8'
      )
    ),
    qbxContract: undefined
  },
  public: {
    rpc: 'https://mainnet.infura.io/ZG3IjHbiNde01eIh5SCC',
    qbxContract: '0x2467aa6b5a2351416fd4c3def8462d841feeecec'
  },
  swagger: {
    swaggerDefinition: {
      info: {
        title: 'qiibee API overview',
        version: currentVersion,
        description: 'qiibee API specification',
        contact: {
          name: 'qiibee.com'
        }
      },
      basePath: '/',
      tags: [
        {
          name: 'Tokens',
          description:
            'Everything related to Loyalty Tokens in the private ecosystem'
        },
        {
          name: 'Transactions',
          description:
            'Everything related to transactions on the private ecosystem'
        },
        {
          name: 'Net',
          description: 'Everything related to the private ecosystem'
        },
        {
          name: 'Users',
          description:
            'Everything related to users/wallets in the private ecosystem'
        }
      ],
      schemes: ['https'],
      consumes: ['application/json'],
      produces: ['application/json']
    },
    apis: ['./api/controllers/**.js'] // Path to the API docs
  }
}
