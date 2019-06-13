import appHelpers from '../../src/app/helpers'

const TOKENS = [
  {
    "contractAddress": "0xc3420d8d76dd535d8c6922d5d8c1276de32e2e54",
    "symbol": "OMG",
    "name": "OMG Coin",
    "rate": 10,
    "totalSupply": "500000000000000000000000",
    "decimals": 18,
    "description": "omg.",
    "website": "",
    "hidden": 0,
    "fiatBacked": 0,
    "fiatRate": null
  },
  {
    "contractAddress": "0xd9588d9c3c516d4642f8865a3447865b3def48c8",
    "symbol": "WTF",
    "name": "WTF Coin",
    "rate": 1,
    "totalSupply": "800000000000000000000000",
    "decimals": 18,
    "description": "wtf.",
    "website": "",
    "hidden": 0,
    "fiatBacked": 0,
    "fiatRate": null
  },
  {
    "contractAddress": "0xcb78b774fea4974f5d334261bcda55b268896351",
    "symbol": "BBQ",
    "name": "BBQ Coin",
    "rate": 1,
    "totalSupply": "600000000000000000000000",
    "decimals": 18,
    "description": "bbq.",
    "website": "",
    "hidden": 0,
    "fiatBacked": 0,
    "fiatRate": null
  }
]

const EXCHANGE_RATES: Record<string, BigNumber> = {}
EXCHANGE_RATES[QBX_ETH_PAIR] =  new BigNumber('0.00001')
EXCHANGE_RATES[ETH_USD_PAIR] =  new BigNumber('150')

describe('computeWalletAggregateValueInUSD', () => {
  it('computes wallet value successfully', () => {

    const tokens = [

    ]

    const addressData = {
      "transactionCount": 5,
      "balances": {
        "private": {
          "OMG": {
            "balance": "5000000000000000000",
            "contractAddress": "0xc3420d8d76dd535d8c6922d5d8c1276de32e2e54"
          },
          "WTF": {
            "balance": "0",
            "contractAddress": "0xd9588d9c3c516d4642f8865a3447865b3def48c8"
          },
          "BBQ": {
            "balance": "0",
            "contractAddress": "0xcb78b774fea4974f5d334261bcda55b268896351"
          }
        },
        "public": {
          "QBX": {
            "balance": "3165286476182830102287",
            "contractAddress": "0x2467aa6b5a2351416fd4c3def8462d841feeecec"
          },
          "ETH": {
            "balance": "0"
          }
        }
      }
    }

    const valueInUSD = appHelpers.computeWalletAggregateValueInUSD(addressData, TOKENS, EXCHANGE_RATES[QBX_ETH_PAIR], EXCHANGE_RATES[ETH_USD_PAIR])
  })
})
