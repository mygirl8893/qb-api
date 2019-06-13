import BigNumber from 'bignumber.js'

function toAPIToken(token) {
  return {
    contractAddress: token.contractAddress,
    decimals: token.decimals,
    description: token.description,
    name: token.name,
    rate: token.rate,
    symbol: token.symbol,
    totalSupply: token.totalSupply,
    website: token.website
  }
}

function getRate(token) {
  if (token.fiatBacked) {
    // calculate rate of 1 wei to the fiat currency
    const multiplier = (new BigNumber(10)).pow(token.decimals)
    const weiToFiatRate = (new BigNumber(token.fiatRate)).multipliedBy(multiplier)
    return weiToFiatRate
  } else {
    return new BigNumber(token.rate)
  }
}

export default {
  toAPIToken,
  getRate
}
