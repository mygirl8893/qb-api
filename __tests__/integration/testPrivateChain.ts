const Web3 = require('web3')
import * as childProcess from 'child_process'
import * as solc from 'solc'
import * as fs from 'fs'
import * as path from 'path'
import log from '../../src/logging'
import utils from '../../src/lib/utils'
import { ChildProcess } from "child_process";

function getContract(web3, sourceFile, contractName) {
  const loyaltyTokenCode = fs.readFileSync(sourceFile)

  const compiledLoyaltyToken = solc.compile(loyaltyTokenCode.toString(), 1)
  const { bytecode } = compiledLoyaltyToken.contracts[contractName]

  const abi = JSON.parse(compiledLoyaltyToken.contracts[contractName].interface)

  const contract = new web3.eth.Contract(abi)
  contract.options.data = `0x${  bytecode}`
  return contract
}

class TestPrivateChain {
  public accounts: any
  public token: any
  public port: number
  public loyaltyTokenContractAddress: string = null
  public tokenDBContractAddress: string = null
  private ganacheChildProcess: ChildProcess
  constructor(accounts, token, port) {
    this.accounts = accounts
    this.token = token
    this.port = port
  }

  async setup() {

    log.info('Setting up test environment..')

    let accountsArguments = ''

    this.accounts.forEach((account) => {

      // NOTE the prepending of 0x to indicate hex
      accountsArguments += ` --account="0x${account.secretKey},${account.balance}"`
    })

    const launchGanacheCmd = `./node_modules/ganache-cli/build/cli.node.js --gasLimit 0xfffffffffff --port ${this.port} ${accountsArguments}`

    log.info(`Executing command ${launchGanacheCmd} to launch blockchain test network..`)

    this.ganacheChildProcess = childProcess.spawn(launchGanacheCmd, [], {shell: true})

    // wait for it to start by waiting for the 'Listening on' std output
    // if it never returns data, jest will eventually timeout
    let error = ""
    const result = await new Promise((resolve) => {
      this.ganacheChildProcess.stdout.on('data', (data) => {
        const dataString = data.toString()
        if (dataString.indexOf('Listening on') > -1) {
          resolve(true)
        }
        if (dataString.indexOf('Error: listen EADDRINUSE') > -1) {
          error = dataString
          resolve(false)
        }
      })
    })

    if (!result) throw `Failed setting up the test context: ${error}`

    log.info('Test network launched. Connecting to it with Web3..')

    const chainUrl = `http://localhost:${this.port}`
    const privateWeb3 = new Web3(chainUrl)
    await privateWeb3.eth.net.isListening()

    const transactionCount = await privateWeb3.eth.getTransactionCount(this.accounts[0].address)

    log.info(`Connection successful. Address ${this.accounts[0].address} has ${transactionCount} transactions.`)

    log.info('Compiling loyalty token contract..')

    const loyaltyTokenContract = getContract(privateWeb3,
      path.resolve(__dirname, '../../src/contracts/loyaltyToken.sol'),
      ':SmartToken')

    loyaltyTokenContract.options.from = this.accounts[0].address
    loyaltyTokenContract.options.gas = 900000

    log.info('Deploying the loyalty token contract..')

    const loyaltyTokenContractInstance = await loyaltyTokenContract.deploy({
      arguments: [this.token.name, this.token.symbol, this.token.decimals]
    }).send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    this.loyaltyTokenContractAddress = loyaltyTokenContractInstance.options.address
    loyaltyTokenContract.options.address = this.loyaltyTokenContractAddress
    log.info(`Loyalty Token contract deployed successfully. The address is ${this.loyaltyTokenContractAddress}`)

    log.info("Compiling token DB contract..")

    const tokenDBContract = getContract(privateWeb3,
      path.resolve(__dirname, '../../src/contracts/tokenDB.sol'),
      ':TokenDB')

    log.info('Deploying the token DB contract..')

    const tokenDBContractInstance = await tokenDBContract.deploy().send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    const tokenDBContractAddress = tokenDBContractInstance.options.address
    tokenDBContract.options.address = tokenDBContractAddress
    this.tokenDBContractAddress = tokenDBContractAddress

    log.info(`Token DB contract deployed successfully. The address is ${this.tokenDBContractAddress}`)

    const setTokenReceipt = await tokenDBContract.methods
      .setToken(this.loyaltyTokenContractAddress, this.token.symbol, this.token.name, this.token.rate).send({
        from: this.accounts[0].address,
        gas: 1500000,
        gasPrice: '30'
      })

    log.info(`Loyalty Token added to token DB in a transaction with hash ${setTokenReceipt.transactionHash}`)

    const initialLoyaltyTokenAmount = 1000000

    const issueTokensReceipt = await loyaltyTokenContract.methods.issue(this.accounts[0].address, initialLoyaltyTokenAmount).send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    log.info(`Tokens issued successfully with transaction hash ${issueTokensReceipt.hash}`)

  }

  async tearDown() {

    log.info('Killing the test chain..')
    log.info(`Killing ganacheChildProcess with PID ${this.ganacheChildProcess.pid}...`)
    this.ganacheChildProcess.kill()
    log.info(`ganacheChildProcess killed? ${this.ganacheChildProcess.killed}`)

    // force kill test network on Travis cause ganacheChildProcess PID != pgrep -f ganache-cli
    const ganacheCliProcess = childProcess.spawn(`pgrep -f ganache-cli`, [], {shell: true})
    ganacheCliProcess.stdout.on('data', (data) => {
      const PID = data.toString()
      log.info(`Killing ganache-cli with PID ${PID}`)
      const cmd = `kill -9 ${PID}`
      childProcess.spawn(cmd, [], {shell: true})
    })

    await utils.sleep(3000)

    log.info('Done with sending a kill signal.')
  }
}


export default TestPrivateChain
