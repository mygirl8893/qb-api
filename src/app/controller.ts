import Config from '../config/'
import Service from './service'
import * as HttpStatus from 'http-status-codes'
import * as Joi from 'joi'
import validation from '../validation'

async function getInfuraApiKey(req, res) {

  const infuraKeyPlaintext = Config.getInfuraApiKey()

  try {
    const encryptedKey = await Service.encryptString(infuraKeyPlaintext)
    return res.status(200).json({ key: encryptedKey })
  } catch (err) {
    return errorResponse(res, err.message() || 'Something went wrong')
  }
}


const getAddressValuesSchema = Joi.object().keys({
  params: Joi.object().keys({
    address: validation.ethereumAddress().required()
  })
})
async function getAddressValues(req, res) {

}

function errorResponse(res, message: string, status = 500) {
  return res.status(status).json({ message })
}

export default {
  getInfuraApiKey,
  getAddressValues
}
