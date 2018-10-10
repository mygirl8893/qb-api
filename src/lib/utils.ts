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

function validateRequestInput(req: express.Request, schema): express.Request {
  const objectToValidate = {}

  if (Joi.reach(schema, 'params')) {
    objectToValidate['params'] = req.params
  }

  if (Joi.reach(schema, 'query')) {
    objectToValidate['query'] = req.query
  }

  if (Joi.reach(schema, 'body')) {
    objectToValidate['body'] = req.body
  }

  const {error, value} = Joi.validate(objectToValidate, schema)
  if (error) {
    log.info(`${error}`)
    const throwableError = new Error(error)
    throwableError['status'] = HttpStatus.BAD_REQUEST
    throw throwableError
  } else {
    const validatedRequest = {...req, ...value}
    return validatedRequest
  }
}

export default {
  wrap,
  sleep,
  isInvalidWeb3AddressMessage,
  validateRequestInput
}
