# Base Sepolia Testnet Deployment

## Prerequisites

1. Base Sepolia ETH (get from faucet)
2. Private key with testnet funds
3. Basescan API key (for verification)

## Get Testnet ETH

Visit: https://www.coinbase.com/faucets/base-sepolia-faucet

## Environment Setup

Create `.env` file:
```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

## Deploy

```bash
npm install
npx hardhat run scripts/deploy-testnet.js --network baseSepolia
```

## Expected Output

```
Deploying contracts with account: 0x...
Account balance: 500000000000000000

📦 Deploying ExecutionFeeCollector...
✅ ExecutionFeeCollector deployed to: 0x...

📦 Deploying ATTESTRegistry...
✅ ATTESTRegistry deployed to: 0x...

🔗 Setting up contract relationships...
✅ Deployer authorized as executor
✅ Fee parameters set: 0.5% or 0.01 ETH

🎉 Deployment complete!

Contract Addresses:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ExecutionFeeCollector: 0x...
ATTESTRegistry: 0x...
Deployer: 0x...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Post-Deployment

1. Update `execution-acp-service/.env` with contract addresses
2. Start the API service: `npm start`
3. Test the endpoints

## Contract Verification

Contracts will auto-verify if BASESCAN_API_KEY is set.

Manual verification:
```bash
npx hardhat verify --network baseSepolia CONTRACT_ADDRESS [constructor_args]
```
