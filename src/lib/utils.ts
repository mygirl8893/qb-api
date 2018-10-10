import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import log from '../logging'

/**
 * Wrapper for router handlers to pass the errors correctly to the express framework
 * Extracted from the following techincal article
 * https://strongloop.com/strongblog/async-error-handling-expressjs-es7-promises-generators/
 * @param Promise
 * @returns {function(...[*]): *}
 */
const wrap = fn => (...args) => fn(...args).catch(args[2])

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function isInvalidWeb3AddressMessage(errorMessage: string, address: string): boolean {
  return errorMessage.includes(`Provided address "${address}" is invalid`)
}

function validateRequestInput(req: express.Request, schema) {
  const objectToValidate = {}
  if (Object.keys(req.params).length > 0) {
    objectToValidate['params'] = req.params
  }

  if (Object.keys(req.query).length > 0) {
    objectToValidate['query'] = req.query
  }

  const {error, value} = Joi.validate(objectToValidate, schema)
  if (error) {
    log.info(`${error}`)
    const throwableError = new Error(error)
    throwableError['status'] = HttpStatus.BAD_REQUEST
    throw throwableError
  } else {
    return value
  }
}

export default {
  wrap,
  sleep,
  isInvalidWeb3AddressMessage,
  validateRequestInput
}
