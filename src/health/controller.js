import HttpStatus from 'http-status-codes'
import Config from '../config'

const getHealth = async (req, res) => {
  if (Config.getChainID()) {

    return res.json({state: 'live'})
  }

  res.status(HttpStatus.INTERNAL_SERVER_ERROR)
  return res.json({
    state: 'initializing'
  })
}

export default {
  getHealth
}
