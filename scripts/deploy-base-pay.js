#!/usr/bin/env node
/**
 * deploy-base-pay.js
 *
 * Commander deploys from MetaMask.
 *
 * This script prints the deployment parameters and recommended deployment steps.
 *
 * Recommended deployment method (no private keys on disk):
 * 1) Open https://remix.ethereum.org
 * 2) Create contracts/BasePayContract.sol and paste the contract
 * 3) Compile with Solidity 0.8.20+
 * 4) Connect MetaMask to Base mainnet (chainId 8453)
 * 5) Deploy with constructor args below
 */

import fs from 'node:fs';
import path from 'node:path';

const CONTRACT_PATH = path.resolve('contracts/BasePayContract.sol');

const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// 0.10 USDC in 6 decimals
const DEFAULT_FEE_USDC_6DP = '100000';

function main() {
  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error(`Missing contract file: ${CONTRACT_PATH}`);
    process.exit(1);
  }

  console.log('=== BasePayContract Deployment (Commander/MetaMask) ===');
  console.log('Network: Base Mainnet (chainId 8453)');
  console.log('Contract:', CONTRACT_PATH);
  console.log('Constructor args:');
  console.log(`  usdcToken:       ${USDC_BASE_MAINNET}`);
  console.log(`  initialFeeAmount:${DEFAULT_FEE_USDC_6DP}  // 0.10 USDC (6dp)`);
  console.log('  initialFeeCollector: <COMMANDER_WALLET_ADDRESS>');
  console.log('');
  console.log('After deploy, configure EP server env:');
  console.log('  BASE_PAY_CONTRACT_ADDRESS=<deployed_contract>');
  console.log(`  BASE_PAY_USDC_ADDRESS=${USDC_BASE_MAINNET}`);
  console.log(`  BASE_PAY_FEE_USDC=${DEFAULT_FEE_USDC_6DP}`);
  console.log('  BASE_RPC_URL=<Base RPC URL>');
  console.log('');
  console.log('Then agents pay per request:');
  console.log('  1) approve USDC to contract');
  console.log('  2) call pay(requestId)');
}

main();
