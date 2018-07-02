import config from './src/config/config'
import TestPrivateChain from './__tests__/integration/testPrivateChain'
import apiTesting from './__tests__/apiTesting'

const getApp = () => {

  /* eslint-disable-next-line global-require */
  const app = require("./app")

  return app
}

const loyaltyTokenABI = config.tokenABI

export default {
  getApp,
  loyaltyTokenABI,
  TestPrivateChain,
  apiTesting
}
