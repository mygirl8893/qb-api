import appHelpers from '../../src/app/helpers'
import { BigNumber } from 'bignumber.js'

const TOKENS = [
  {
    "contractAddress": "0x2a9fc4f1758d41a9adc2b264ddb8a3cfd80dfc1d",
    "decimals": 18,
    "description": "",
    "name": "OMG Coin",
    "rate": 10,
    "symbol": "OMG",
    "totalSupply": "400000000000000000000000",
    "website": "www.omgomg.ch",
  },
  {
    "contractAddress": "0xd9588d9c3c516d4642f8865a3447865b3def48c8",
    "decimals": 18,
    "description": "We believe this was used for a large performance test at some point.",
    "name": "Old contract token",
    "rate": 10,
    "symbol": "WTF",
    "totalSupply": "400000000000000000000000",
    "website": "wtfwtf.com",
  },
  {
    "contractAddress": "0xea08ce93eb652791513afb15e0762359551452aa",
    "decimals": 18,
    "description": "",
    "name": "BBQ Coin",
    "rate": 1,
    "fiatBacked": true,
    "fiatRate": 1,
    "symbol": "BBQ",
    "totalSupply": "400000000000000000000000",
    "website": "",
  },
]

const QBX_ETH_PAIR = 'QBX/ETH'
const ETH_USD_PAIR = 'ETH/USD'

const EXCHANGE_RATES: Record<string, BigNumber> = {}
EXCHANGE_RATES[QBX_ETH_PAIR] =  new BigNumber('0.00001')
EXCHANGE_RATES[ETH_USD_PAIR] =  new BigNumber('150')

describe('computeWalletAggregateValueInUSD', () => {
  it('computes wallet value successfully', () => {

    const addressData = {
      "transactionCount": 5,
      "balances": {
        "private": {
          "OMG": {
            "balance": "1000000000000000000000",
            "contractAddress": "0xc3420d8d76dd535d8c6922d5d8c1276de32e2e54"
          },
          "WTF": {
            "balance": "1000000000000000000000",
            "contractAddress": "0xd9588d9c3c516d4642f8865a3447865b3def48c8"
          },
          "BBQ": {
            "balance": "1000000000000000000",
            "contractAddress": "0xcb78b774fea4974f5d334261bcda55b268896351"
          }
        },
        "public": {
          "QBX": {
            "balance": "3000000000000000000000",
            "contractAddress": "0x2467aa6b5a2351416fd4c3def8462d841feeecec"
          },
          "ETH": {
            "balance": "1000000000000000000"
          }
        }
      }
    }

    const valueInUSD = appHelpers.computeWalletAggregateValueInUSD(addressData, TOKENS, EXCHANGE_RATES[QBX_ETH_PAIR], EXCHANGE_RATES[ETH_USD_PAIR])
    expect(valueInUSD).toEqual(new BigNumber('155.8'))
  })
})
