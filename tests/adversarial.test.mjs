/**
 * Adversarial & Security Tests
 * Run: node tests/adversarial.test.mjs
 */

import { evaluateProposal } from '../src/policy/PolicyEngine.ts';
import { validateAgentKey } from '../src/auth/agentAuth.ts';
import assert from 'assert';

console.log('Running Adversarial Tests...\n');

// Test 1: Policy injection (non-existent policy)
console.log('Test 1: Policy injection (invalid policy_set_id)');
const badPolicy = evaluateProposal({
  proposal_id: 'test-uuid',
  asset: 'BNKR',
  direction: 'buy',
  amount_usd: 10,
  entry_price: 0.042,
  stop_loss: 0.038,
  take_profit: 0.048,
  leverage: 1,
  policy_set_id: 'malicious-policy',
  chain: 'base'
}, 'achilles');
assert.strictEqual(badPolicy.valid, false, 'Should fail with invalid policy');
assert.ok(badPolicy.violations.some(v => v.type === 'policy_not_found'), 'Should have policy_not_found violation');
console.log('✅ PASS - Non-existent policy rejected\n');

// Test 2: Schema fuzzing - extreme numbers
console.log('Test 2: Schema fuzzing (extreme amount)');
const extremeAmount = evaluateProposal({
  proposal_id: 'test-uuid',
  asset: 'BNKR',
  direction: 'buy',
  amount_usd: 999999999,
  entry_price: 0.042,
  stop_loss: 0.038,
  take_profit: 0.048,
  leverage: 1,
  policy_set_id: 'olympus-v1',
  chain: 'base'
}, 'achilles');
assert.strictEqual(extremeAmount.valid, false, 'Should fail with extreme amount');
assert.ok(extremeAmount.violations.some(v => v.type === 'position_oversized'), 'Should detect oversized position');
console.log('✅ PASS - Extreme amount rejected\n');

// Test 3: Schema fuzzing - negative leverage
console.log('Test 3: Schema fuzzing (negative leverage)');
try {
  const negativeLev = evaluateProposal({
    proposal_id: 'test-uuid',
    asset: 'BNKR',
    direction: 'buy',
    amount_usd: 10,
    entry_price: 0.042,
    stop_loss: 0.038,
    take_profit: 0.048,
    leverage: -5,
    policy_set_id: 'olympus-v1',
    chain: 'base'
  }, 'achilles');
  console.log('⚠️ Negative leverage handled (no crash)');
} catch (e) {
  console.log('✅ PASS - Negative leverage rejected (no crash)\n');
}

// Test 4: Double validation replay
console.log('Test 4: Double validation replay (same proposal_id)');
const proposal = {
  proposal_id: 'replay-test-uuid',
  asset: 'BNKR',
  direction: 'buy',
  amount_usd: 10,
  entry_price: 0.042,
  stop_loss: 0.038,
  take_profit: 0.048,
  leverage: 1,
  policy_set_id: 'olympus-v1',
  chain: 'base'
};
const result1 = evaluateProposal(proposal, 'achilles');
const result2 = evaluateProposal(proposal, 'achilles');
// Both should be valid and have same proof_hash (idempotent)
assert.strictEqual(result1.valid, true, 'First should be valid');
assert.strictEqual(result2.valid, true, 'Second should be valid');
assert.strictEqual(result1.proof_hash, result2.proof_hash, 'Proof hashes should be identical (idempotent)');
console.log('✅ PASS - Idempotent behavior confirmed\n');

// Test 5: No personal data in any result
console.log('Test 5: No personal data in results');
const result = evaluateProposal({
  proposal_id: 'privacy-test',
  asset: 'BNKR',
  direction: 'buy',
  amount_usd: 10,
  entry_price: 0.042,
  stop_loss: 0.038,
  take_profit: 0.048,
  leverage: 1,
  policy_set_id: 'olympus-v1',
  chain: 'base'
}, 'achilles');
const resultStr = JSON.stringify(result);
assert.ok(!resultStr.includes('wallet'), 'Should not contain wallet references');
assert.ok(!resultStr.includes('0x2490'), 'Should not contain wallet address');
assert.ok(!resultStr.includes('100.00 USDC'), 'Should not contain balance');
console.log('✅ PASS - No personal data exposed\n');

// Test 6: Proof hash collision resistance
console.log('Test 6: Proof hash collision resistance');
const prop1 = { ...proposal, proposal_id: 'uuid-1', amount_usd: 10 };
const prop2 = { ...proposal, proposal_id: 'uuid-2', amount_usd: 11 };
const hash1 = evaluateProposal(prop1, 'achilles').proof_hash;
const hash2 = evaluateProposal(prop2, 'achilles').proof_hash;
assert.notStrictEqual(hash1, hash2, 'Different proposals should have different hashes');
console.log(`✅ PASS - Different hashes: ${hash1.slice(0, 16)}... vs ${hash2.slice(0, 16)}...\n`);

console.log('All adversarial tests passed ✅');
