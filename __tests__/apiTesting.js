// patch the Config module to have a test configuration
const TEST_CONFIGURATION = {
  rpc: {
    private: 'http://testprivatechain.com',
    public: 'https://testpublicchain.com'
  },
  tokenDB: '0x988f24d8356bf7e3d4645ba34068a5723bf3ec6b',
  port: 3000
}
const Config = require('../src/config/config.js')

Config.default.test = TEST_CONFIGURATION

const getBaseWeb3Mock = (chainId) => ({
    eth: {
      net: {
        isListening: async () => null,
        getId: async () => chainId
      }
    }
  })

export default {
  TEST_CONFIGURATION,
  getBaseWeb3Mock
}
