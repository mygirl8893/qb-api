import BigNumber from 'bignumber.js'
import qbxFeeCalculator from '../lib/qbxFeeCalculator'

function computeWalletAggregateValueInUSD(address: string, tokens,
                                          qbxToETHRate: BigNumber, ethToUSDRate: BigNumber): BigNumber {
  const qbxToUSDRate = qbxToETHRate.multipliedBy(ethToUSDRate)
  const qbxAmount = new BigNumber(address.balances.public.QBX.balance)
  const qbxInUSD = qbxAmount.multipliedBy(qbxToUSDRate)

  let totalLoyaltyTokenValueInUSD = new BigNumber(0)

  const ethAmount = new BigNumber(address.balances.public.ETH.balance)
  const ethInUSD = ethAmount.multipliedBy(ethToUSDRate)

  for (let tokenSymbol of address.balances.private) {
    const tokenBalance = new BigNumber(address.balances.private[tokenSymbol].balance)
    const tokenRecord = tokens.find(t => t.symbol === tokenSymbol)
    let tokenValueInUSD
    if (tokenRecord.fiatBacked) {
      const rate = qbxFeeCalculator.getRate(tokenRecord)
      tokenValueInUSD = tokenBalance.dividedBy(new BigNumber(rate))

    } else {
      const tokenValueInQBX = new BigNumber(tokenBalance).dividedBy(tokenRecord)
      tokenValueInUSD = tokenValueInQBX.multipliedBy(qbxToUSDRate)
    }

    totalLoyaltyTokenValueInUSD = totalLoyaltyTokenValueInUSD.plus(tokenValueInUSD)
  }

  const aggregateValue = qbxInUSD.plus(totalLoyaltyTokenValueInUSD).plus(ethInUSD)
  return aggregateValue
}

export default {
  computeWalletAggregateValueInUSD
}
