import config from './src/config/config'
import TestPrivateChain from './__tests__/integration/testPrivateChain'

const getApp = () => {

  /* eslint-disable-next-line global-require */
  const app = require("./app")

  return app
}

const loyaltyTokenABI = config.tokenABI

export default {
  getApp,
  loyaltyTokenABI,
  TestPrivateChain
}
