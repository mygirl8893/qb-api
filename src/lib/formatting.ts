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

export default {
  toAPIToken
}
