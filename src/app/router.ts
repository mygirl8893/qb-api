import * as express from 'express'
import utils from '../lib/utils'
import Controller from './controller'

const router = express.Router()

router.get('/infura', utils.wrap(Controller.getInfuraApiKey))
router.get('/mainnet/transactions', utils.wrap(Controller.getTransactions))

router.get('/addresses/:address/values', utils.wrap(Controller.getAddressValues))

export default router
