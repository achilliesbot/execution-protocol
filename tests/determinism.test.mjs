/**
 * Determinism Tests
 * 100 identical proposals must produce identical proof hashes
 * Run: node tests/determinism.test.mjs
 */

import { evaluateProposal } from '../src/policy/PolicyEngine.ts';
import assert from 'assert';

console.log('Testing Determinism (100 iterations)...\n');

const proposal = {
  proposal_id: 'det-test-uuid',
  session_id: 'det-session',
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

const hashes = [];

for (let i = 0; i < 100; i++) {
  const result = evaluateProposal(proposal, 'achilles');
  hashes.push(result.proof_hash);
}

// All hashes must be identical
const firstHash = hashes[0];
const allSame = hashes.every(h => h === firstHash);

console.log(`First hash: ${firstHash}`);
console.log(`All 100 hashes identical: ${allSame}`);

assert.strictEqual(allSame, true, 'All 100 proof hashes must be identical');

console.log('\n✅ Determinism test passed (100/100 identical) ✅');
