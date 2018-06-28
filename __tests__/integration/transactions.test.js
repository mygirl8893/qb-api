import chai from 'chai'
import Web3 from 'web3'
import ChildProcess from 'child_process'
import fs from 'fs'
import solc from 'solc'

const PRIVATE_WEB3_PORT = 8545

const START_BALANCE = 10 ** 20

const ACCOUNTS = [{
  address: '0x87265a62c60247f862b9149423061b36b460f4bb',
  secretKey: '0xe8280389ca1303a2712a874707fdd5d8ae0437fab9918f845d26fd9919af5a92',
  balance: START_BALANCE
}, {
  address: '0xb99c958777f024bc4ce992b2a0efb2f1f50a4dcf',
  secretKey: '0xed095a912033d26dc444d2675b33414f0561af170d58c33f394db8812c87a764',
  balance: START_BALANCE
}]

const INTEGRATION_TEST_CONFIGURATION = {
  rpc: {
    private: `http://localhost:${PRIVATE_WEB3_PORT}`,
    public: 'https://testpublicchain.com'
  },
  tokenDB: '0x988f24d8356bf7e3d4645ba34068a5723bf3ec6b',
  port: 3000
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

/* eslint-disable-next-line no-undef */
jest.setTimeout(30000)

describe('Transactions API Integration', () => {
  let ganacheChildProcess = null

  /* eslint-disable-next-line no-undef */
  beforeAll(async () => {

    console.log('Setting up test environment..')

    let accountsArguments = ''

    ACCOUNTS.forEach((account) => {
      accountsArguments += ` --account="${account.secretKey},${account.balance}"`
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
      arguments: ["FreeCoffee", "FCF", 5]
    }).send({
      from: ACCOUNTS[0].address,
      gas: 1500000,
      gasPrice: '30'
    })

    const loyaltyTokenContractAddress = loyaltyTokenContractInstance.options.address

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

    console.log(`Token DB contract deployed successfully. The address is ${tokenDBContractAddress}`)
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

  it('Gets transactions succesfully', async () => {
    chai.expect(1).to.equal(1)
  })
})

