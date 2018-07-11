import config from './src/config/config'
import TestPrivateChain from './__tests__/integration/testPrivateChain'
import apiTesting from './__tests__/apiTesting'

const loyaltyTokenABI = config.tokenABI
const { tokenDBABI } = config

export default {
  loyaltyTokenABI,
  tokenDBABI,
  TestPrivateChain,
  apiTesting
}
