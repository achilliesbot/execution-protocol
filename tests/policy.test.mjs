/**
 * Policy Engine Tests
 * Run: node tests/policy.test.mjs
 */

import { evaluateProposal } from '../src/policy/PolicyEngine.ts';
import assert from 'assert';

console.log('Testing Policy Engine...\n');

const baseProposal = {
  proposal_id: 'test-uuid-123',
  session_id: 'session-123',
  asset: 'BNKR',
  direction: 'buy',
  amount_usd: 15,
  entry_price: 0.042,
  stop_loss: 0.038,
  take_profit: 0.048,
  leverage: 1,
  policy_set_id: 'olympus-v1',
  chain: 'base'
};

// Test 1: Valid proposal passes
console.log('Test 1: Valid proposal passes olympus-v1');
const valid = evaluateProposal(baseProposal, 'achilles');
assert.strictEqual(valid.valid, true, 'Valid proposal should pass');
assert.strictEqual(valid.violations.length, 0, 'Should have no violations');
assert.strictEqual(valid.risk_score, 'LOW', 'Should be LOW risk');
console.log('✅ PASS\n');

// Test 2: Amount > $20 fails
console.log('Test 2: Amount > $20 fails (max_single_position)');
const oversized = evaluateProposal({ ...baseProposal, amount_usd: 25 }, 'achilles');
assert.strictEqual(oversized.valid, false, 'Should fail');
assert.ok(oversized.violations.some(v => v.type === 'position_oversized'), 'Should have position_oversized violation');
console.log('✅ PASS\n');

// Test 3: Missing stop loss fails
console.log('Test 3: Missing stop loss fails');
const noSL = evaluateProposal({ ...baseProposal, stop_loss: undefined }, 'achilles');
assert.strictEqual(noSL.valid, false, 'Should fail');
assert.ok(noSL.violations.some(v => v.type === 'stop_loss_missing'), 'Should have stop_loss_missing violation');
console.log('✅ PASS\n');

// Test 4: Missing take profit fails
console.log('Test 4: Missing take profit fails');
const noTP = evaluateProposal({ ...baseProposal, take_profit: undefined }, 'achilles');
assert.strictEqual(noTP.valid, false, 'Should fail');
assert.ok(noTP.violations.some(v => v.type === 'take_profit_missing'), 'Should have take_profit_missing violation');
console.log('✅ PASS\n');

// Test 5: Leverage > 2x fails
console.log('Test 5: Leverage > 2x fails');
const highLeverage = evaluateProposal({ ...baseProposal, leverage: 3 }, 'achilles');
assert.strictEqual(highLeverage.valid, false, 'Should fail');
assert.ok(highLeverage.violations.some(v => v.type === 'excessive_leverage'), 'Should have excessive_leverage violation');
console.log('✅ PASS\n');

// Test 6: Disallowed asset fails
console.log('Test 6: Disallowed asset fails');
const badAsset = evaluateProposal({ ...baseProposal, asset: 'BTC' }, 'achilles');
assert.strictEqual(badAsset.valid, false, 'Should fail');
assert.ok(badAsset.violations.some(v => v.type === 'unauthorized_asset'), 'Should have unauthorized_asset violation');
console.log('✅ PASS\n');

console.log('All policy tests passed ✅');
