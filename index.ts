import config from './src/config/config'
import TestPrivateChain from './__tests__/integration/testPrivateChain'
import apiTesting from './__tests__/apiTesting'
import * as fs from 'fs'
import * as path from 'path'

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
