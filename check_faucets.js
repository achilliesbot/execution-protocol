const https = require('https');

// Try multiple faucet APIs
const faucets = [
  { name: 'Paradigm', url: 'https://faucet.paradigm.xyz/api/v1/claim', method: 'POST', body: { address: '0xf1fEF679d32F79EeD780dc460Da3414B1A2e6148', network: 'base-sepolia' } },
  { name: 'Bware', url: 'https://bwarelabs.com/faucets', method: 'GET' },
  { name: 'GetBlock', url: 'https://getblock.io/faucet/base-sepolia/', method: 'GET' }
];

console.log('Checking alternative faucet options...');
console.log('Target address: 0xf1fEF679d32F79EeD780dc460Da3414B1A2e6148');
console.log('');

// Check current balance first
const Web3 = require('web3');
const web3 = new Web3('https://sepolia.base.org');

web3.eth.getBalance('0xf1fEF679d32F79EeD780dc460Da3414B1A2e6148')
  .then(balance => {
    console.log('Current Base Sepolia balance:', web3.utils.fromWei(balance, 'ether'), 'ETH');
    if (parseFloat(web3.utils.fromWei(balance, 'ether')) > 0.01) {
      console.log('✅ Account already funded! Ready to deploy.');
    } else {
      console.log('❌ Insufficient balance. Need faucet.');
    }
  })
  .catch(err => console.log('Error checking balance:', err.message));
