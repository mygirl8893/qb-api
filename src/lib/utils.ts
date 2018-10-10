import * as qbDB from 'qb-db-migrations'

/**
 * Wrapper for router handlers to pass the errors correctly to the express framework
 * Extracted from the following techincal article
 * https://strongloop.com/strongblog/async-error-handling-expressjs-es7-promises-generators/
 * @param Promise
 * @returns {function(...[*]): *}
 */
const wrap = fn => (...args) => fn(...args).catch(args[2])

const Token = qbDB.models.token

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function isInvalidWeb3AddressMessage(errorMessage: string, address: string): boolean {
  return errorMessage.includes(`Provided address "${address}" is invalid`)
}

const getToken = async (contractAddress) => {
  return await Token.find({ where: { contractAddress }, raw: true })
}

const getTokens = async () => {
  return await Token.findAll({ raw: true })
}

export default {
  wrap,
  sleep,
  isInvalidWeb3AddressMessage,
  getToken,
  getTokens
}
