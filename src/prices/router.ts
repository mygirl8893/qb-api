import * as express from 'express'
import Controller from './controller'
import LibAPI from '../lib/utils'

const router = express.Router()

/**
 * @swagger
 * /prices:
 *   get:
 *     tags:
 *       - Prices
 *     description: Returns the FIAT price of one unit of a given Loyalty Token. This endpoint uses a third-party provider to get the ETH echange rate.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Loyalty Token contract address.
 *         in: query
 *         required: true
 *         type: string
 *       - name: to
 *         description: Comma separated currency symbols list to convert into. E.g USD,EUR,CHF. Default value is USD.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a list of all Loyalty Tokens in the qiibee chain
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/', LibAPI.wrap(Controller.getPrice))

export default router
