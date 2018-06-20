
/* eslint-disable-next-line no-undef */
const Web3 = jest.genMockFromModule('web3')

Web3.prototype.eth = {
  net: {
    isListening: async () => null,
    getId: async () => 1234
  }
}

export default Web3
