import * as fs from 'fs'
import * as path from 'path'
import apiTesting from './__tests__/apiTesting'
import TestPrivateChain from './__tests__/integration/testPrivateChain'
import config from './src/config/config'

const loyaltyTokenABI = config.tokenABI

const loyaltyTokenCode = fs.readFileSync(
  path.resolve(__dirname, 'src/contracts/loyaltyToken.sol'),
  'utf-8'
)

export default {
  loyaltyTokenABI,
  TestPrivateChain,
  apiTesting,
  loyaltyTokenCode
}
