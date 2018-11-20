import * as express from 'express'
import LibAPI from '../lib/utils'
import Controller from '../addresses/controller'

const router = express.Router()

/**
 * @swagger
 * /addresses/address:
 *   get:
 *     tags:
 *       - Addresses
 *     description: Returns address information along with balances for each Loyalty Token.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: address
 *         description: Users wallet address.
 *         in: path
 *         required: true
 *         type: string
 *       - name: public
 *         description: Includes balance of the QBX public token.
 *         in: query
 *         required: false
 *         type: boolean
 *     responses:
 *       200:
 *          description: Returns successfully a List of all Loyalty Tokens in the qiibee chain
 *       400:
 *         description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 */
router.get('/:address', LibAPI.wrap(Controller.getAddress))

export default router
