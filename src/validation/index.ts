import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import log from '../logging'

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

function ethereumAddress()  {
  return Joi.string().length(42, 'utf8').regex(/^0(x|X)[a-fA-F0-9]{40}$/)
}

function ethereumHash()  {
  return Joi.string().length(66, 'utf8').regex(/^0(x|X)[a-fA-F0-9]{64}$/)
}

function bigPositiveIntAsString() {
  return Joi.string().regex(/^(0|[1-9][0-9]*)$/)
}

export default {
  validateRequestInput,
  isInvalidWeb3AddressMessage,
  ethereumAddress,
  ethereumHash,
  bigPositiveIntAsString
}
