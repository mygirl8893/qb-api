pragma solidity ^0.4.16;

contract TokenDB {
    
    struct Token {
        string symbol;
        string name;
        uint rate;
    }
    
    mapping (address => Token) Tokens;
    address[] public TokenAccts;
    
    function setToken(address _address, string _symbol, string _name, uint _rate) public {
        var Token = Tokens[_address];

        Token.symbol = _symbol;
        Token.name = _name;
        Token.rate = _rate;
        
        TokenAccts.push(_address) -1;
    }

    function findToken(address _address) returns(uint) {
        uint i = 0;
        while (TokenAccts[i] != _address) {
            i++;
        }
        return i;
    }

    function removeByValue(address _address) {
        uint i = findToken(_address);
        removeByIndex(i);
    }

    function removeByIndex(uint i) {
        while (i<TokenAccts.length-1) {
            TokenAccts[i] = TokenAccts[i+1];
            i++;
        }
        TokenAccts.length--;
    }
	
    function getTokens() view public returns(address[]) {
        return TokenAccts;
    }
    
    function getToken(address _address) view public returns (string, string, uint) {
        return (Tokens[_address].symbol, Tokens[_address].name, Tokens[_address].rate);
    }
    
    function countTokens() view public returns (uint) {
        return TokenAccts.length;
    }
    
}
