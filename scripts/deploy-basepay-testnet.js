#!/usr/bin/env node
/**
 * deploy-basepay-testnet.js
 *
 * Deploy BasePayContract to Base Sepolia testnet.
 *
 * Prerequisites:
 * 1. Get Base Sepolia ETH from https://docs.base.org/docs/network-information#base-sepolia
 * 2. Get Base Sepolia USDC (or use any ERC20 for testing)
 * 3. Set env vars below
 * 4. Run: node scripts/deploy-basepay-testnet.js
 */

import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';

// Base Sepolia USDC (canonical testnet address)
// If unavailable, any ERC20 works for testing
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const FEE_USDC_6DP = '100000'; // 0.10 USDC

async function main() {
  const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY env var required');
    console.error('Export from MetaMask: Account → ... → Export Private Key');
    process.exit(1);
  }

  console.log('Deploying BasePayContract to Base Sepolia...');
  console.log('RPC:', RPC_URL);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Deployer:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH');

  // Read contract bytecode
  const artifactPath = path.resolve('artifacts/contracts/BasePayContract.sol/BasePayContract.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('Contract artifact not found. Run: npx hardhat compile');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log('Constructor args:');
  console.log('  USDC:', USDC_BASE_SEPOLIA);
  console.log('  Fee:', FEE_USDC_6DP);

  const contract = await factory.deploy(USDC_BASE_SEPOLIA, FEE_USDC_6DP);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  
  console.log('\n=== DEPLOYMENT SUCCESSFUL ===');
  console.log('Contract address:', address);
  console.log('Transaction:', contract.deploymentTransaction().hash);
  console.log('Explorer:', `https://sepolia.basescan.org/address/${address}`);
  console.log('\nSet these env vars for EP server:');
  console.log(`  BASE_PAY_CONTRACT_ADDRESS=${address}`);
  console.log(`  BASE_PAY_USDC_ADDRESS=${USDC_BASE_SEPOLIA}`);
  console.log(`  BASE_PAY_FEE_USDC=${FEE_USDC_6DP}`);
  console.log(`  BASE_RPC_URL=${RPC_URL}`);
}

main().catch(console.error);
