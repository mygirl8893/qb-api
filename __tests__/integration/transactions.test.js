import chai from 'chai'
import Web3 from 'web3'
import ChildProcess from 'child_process'
import fs from 'fs'
import solc from 'solc'
import request from 'supertest'
import HttpStatus from 'http-status-codes'
import Tx from "ethereumjs-tx"

import APITesting from '../apiTesting'


const PRIVATE_WEB3_PORT = 8545

const START_BALANCE = 10 ** 20

const ACCOUNTS = [{
  address: '0x87265a62c60247f862b9149423061b36b460f4bb',
  secretKey: 'e8280389ca1303a2712a874707fdd5d8ae0437fab9918f845d26fd9919af5a92',
  balance: START_BALANCE
}, {
  address: '0xb99c958777f024bc4ce992b2a0efb2f1f50a4dcf',
  secretKey: 'ed095a912033d26dc444d2675b33414f0561af170d58c33f394db8812c87a764',
  balance: START_BALANCE
}]

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://mainnet.infura.io/<INFURA_TOKEN>'
  },
  tokenDB: 'ADDRESS_PLACEHOLDER_UNTIL_CONTRACT_DEPLOYMENT',
  port: 3000
}

const TOKEN = {
  name: "MagicCarpetsWorld",
  symbol: "MCW",
  decimals: 10,
  rate: 100
}

function getContract(web3, sourceFile, contractName) {
  const loyaltyTokenCode = fs.readFileSync(sourceFile)

  const compiledLoyaltyToken = solc.compile(loyaltyTokenCode.toString(), 1)
  const { bytecode } = compiledLoyaltyToken.contracts[contractName]

  const abi = JSON.parse(compiledLoyaltyToken.contracts[contractName].interface)

  const contract = new web3.eth.Contract(abi)
  contract.options.data = `0x${  bytecode}`
  return contract
}

APITesting.setupTestConfiguration(INTEGRATION_TEST_CONFIGURATION)

/* eslint-disable-next-line no-undef */
jest.setTimeout(30000)

describe('Transactions API Integration', () => {
  let ganacheChildProcess = null
  let app = null
  let loyaltyTokenContractAddress = null

  /* eslint-disable-next-line no-undef */
  beforeAll(async () => {

    console.log('Setting up test environment..')

    let accountsArguments = ''

    ACCOUNTS.forEach((account) => {

      // NOTE the prepending of 0x to indicate hex
      accountsArguments += ` --account="0x${account.secretKey},${account.balance}"`
    })

    const launchGanacheCmd = `./node_modules/ganache-cli/build/cli.node.js --gasLimit 0xfffffffffff --port ${PRIVATE_WEB3_PORT} ${accountsArguments}`

    console.log(`Executing command ${launchGanacheCmd} to launch blockchain test network..`)

    ganacheChildProcess = ChildProcess.exec(launchGanacheCmd)

    // wait for it to start by waiting for some stdout output
    // if it never returns data, jest will eventually timeout
    await new Promise((resolve) => {
      ganacheChildProcess.stdout.on('data', (data) => {
        resolve(data)
      })
    })

    console.log('Test network launched. Connecting to it with Web3..')

    const privateWeb3 = new Web3(INTEGRATION_TEST_CONFIGURATION.rpc.private)
    await privateWeb3.eth.net.isListening()

    const transactionCount = await privateWeb3.eth.getTransactionCount(ACCOUNTS[0].address)

    console.log(`Connection successful. Address ${ACCOUNTS[0].address} has ${transactionCount} transactions.`)

    console.log('Compiling loyalty token contract..')

    const loyaltyTokenContract = getContract(privateWeb3, './src/contracts/loyaltyToken.sol', ':SmartToken')

    loyaltyTokenContract.options.from = ACCOUNTS[0].address
    loyaltyTokenContract.options.gas = 900000

    console.log('Deploying the loyalty token contract..')

    const loyaltyTokenContractInstance = await loyaltyTokenContract.deploy({
      arguments: [TOKEN.name, TOKEN.symbol, TOKEN.decimals]
    }).send({
      from: ACCOUNTS[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    loyaltyTokenContractAddress = loyaltyTokenContractInstance.options.address
    loyaltyTokenContract.options.address = loyaltyTokenContractAddress
    console.log(`Loyalty Token contract deployed successfully. The address is ${loyaltyTokenContractAddress}`)

    console.log("Compiling token DB contract..")

    const tokenDBContract = getContract(privateWeb3, './src/contracts/tokenDB.sol', ':TokenDB')

    console.log('Deploying the token DB contract..')

    const tokenDBContractInstance = await tokenDBContract.deploy().send({
      from: ACCOUNTS[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    const tokenDBContractAddress = tokenDBContractInstance.options.address
    tokenDBContract.options.address = tokenDBContractAddress
    INTEGRATION_TEST_CONFIGURATION.tokenDB = tokenDBContractAddress

    console.log(`Token DB contract deployed successfully. The address is ${tokenDBContractAddress}`)

    const setTokenReceipt = await tokenDBContract.methods
      .setToken(loyaltyTokenContractAddress, TOKEN.symbol, TOKEN.name, TOKEN.rate).send({
      from: ACCOUNTS[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    console.log(`Loyalty Token added to token DB in a transaction with hash ${setTokenReceipt.transactionHash}`)

    const initialLoyaltyTokenAmount = 1000000

    const issueTokensReceipt = await loyaltyTokenContract.methods.issue(ACCOUNTS[0].address, initialLoyaltyTokenAmount).send({
      from: ACCOUNTS[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    console.log(issueTokensReceipt)

    /* eslint-disable-next-line global-require */
    app = require('../../app')
  })

  /* eslint-disable-next-line no-undef */
  afterAll(async () => {

    // kill test network
    ganacheChildProcess.kill('SIGINT')
    await new Promise((resolve) => {
      ganacheChildProcess.on('close', () => {
        resolve()
      })
    })
  })

  it('Gets empty transactions history successfully', async () => {
    const transactionsResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    chai.expect(transactionsResponse.status).to.equal(HttpStatus.OK)
    chai.expect(transactionsResponse.body.length).to.equal(0)
  })

  it('Executes 1 transaction and the history now has 1 transaction', async () => {
    const rawTransactionParams = {
      from: ACCOUNTS[0].address,
      to: ACCOUNTS[1].address,
      transferAmount: 10,
      contractAddress: loyaltyTokenContractAddress
    }

    const rawTransactionResponse = await request(app).get(`/transactions/raw`).query(rawTransactionParams)

    chai.expect(rawTransactionResponse.status).to.equal(HttpStatus.OK)
    const rawTransaction = rawTransactionResponse.body

    chai.expect(rawTransaction.from).to.equal(ACCOUNTS[0].address)
    chai.expect(rawTransaction.to).to.equal(loyaltyTokenContractAddress)

    const privateKey = Buffer.from(ACCOUNTS[0].secretKey, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex')

    const postTransferParams = {
      data: serializedTx
    }

    const sendTransactionResponse = await request(app).post(`/transactions/`).send(postTransferParams)

    chai.expect(sendTransactionResponse.status).to.equal(HttpStatus.OK)

    console.log(sendTransactionResponse)

    const transactionsAfterResponse = await request(app).get(`/transactions/${ACCOUNTS[0].address}/history`)

    chai.expect(transactionsAfterResponse.status).to.equal(HttpStatus.OK)
    const transactions = transactionsAfterResponse.body

    chai.expect(transactions.length).to.equal(1)
    const singleTransaction = transactions[0]
    chai.expect(singleTransaction.contract).to.equal(loyaltyTokenContractAddress)
    chai.expect(singleTransaction.value).to.equal(`${rawTransactionParams.transferAmount}`)
    chai.expect(singleTransaction.from.toLowerCase()).to.equal(ACCOUNTS[0].address)
    chai.expect(singleTransaction.to.toLowerCase()).to.equal(ACCOUNTS[1].address)
  })
})

