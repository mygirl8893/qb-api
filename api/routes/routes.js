'use strict'

var tokens = require('../controllers/tokensController')
var transaction = require('../controllers/transactionController')
var user = require('../controllers/userController')
var net = require('../controllers/netController')
var utils = require('../utils/utils')

module.exports = function(app) {
  app.route('/net').get(utils.wrapAsync(net.info))
  app.route('/tokens').get(utils.wrapAsync(tokens.list))
  app.route('/tokens/:contract').get(utils.wrapAsync(tokens.contract))
  app.route('/users/:from').get(utils.wrapAsync(user.info))
  app
    .route('/transactions/raw')
    .get(utils.wrapAsync(transaction.buildRawTransaction))
  app.route('/transactions/:hash').get(utils.wrapAsync(transaction.hashProxy))
  app
    .route('/transactions/:hash/history')
    .get(utils.wrapAsync(transaction.hashProxy))
  app.route('/transactions').post(utils.wrapAsync(transaction.transfer))
}
