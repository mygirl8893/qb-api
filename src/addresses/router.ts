import * as express from 'express'
import LibAPI from '../lib/utils'
import Controller from '../addresses/controller'

const router = express.Router()

router.get('/:address', LibAPI.wrap(Controller.getAddress))

export default router
