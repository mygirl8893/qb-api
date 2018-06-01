'use strict'

const config = require('../../config.js').getConfig
const Web3 = require('web3')
var web3 = new Web3(config.private.rpc)

/**
 * @swagger
 * /net:
 *   get:
 *     tags:
 *       - Net
 *     description: Get Network Information
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       200:
 *          description: Returns successfully Network Informations
 *       400:
 *          description: Request failed, see error message.
 */
/**
 * Get Network Inforamtions.
 * @param {object} req - request object.
 * @param {object} res - respond object.
 * @return {json} The result.
 */
exports.info = async function(req, res) {
  const latestBlockNumber = await web3.eth.getBlockNumber()
  const latestBlock = await web3.eth.getBlock(latestBlockNumber)

  Reflect.deleteProperty(latestBlock, 'gasUsed')
  Reflect.deleteProperty(latestBlock, 'gasLimit')
  Reflect.deleteProperty(latestBlock, 'uncles')
  Reflect.deleteProperty(latestBlock, 'logsBloom')
  Reflect.deleteProperty(latestBlock, 'totalDifficulty')
  Reflect.deleteProperty(latestBlock, 'difficulty')
  Reflect.deleteProperty(latestBlock, 'gasUsed')

  return res.json(latestBlock)
}
