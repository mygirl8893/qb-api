import * as express from 'express'
import Controller from './controller'
import LibAPI from '../lib/api'

const router = express.Router()

/**
 * @swagger
 * /tokens/{contract}:
 *   get:
 *     tags:
 *       - Tokens
 *     description: Returns a specific Loyalty Token in the qiibee chain
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: contract
 *         description: Contract Address.
 *         in: path
 *         required: true
 *         type: string
 *       - name: from
 *         description: User wallet address. If given, balance of the Loyalty Token given is returned.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: Returns successfully a specific Loyalty Token in the qiibee chain
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/:contract', LibAPI.wrap(Controller.getToken))

/**
 * @swagger
 * /tokens:
 *   get:
 *     tags:
 *       - Tokens
 *     description: Returns a list of all Loyalty Tokens in the qiibee chain
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Users wallet address. If givem balance of each Loyalty Token is returned.
 *         in: query
 *         required: false
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
 *          description: Request failed, see error message.
 */
router.get('/', LibAPI.wrap(Controller.getTokens))

module.exports = router
