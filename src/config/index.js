/* eslint-disable no-console */
import Web3 from 'web3'
import Config from './config'
import SwaggerConfig from './swagger'

const env = process.env.NODE_ENV || 'development',
  envtConfig = Config[env],
  web3Private = new Web3(envtConfig.rpc.private),
  web3Public = new Web3(envtConfig.rpc.public)

;(async () => {
    await Promise.all([
      web3Private.eth.net.isListening().catch(() => {
        throw new Error('Could not connect to Web3 (private)')
      }),
      web3Public.eth.net.isListening().catch(() => {
        throw new Error('Could not connect to Web3 (public)')
      })])

    const chainID = await web3Private.eth.net.getId().catch(() => {
      throw new Error('Could not fetch private chainID')
    })

    envtConfig.chainID = chainID
})().catch((e) => {
  console.log(`${e}`)
  process.exit(1)
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
