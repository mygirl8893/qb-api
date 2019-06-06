import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import Config from '../config'
import log from '../logging'
import validation from '../validation'
import helpers from './helpers'

const getAddressSchema = Joi.object().keys({
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  }),
  query: Joi.object().keys({
    public: Joi.boolean().optional().default(false)
  })
})
async function getAddress(req, res) {
  req = validation.validateRequestInput(req, getAddressSchema)
  const address = req.params.address

  try {
    const response = await helpers.getAddress(address, req.params.public)
    res.json(response)
  } catch (e) {
    if (validation.isInvalidWeb3AddressMessage(e.message, address.toLowerCase())) {
      log.error(e.message)
      res.status(HttpStatus.BAD_REQUEST).json({ message: e.message })
    } else {
      throw e
    }
  }
}

export default {
  getAddress
}
