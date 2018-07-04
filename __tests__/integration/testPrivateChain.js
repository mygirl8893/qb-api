import Web3 from 'web3'
import ChildProcess from 'child_process'
import solc from 'solc'
import fs from 'fs'
import path from 'path'

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
  constructor(accounts, token, port) {
    this.accounts = accounts
    this.token = token
    this.port = port
    this.loyaltyTokenContractAddress = null
    this.tokenDBContractAddress = null
  }

  async setup() {

    console.log('Setting up test environment..')

    let accountsArguments = ''

    this.accounts.forEach((account) => {

      // NOTE the prepending of 0x to indicate hex
      accountsArguments += ` --account="0x${account.secretKey},${account.balance}"`
    })

    const launchGanacheCmd = `./node_modules/ganache-cli/build/cli.node.js --gasLimit 0xfffffffffff --blockTime 15 --port ${this.port} ${accountsArguments}`

    console.log(`Executing command ${launchGanacheCmd} to launch blockchain test network..`)

    this.ganacheChildProcess = ChildProcess.exec(launchGanacheCmd)

    // wait for it to start by waiting for some stdout output
    // if it never returns data, jest will eventually timeout
    await new Promise((resolve) => {
      this.ganacheChildProcess.stdout.on('data', (data) => {
        resolve(data)
      })
    })

    console.log('Test network launched. Connecting to it with Web3..')

    const chainUrl = `http://localhost:${this.port}`
    const privateWeb3 = new Web3(chainUrl)
    await privateWeb3.eth.net.isListening()

    const transactionCount = await privateWeb3.eth.getTransactionCount(this.accounts[0].address)

    console.log(`Connection successful. Address ${this.accounts[0].address} has ${transactionCount} transactions.`)

    console.log('Compiling loyalty token contract..')

    const loyaltyTokenContract = getContract(privateWeb3,
      path.resolve(__dirname, '../../src/contracts/loyaltyToken.sol'),
      ':SmartToken')

    loyaltyTokenContract.options.from = this.accounts[0].address
    loyaltyTokenContract.options.gas = 900000

    console.log('Deploying the loyalty token contract..')

    const loyaltyTokenContractInstance = await loyaltyTokenContract.deploy({
      arguments: [this.token.name, this.token.symbol, this.token.decimals]
    }).send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    this.loyaltyTokenContractAddress = loyaltyTokenContractInstance.options.address
    loyaltyTokenContract.options.address = this.loyaltyTokenContractAddress
    console.log(`Loyalty Token contract deployed successfully. The address is ${this.loyaltyTokenContractAddress}`)

    console.log("Compiling token DB contract..")

    const tokenDBContract = getContract(privateWeb3,
      path.resolve(__dirname, '../../src/contracts/tokenDB.sol'),
      ':TokenDB')

    console.log('Deploying the token DB contract..')

    const tokenDBContractInstance = await tokenDBContract.deploy().send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    const tokenDBContractAddress = tokenDBContractInstance.options.address
    tokenDBContract.options.address = tokenDBContractAddress
    this.tokenDBContractAddress = tokenDBContractAddress

    console.log(`Token DB contract deployed successfully. The address is ${this.tokenDBContractAddress}`)

    const setTokenReceipt = await tokenDBContract.methods
      .setToken(this.loyaltyTokenContractAddress, this.token.symbol, this.token.name, this.token.rate).send({
        from: this.accounts[0].address,
        gas: 1500000,
        gasPrice: '30'
      })

    console.log(`Loyalty Token added to token DB in a transaction with hash ${setTokenReceipt.transactionHash}`)

    const initialLoyaltyTokenAmount = 1000000

    const issueTokensReceipt = await loyaltyTokenContract.methods.issue(this.accounts[0].address, initialLoyaltyTokenAmount).send({
      from: this.accounts[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    console.log(`Tokens issued successfully with transaction hash ${issueTokensReceipt.hash}`)

  }

  async tearDown() {
    // kill test network
    this.ganacheChildProcess.kill('SIGINT')
    await new Promise((resolve) => {
      this.ganacheChildProcess.on('close', () => {
        resolve()
      })
    })
  }
}

export default TestPrivateChain
