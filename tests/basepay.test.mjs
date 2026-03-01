import test from 'node:test';
import assert from 'node:assert/strict';

// Unit test: requestId determinism
import { computeRequestId } from '../src/payments/basePay.js';


test('computeRequestId is deterministic for same payload', () => {
  const proposal = {
    proposal_id: 'prop_1_abcd',
    session_id: 'sess_1_abcd',
    asset: 'BNKR',
    direction: 'buy',
    amount_usd: 10,
    entry_price: 1,
    leverage: 1,
    agent_id: 'achilles',
    policy_set_id: 'olympus-polymarket-v1'
  };

  const a = computeRequestId({ agentId: 'achilles', policySetId: 'olympus-polymarket-v1', proposal });
  const b = computeRequestId({ agentId: 'achilles', policySetId: 'olympus-polymarket-v1', proposal });

  assert.equal(a, b);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});
