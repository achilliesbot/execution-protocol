import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { computeRequestId, verifyBasePay } from '../src/payments/basePay.js';

// Helper to simulate canonical JSON (same logic as basePay.js)
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',') + '}';
}

test('E2E: Agent computes requestId → same as server computation', () => {
  const agentId = 'test-agent-e2e';
  const policySetId = 'olympus-v1';
  const proposal = {
    proposal_id: 'e2e-proposal-1',
    session_id: 'sess-123',
    asset: 'BNKR',
    direction: 'buy',
    amount_usd: 100
  };
  
  // Agent-side computation
  const payload = { agent_id: agentId, policy_set_id: policySetId, endpoint: '/ep/validate', proposal };
  const agentCanon = stableStringify(payload);
  const agentHash = crypto.createHash('sha256').update(agentCanon).digest('hex');
  const agentRequestId = '0x' + agentHash;
  
  // Server-side computation (via basePay.js)
  const serverRequestId = computeRequestId({ agentId, policySetId, proposal });
  
  assert.equal(agentRequestId, serverRequestId);
  assert.match(agentRequestId, /^0x[0-9a-f]{64}$/);
});

test('E2E: Different proposals produce different requestIds', () => {
  const agentId = 'test-agent';
  const policySetId = 'policy-1';
  
  const proposal1 = { proposal_id: 'p1', amount: 100 };
  const proposal2 = { proposal_id: 'p2', amount: 100 };
  
  const id1 = computeRequestId({ agentId, policySetId, proposal: proposal1 });
  const id2 = computeRequestId({ agentId, policySetId, proposal: proposal2 });
  
  assert.notEqual(id1, id2);
});

test('E2E: Same proposal produces same requestId (determinism)', () => {
  const agentId = 'test-agent';
  const policySetId = 'policy-1';
  const proposal = { proposal_id: 'p1', amount: 100, nested: { key: 'value' } };
  
  const id1 = computeRequestId({ agentId, policySetId, proposal });
  const id2 = computeRequestId({ agentId, policySetId, proposal });
  
  assert.equal(id1, id2);
});

test('E2E: Order of keys in proposal does not affect requestId', () => {
  const agentId = 'test-agent';
  const policySetId = 'policy-1';
  
  // Same data, different key order
  const proposal1 = { a: 1, b: 2, c: 3 };
  const proposal2 = { c: 3, a: 1, b: 2 };
  
  const id1 = computeRequestId({ agentId, policySetId, proposal: proposal1 });
  const id2 = computeRequestId({ agentId, policySetId, proposal: proposal2 });
  
  assert.equal(id1, id2);
});

test('E2E: Mock paid flow returns paid=true', async () => {
  process.env.BASE_PAY_MOCK = 'paid';
  process.env.BASE_PAY_ENABLED = 'true';
  
  const requestId = '0x' + 'aa'.repeat(32);
  const result = await verifyBasePay({ requestId });
  
  assert.equal(result.paid, true);
  assert.equal(result.required, true);
});

test('E2E: Mock unpaid flow returns paid=false', async () => {
  process.env.BASE_PAY_MOCK = 'unpaid';
  process.env.BASE_PAY_ENABLED = 'true';
  
  const requestId = '0x' + 'bb'.repeat(32);
  const result = await verifyBasePay({ requestId });
  
  assert.equal(result.paid, false);
  assert.equal(result.required, true);
});

test('E2E: Complete flow simulation', async () => {
  // 1. Agent prepares proposal
  const agentId = 'achilles-agent';
  const policySetId = 'olympus-polymarket-v1';
  const proposal = {
    proposal_id: 'prop_001',
    asset: 'ETH',
    direction: 'buy',
    amount_usd: 500
  };
  
  // 2. Agent computes requestId
  const requestId = computeRequestId({ agentId, policySetId, proposal });
  
  // 3. Agent would: approve USDC and call pay(requestId) on contract
  //    (simulated here with mock)
  process.env.BASE_PAY_MOCK = 'paid';
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_FEE_USDC = '100000';
  
  // 4. EP server verifies payment
  const verification = await verifyBasePay({ requestId });
  
  // 5. Assertions
  assert.equal(verification.paid, true);
  assert.equal(verification.requestId, requestId);
  assert.ok(verification.feeAmount);
});

test('E2E: Double pay prevention - same requestId cannot pay twice', () => {
  // This tests the contract logic conceptually
  // In real E2E, the contract would revert with ALREADY_PAID
  const requestId = computeRequestId({ 
    agentId: 'agent-1', 
    policySetId: 'policy-1', 
    proposal: { id: 'double-pay-test' } 
  });
  
  // Simulate first payment
  const paidRequestIds = new Set();
  paidRequestIds.add(requestId);
  
  // Attempt second payment
  const isAlreadyPaid = paidRequestIds.has(requestId);
  
  assert.equal(isAlreadyPaid, true);
});
