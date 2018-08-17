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

  const chainUrl = `http://${host}:${port}`

  log.info(`Deploying token db contract to ${chainUrl}. Connecting with web3..`)

  const privateWeb3 = new Web3(chainUrl)
  await privateWeb3.eth.net.isListening()

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

})().catch(e => {
  log.error(`${e}`)
})
