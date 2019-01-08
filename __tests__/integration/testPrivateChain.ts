// tslint:disable-next-line
const Web3 = require('web3')
import * as childProcess from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as solc from 'solc'
import log from '../../src/logging'

function getContract(web3, sourceFile, contractName) {
  const loyaltyTokenCode = fs.readFileSync(sourceFile)

  const compiledLoyaltyToken = solc.compile(loyaltyTokenCode.toString(), 1)
  const { bytecode } = compiledLoyaltyToken.contracts[contractName]

  const abi = JSON.parse(compiledLoyaltyToken.contracts[contractName].interface)

  const contract = new web3.eth.Contract(abi)
  contract.options.data = `0x${  bytecode}`
  return contract
}

interface TestAccount {
  address: string
  secretKey: string
  balance: number
}

interface TestToken {
  name: string
  symbol: string
  decimals: number
  rate: number
}

class TestPrivateChain {
  public setupBlockCount: number
  public initialLoyaltyTokenAmount: string
  public loyaltyTokenContractAddress: string = null
  private accounts: [TestAccount]
  private token: TestToken
  private port: number
  private ganacheChildProcess: childProcess.ChildProcess
  constructor(accounts, token, port) {
    this.accounts = accounts
    this.token = token
    this.port = port
  }

  public async setup() {

    log.info('Setting up test environment..')

    let accountsArguments = ''

    this.accounts.forEach((account) => {

      // NOTE the prepending of 0x to indicate hex
      accountsArguments += ` --account="0x${account.secretKey},${account.balance}"`
    })

    const launchGanacheCmd
      = `./node_modules/ganache-cli/build/cli.node.js --gasLimit 0xfffffffffff --port ${this.port} ${accountsArguments}`

    log.info(`Executing command ${launchGanacheCmd} to launch blockchain test network..`)

    this.ganacheChildProcess = childProcess.spawn(launchGanacheCmd, [], {shell: true})

    // wait for it to start by waiting for the 'Listening on' std output
    // if it never returns data, jest will eventually timeout
    let error = ''
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

    if (!result) {
      throw new Error(`Failed setting up the test context: ${error}`)
    }

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

    this.initialLoyaltyTokenAmount = '1000000'

    const issueTokensReceipt = await loyaltyTokenContract.methods.issue(this.accounts[0].address,
      this.initialLoyaltyTokenAmount).send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    log.info(`Tokens issued successfully with transaction hash ${issueTokensReceipt.hash}`)

    const latestBlock = await privateWeb3.eth.getBlock('latest')
    this.setupBlockCount = latestBlock.number
  }

  public async tearDown() {
    log.info('Killing the test chain..')
    log.info(`Killing ganacheChildProcess with PID ${this.ganacheChildProcess.pid}...`)
    this.ganacheChildProcess.kill()

    await new Promise((resolve) => {
      this.ganacheChildProcess.on('exit', (err, signal) => {
        log.info(`ganacheChildProcess killed? ${this.ganacheChildProcess.killed}`)
        log.info(`ganacheChildProcess exited with code ${signal}`)
        resolve(signal)
      })
    })

    // force kill test network on Travis cause ganacheChildProcess PID != pgrep -f ganache-cli
    const pidProcess = childProcess.spawn(`pgrep -f ganache-cli`, [], {shell: true})
    let PID
    await new Promise((resolve) => {
      pidProcess.stdout.on('data', async (data) => {
        PID = data.toString()
        log.info(`ganache-cli PID is ${PID}`)
        resolve(true)
      })
      pidProcess.stdout.on('close', async () => {
        resolve(true)
      })
    })

    if (PID) {
      const killProcess = childProcess.spawn(`kill -9 ${PID}`, [], { shell: true })
      log.info(`Killing ganache-cli with PID ${PID}...`)
      await new Promise((resolve) => {
        killProcess.stdout.on('close', (data) => {
          log.info(`ganache-cli killed`)
          resolve(true)
        })
      })
    }

    log.info('Done with sending a kill signal.')
  }
}

export default TestPrivateChain
