// tslint:disable-next-line
const Web3 = require('web3')
import log from '../logging'
import Config from './config'
import SwaggerConfig from './swagger'

const env = process.env.NODE_ENV || 'development'
const envtConfig = Config[env]
const web3Private = new Web3(envtConfig.rpc.private)
const web3Public = new Web3(envtConfig.rpc.public)
let web3ConnectionsAreReady = false

;
(async () => {
  log.info(`Connecting to private: ${envtConfig.rpc.private} and public ${envtConfig.rpc.public}`)
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
  web3ConnectionsAreReady = true
})().catch((e) => {
  log.error(`${e.stack}`)
  process.exit(1)
})

export default {
  getPort: () => envtConfig.port,
  getChainID: () => envtConfig.chainID,
  getQBXAddress: () => Config.qbxContract,
  getPrivateWeb3: () => web3Private,
  getPublicWeb3: () => web3Public,
  getPublicRPC: () => envtConfig.rpc.public,
  getPrivateRPC: () => envtConfig.rpc.private,
  getTokenABI: () => Config.tokenABI,
  getQBXTokenABI: () => Config.qbxTokenABI,
  getEnv: () => env,
  getSwaggerConfig: () => SwaggerConfig,
  getWeb3ConnectionsAreReady: () => web3ConnectionsAreReady,
  getS3Url: () => envtConfig.S3Url,
  getTempExchangeWalletAddress: () => envtConfig.tempExchangeWalletAddress,
  getCoinsuperAPIKeys: () => envtConfig.coinsuperAPIKeys
}
