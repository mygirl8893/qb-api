import utils from '../src/lib/utils'

const setupTestConfiguration = (testConfiguration) => {
  // patch the Config module to have a test configuration

  /* eslint-disable-next-line global-require */
  const Config = require('../src/config/config')

  Config.default.test = testConfiguration
}

const waitForAppToBeReady = async (config) => {

  while (true) {
    if (config.getWeb3ConnectionsAreReady()) {
      break
    }

    await utils.sleep(100)
  }
}

export default {
  setupTestConfiguration,
  waitForAppToBeReady
}
