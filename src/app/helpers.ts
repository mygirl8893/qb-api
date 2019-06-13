import BigNumber from 'bignumber.js'
import tokenHelpers from '../tokens/helpers'

function computeWalletAggregateValueInUSD(addressData, tokens,
                                          qbxToETHRate: BigNumber, ethToUSDRate: BigNumber): BigNumber {
  const qbxToUSDRate = qbxToETHRate.multipliedBy(ethToUSDRate)
  const qbxAmount = new BigNumber(addressData.balances.public.QBX.balance)

  const weiDivider = (new BigNumber(10)).pow(18)
  const qbxInUSD = qbxAmount.dividedBy(weiDivider).multipliedBy(qbxToUSDRate)

  let totalLoyaltyTokenValueInUSD = new BigNumber(0)

  const ethAmount = new BigNumber(addressData.balances.public.ETH.balance)
  const ethInUSD = ethAmount.dividedBy(weiDivider).multipliedBy(ethToUSDRate)

  for (let tokenSymbol in addressData.balances.private) {
    if (!addressData.balances.private.hasOwnProperty(tokenSymbol)) {
      continue
    }
    const tokenBalance = new BigNumber(addressData.balances.private[tokenSymbol].balance)
    const tokenRecord = tokens.find(t => t.symbol === tokenSymbol)
    let tokenValueInUSD
    if (tokenRecord.fiatBacked) {
      const rate = tokenHelpers.getRate(tokenRecord)
      tokenValueInUSD = tokenBalance.dividedBy(new BigNumber(rate))

    } else {
      const rate = tokenHelpers.getRate(tokenRecord)
      const tokenValueInQBXWei = new BigNumber(tokenBalance).dividedBy(rate)
      tokenValueInUSD = tokenValueInQBXWei.dividedBy(weiDivider).multipliedBy(qbxToUSDRate)
    }

    totalLoyaltyTokenValueInUSD = totalLoyaltyTokenValueInUSD.plus(tokenValueInUSD)
  }

  const aggregateValue = qbxInUSD.plus(totalLoyaltyTokenValueInUSD).plus(ethInUSD)
  return aggregateValue
}

export default {
  computeWalletAggregateValueInUSD
}
