import * as express from 'express'
import Controller from './controller'
import LibAPI from '../lib/utils'

const router = express.Router()

/**
 * @swagger
 * /transactions/raw:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Builds a raw transactions ready to be signed
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Address of the sender.
 *         in: path
 *         required: true
 *         type: string
 *       - name: to
 *         description: Beneficiary address of the loyalty tokens.
 *         in: path
 *         required: true
 *         type: string
 *       - name: contractAddress
 *         description: Loyalty Token contract address.
 *         in: path
 *         required: true
 *         type: string
 *       - name: transferAmount
 *         description: Amount of loyalty tokens being sent.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a transaction-like JSON array ready to be used for creating a transaction
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/raw', LibAPI.wrap(Controller.buildRawTransaction))

/**
 * @swagger
 * /transactions/{txHash}:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Returns the transaction {hash} information
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: hash
 *         description: Hash (identifier) of the transaction.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a JSON file containing the information relative to the transaction {hash}
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/:hash', LibAPI.wrap(Controller.getTransaction))

/**
 * @swagger
 * /transactions/{from}/history:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Get transaction history for the given address
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Address relevant for the history search.
 *         in: path
 *         required: true
 *         type: string
 *       - name: startBlock
 *         description: Define from which bblock on it should check for transactions.
 *         in: query
 *         required: false
 *         type: integer
 *       - name: endBlock
 *         description: Define to which block on it should check for transactions.
 *         in: query
 *         required: false
 *         type: integer
 *     responses:
 *       200:
 *          description: Returns the history of transactions for the given address
 *       400:
 *          description: Request failed, see error message.
 */
router.get('/:address/history', LibAPI.wrap(Controller.getHistory))

/**
 * @swagger
 * /transactions:
 *   post:
 *     tags:
 *       - Transactions
 *     description: Sends a signed transaction to the qiibee chain
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: data
 *         description: Signed transaction data in HEX format.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *          description: desc
 */
router.post('/', LibAPI.wrap(Controller.transfer))

module.exports = router
