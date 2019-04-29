import database from '../database'
import log from '../logging'
import { BigNumber } from 'bignumber.js'
import publicBlockchain from './publicBlockchain'
import qbxFeeCalculator from './qbxFeeCalculator'
import * as HttpStatus from 'http-status-codes'

interface ExchangeTxValidationResponse {
  valid: boolean
  errorResponseMessage: string
  errorResponseCode: number
}

async function validateExchangeTx(loyaltyToken, toAddress: string, decodedTx): Promise<ExchangeTxValidationResponse> {
  try {
    const tempExchangeWallets = await database.getTempExchangeWallets()
    if (tempExchangeWallets.map((w) => w.address).includes(toAddress)) {
      log.info(
        `Transaction detected to be an exchange transaction
           (sends to wallet ${toAddress}`)
      const txLoyaltyTokenValue = new BigNumber(decodedTx.params[1].value)
      const txValueInQBX = txLoyaltyTokenValue.dividedBy(new BigNumber(loyaltyToken.rate))
      const { conservativeGasEstimate } = await publicBlockchain.estimateTxGas(toAddress)
      const qbxTxValueComputationData =
        await qbxFeeCalculator.pullDataAndCalculateQBXTxValue(txValueInQBX, conservativeGasEstimate)
      if (qbxTxValueComputationData.qbxTxValueAndFees.qbxTxValue.isLessThan(new BigNumber('0'))) {
        const errMessage = `Exchange transaction value ${txValueInQBX} in QBX is too low.
          Estimated gas: ${conservativeGasEstimate.toString()}
          computation results: ${JSON.stringify(qbxTxValueComputationData)}`
        log.error(errMessage)

        return {
          valid: false,
          errorResponseMessage: errMessage,
          errorResponseCode: HttpStatus.BAD_REQUEST
        }
      } else {
        log.info(`Exchange transaction is valid. Proceeding..`)
      }
    }
    return {
      valid: true,
      errorResponseMessage: null,
      errorResponseCode: null
    }
  } catch (e) {
    log.error(`Failed to process potential exchange transaction ${e.stack}`)

    return {
      valid: false,
      errorResponseMessage: `Failed to process exchange transaction.`,
      errorResponseCode: HttpStatus.INTERNAL_SERVER_ERROR
    }
  }
}


export default {
  validateExchangeTx
}
