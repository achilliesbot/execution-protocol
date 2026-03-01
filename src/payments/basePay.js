/**
 * Base Pay verification (USDC on Base) — EP v1
 *
 * EP server verifies that a requestId has been paid before processing /ep/validate.
 * If not paid: return 402 PAYMENT_REQUIRED.
 *
 * Env:
 * - BASE_PAY_ENABLED=true|false (default false)
 * - BASE_PAY_CONTRACT_ADDRESS
 * - BASE_PAY_USDC_ADDRESS
 * - BASE_PAY_FEE_USDC (6dp string; default 100000 => 0.10)
 * - BASE_RPC_URL
 */

import crypto from 'node:crypto';
import { ethers } from 'ethers';

const ABI = [
  'function feeAmount() view returns (uint256)',
  'function receipts(bytes32) view returns (address payer, uint256 amount, uint256 timestamp)',
  'function isPaid(bytes32 requestId) view returns (bool)'
];

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function computeRequestId({ agentId, policySetId, proposal }) {
  const payload = {
    agent_id: agentId,
    policy_set_id: policySetId,
    endpoint: '/ep/validate',
    proposal
  };
  const canon = stableStringify(payload);
  const hash = crypto.createHash('sha256').update(canon).digest();
  return '0x' + hash.toString('hex');
}

export function getBasePayConfig() {
  const enabled = process.env.BASE_PAY_ENABLED === 'true' || process.env.BASE_PAY_ENABLED === '1';
  const contractAddress = process.env.BASE_PAY_CONTRACT_ADDRESS || null;
  const rpcUrl = process.env.BASE_RPC_URL || null;
  const feeUsdc = process.env.BASE_PAY_FEE_USDC || '100000'; // 0.10 USDC

  return { enabled, contractAddress, rpcUrl, feeUsdc };
}

export async function verifyBasePay({ requestId }) {
  const { enabled, contractAddress, rpcUrl, feeUsdc } = getBasePayConfig();

  // Test/dev mock mode (no chain calls)
  // BASE_PAY_MOCK=paid|unpaid
  if (process.env.BASE_PAY_MOCK === 'paid') {
    return {
      required: true,
      paid: true,
      requestId,
      contractAddress: contractAddress || '0xMockContract',
      feeAmount: feeUsdc,
      payer: '0x000000000000000000000000000000000000dEaD'
    };
  }
  if (process.env.BASE_PAY_MOCK === 'unpaid') {
    return {
      required: true,
      paid: false,
      requestId,
      contractAddress: contractAddress || '0xMockContract',
      feeAmount: feeUsdc,
      payer: null
    };
  }

  if (!enabled) {
    return { required: false, paid: true, requestId };
  }

  if (!contractAddress || !rpcUrl) {
    return {
      required: true,
      paid: false,
      requestId,
      contractAddress: contractAddress || null,
      feeAmount: feeUsdc,
      error: 'BASE_PAY_CONTRACT_ADDRESS or BASE_RPC_URL missing'
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  const receipt = await contract.receipts(requestId);
  const payer = receipt?.payer;
  const paid = payer && payer !== ethers.ZeroAddress;

  const feeAmount = await contract.feeAmount();

  return {
    required: true,
    paid: !!paid,
    requestId,
    contractAddress,
    feeAmount: feeAmount.toString(),
    payer: paid ? payer : null
  };
}
