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
 *         in: query
 *         required: true
 *         type: string
 *       - name: to
 *         description: Beneficiary address of the loyalty tokens.
 *         in: query
 *         required: true
 *         type: string
 *       - name: contractAddress
 *         description: Loyalty Token contract address. Supply contract address XOR token symbol.
 *         in: query
 *         required: false
 *         type: string
 *       - name: symbol
 *         description: Loyalty Token symbol. Supply contract address XOR token symbol.
 *         in: query
 *         required: false
 *         type: string
 *       - name: transferAmount
 *         description: Amount of loyalty tokens being sent.
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a transaction-like JSON array ready to be used for creating a transaction
 *       400:
 *         description: Request failed due to wrong parameters, see error message
 *       404:
 *         description: Request failed because the token is not found
 *       500:
 *          description: Request failed, see error message
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
 *          description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 */
router.get('/:hash', LibAPI.wrap(Controller.getTransaction))

/**
 * @swagger
 * /transactions/:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Returns the transaction {hash} information
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         description: Token symbol to filter by.
 *         in: path
 *         required: false
 *         type: string
 *       - name: contractAddress
 *         description: Token contract address to filter by.
 *         in: path
 *         required: false
 *         type: string
 *       - name: limit
 *         description: Define what is the maximum number of transactions the response can contain
 *                      (Default is 100, maximum is 100).
 *         in: query
 *         required: false
 *         type: integer
 *       - name: offset
 *         description: define the offset (how many transactions to be skipped) for the query.
 *         in: query
 *         required: false
 *         type: integer
 *       - name: wallet
 *         description: Wallet address to filter by (wallet == to || wallet == from)
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *          description: Returns a JSON file containing the information relative to the transaction {hash}
 *       400:
 *          description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 */
router.get('/', LibAPI.wrap(Controller.getTransactions))

/**
 * @swagger
 * /transactions/{from}/history:
 *   get:
 *     tags:
 *       - Transactions
 *     description: Get transaction history for the given address with transactions
 *                  sorted by block number in descending order. Supports pagination with limit/offset parameters.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: from
 *         description: Address relevant for the history search.
 *         in: path
 *         required: true
 *         type: string
 *       - name: limit
 *         description: Define what is the maximum number of transactions the response can contain
 *                      (Default is 100, maximum is 100).
 *         in: query
 *         required: false
 *         type: integer
 *       - name: offset
 *         description: define the offset (how many transactions to be skipped) for the query.
 *         in: query
 *         required: false
 *         type: integer
 *     responses:
 *       200:
 *          description: Returns the history of transactions for the given address
 *       400:
 *          description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
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
 *       400:
 *         description: Request failed due to wrong parameters, see error message
 *       500:
 *          description: Request failed, see error message
 */
router.post('/', LibAPI.wrap(Controller.transfer))

export default router
