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
 *         description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 *
 */
router.get('/', LibAPI.wrap(Controller.getPrice))

/**
 * @swagger
 * /prices:
 *   get:
 *     tags:
 *       - Prices
 *     description: Returns the historical FIAT price values of one unit of a given Loyalty Token for a desired currency. This endpoint uses a third-party provider to get the ETH echange rate.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Loyalty Token contract address.
 *         in: query
 *         required: true
 *         type: string
 *       - name: to
 *         description: Comma separated currency symbols list to convert into. E.g USD,EUR,CHF
 *         in: query
 *         required: true
 *         type: string
 *       - name: frequency
 *         description: Get values from by day, minute or hour from the historical data. Default value is day.
 *         in: query
 *         required: false
 *         type: string
 *       - name: limit
 *         description: The number of data points to return. Default is 30.
 *         in: query
 *         required: false
 *         type: string
 *       - name: aggregate
 *         description: Time period to aggregate the data over (for daily it's days, for hourly it's hours and for minute it's minutes). Default is 3.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a list of all the FIAT values for the given Loyalty Tokens.
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/history', LibAPI.wrap(Controller.getHistory))

export default router
