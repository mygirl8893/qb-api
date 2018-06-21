import * as express from 'express'
import Controller from './controller'
import LibAPI from '../lib/api'

const router = express.Router()

/**
 * @swagger
 * /net:
 *   get:
 *     tags:
 *       - Network
 *     description: Gets network information
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       200:
 *          description: Returns the network information
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/', LibAPI.wrap(Controller.getInfo))

module.exports = router
