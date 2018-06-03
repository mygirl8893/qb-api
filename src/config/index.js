/* eslint-disable no-console */
import Web3 from 'web3'
import Config from './config'
import SwaggerConfig from './swagger'

const env = process.env.NODE_ENV || 'development',
  envtConfig = Config[env],
  web3Private = new Web3(envtConfig.rpc.private),
  web3Public = new Web3(envtConfig.rpc.public)

web3Private.eth.net
  .isListening()
  .then(() => console.log('Web3 (private) is connected'))
  .catch(() => {
    console.log('ERROR: Could not connect to Web3 (private)')
    process.exit()
  })

web3Public.eth.net
  .isListening()
  .then(() => console.log('Web3 (public) is connected'))
  .catch(() => {
    console.log('ERROR: Could not connect to Web3 (public)')
    process.exit()
  })

web3Private.eth.net.getId()
  .then(id => {
    envtConfig.chainID = id
  })

export default {
  getPort: () => envtConfig.port,
  getChainID: () => envtConfig.chainID,
  getTokenDBAddress: () => envtConfig.tokenDB,
  getQBXAddress: () => Config.qbxContract,
  getPrivateWeb3: () => web3Private,
  getPublicWeb3: () => web3Public,
  getPublicRPC: () => envtConfig.rpc.public,
  getPrivateRPC: () => envtConfig.rpc.private,
  getTokenABI: () => Config.tokenABI,
  getTokenDBABI: () => Config.tokenDBABI,
  getEnv: () => env,
  getStatusMessage: (code) => Config.statusMsgs[code],
  getSwaggerConfig: () => SwaggerConfig
}
