import * as express from 'express'
import utils from '../lib/utils'
import Controller from './controller'

const router = express.Router()

router.get('/infura', utils.wrap(Controller.getInfuraApiKey))
router.get('/mainnet/transactions', utils.wrap(Controller.getTransactions))

export default router
