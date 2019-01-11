import * as express from 'express'
import LibAPI from '../lib/utils'
import Controller from './controller'

const router = express.Router()

/**
 * @swagger
 * /users/{from}:
 *   get:
 *     tags:
 *       - Users
 *     description: Returns information about the user on the private chain.
 *                  Currently, only retrieving the transactions count.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: User address.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns information about the user on the qiibee chain
 *       400:
 *         description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 */
router.get('/:from', LibAPI.wrap(Controller.getInfo))

export default router
