import * as express from 'express'
import Controller from "./controller"
import LibAPI from "../lib/utils"

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     description: Gets information on the current health state of the app.
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       200:
 *          description: Returns the network information
 *       400:
 *          description: Request failed, see error message.
 *       500:
 *          description: Application is unhealthy.
 */
router.get('/', LibAPI.wrap(Controller.getHealth))

module.exports = router

