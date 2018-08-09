import config from './src/config/config'
import TestPrivateChain from './__tests__/integration/testPrivateChain'
import apiTesting from './__tests__/apiTesting'
import * as fs from "fs";
import * as path from "path";

const loyaltyTokenABI = config.tokenABI
const { tokenDBABI } = config

const loyaltyTokenCode = fs.readFileSync(
  path.resolve(__dirname, '../contracts/loyaltyToken.sol'),
  'utf-8'
)

const tokenDBCode = fs.readFileSync(
  path.resolve(__dirname, '../contracts/tokenDB.sol'),
  'utf-8'
)

export default {
  loyaltyTokenABI,
  tokenDBABI,
  TestPrivateChain,
  apiTesting,
  loyaltyTokenCode,
  tokenDBCode
}
