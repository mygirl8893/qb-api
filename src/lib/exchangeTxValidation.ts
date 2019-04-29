import { BigNumber } from 'bignumber.js'
import * as HttpStatus from 'http-status-codes'
import database from '../database'
import log from '../logging'
import publicBlockchain from './publicBlockchain'
import qbxFeeCalculator from './qbxFeeCalculator'

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
        `Transaction detected to be an exchange transaction \
        for token that is ${loyaltyToken.fiatBacked ? 'fiat' : 'QBX' } - backed \
           (sends to wallet ${toAddress}`)
      const txLoyaltyTokenValue = new BigNumber(decodedTx.params[1].value)
      const txValueInQBX = txLoyaltyTokenValue.dividedBy(new BigNumber(loyaltyToken.rate))
      const { conservativeGasEstimate } = await publicBlockchain.estimateTxGas(toAddress)

      const rate = loyaltyToken.fiatBacked ? loyaltyToken.fiatRate : loyaltyToken.rate
      const qbxTxValueComputationData =
        await qbxFeeCalculator.pullDataAndCalculateQBXTxValue(txValueInQBX,
          rate, conservativeGasEstimate, loyaltyToken.fiatBacked)
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
