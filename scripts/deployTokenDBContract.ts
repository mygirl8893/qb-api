const Web3 = require('web3')
import log from '../src/logging'
import * as path from 'path'
import * as fs from 'fs'
import * as solc from 'solc'

function getContract(web3, sourceFile, contractName) {
  const loyaltyTokenCode = fs.readFileSync(sourceFile)

  const compiledLoyaltyToken = solc.compile(loyaltyTokenCode.toString(), 1)
  const { bytecode } = compiledLoyaltyToken.contracts[contractName]

  const abi = JSON.parse(compiledLoyaltyToken.contracts[contractName].interface)

  const contract = new web3.eth.Contract(abi)
  contract.options.data = `0x${  bytecode}`
  return contract
}

const masterAccount = {
    address: ''
}


;(async () => {

  const host = process.argv[2]
  const port = process.argv[3]
  const contractType = process.argv[4]
  const ownerAddress = "0xd49a1fefbb414012347df4814f2cf76e48bc53e9"
  const password = ""

  const chainUrl = `http://${host}:${port}`
  const privateWeb3 = new Web3(chainUrl)
  await privateWeb3.eth.net.isListening()
  log.info(`Connected to chain at ${chainUrl}`)

  //await privateWeb3.personal.unlockAccount(ownerAddress, password, 100000)

  if (contractType === 'tokendb') {

    log.info(`Deploying token db contract to ${chainUrl}. Connecting with web3..`)

    log.info("Compiling token DB contract..")

    const tokenDBContract = getContract(privateWeb3,
      path.resolve(__dirname, '../src/contracts/tokenDB.sol'),
      ':TokenDB')

    log.info('Deploying the token DB contract..')

    const tokenDBContractInstance = await tokenDBContract.deploy().send({
      from: masterAccount.address,
      gas: 1500000,
      gasPrice: '0'
    })

    const tokenDBContractAddress = tokenDBContractInstance.options.address
    tokenDBContract.options.address = tokenDBContractAddress
    this.tokenDBContractAddress = tokenDBContractAddress

    log.info(`Token DB contract deployed successfully. The address is ${this.tokenDBContractAddress}`)
  } else if (contractType === 'loyalty') {

    const name = 'Sausalito coin' // process.argv[5]
    const symbol = 'SPX' //process.argv[6]
    const decimals = 18
    log.info(`Deploying loyalty contract to ${chainUrl} wit name ${name} and symbol ${symbol}. Connecting with web3..`)
    log.info('Compiling loyalty token contract..')

    const loyaltyTokenContract = getContract(privateWeb3,
      path.resolve(__dirname, '../src/contracts/loyaltyToken.sol'),
      ':SmartToken')

    loyaltyTokenContract.options.from = ownerAddress
    loyaltyTokenContract.options.gas = 1500000

    log.info('Deploying the loyalty token contract..')

    const loyaltyTokenContractInstance = await loyaltyTokenContract.deploy({
      arguments: [name, symbol, decimals]
    }).send({
      from: ownerAddress,
      gas: 1500000,
      gasPrice: '0'
    })

    const loyaltyTokenContractAddress = loyaltyTokenContractInstance.options.address
    log.info(`Loyalty Token contract deployed successfully. The address is ${loyaltyTokenContractAddress}`)

  } else {
    throw new Error(`Unknown contract type ${contractType}`)
  }



})().catch(e => {
  log.error(`${e}`)
})
