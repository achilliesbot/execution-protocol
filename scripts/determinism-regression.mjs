/**
 * Determinism Regression Harness (P7-1)
 * Focus: ExecutionPlan determinism — same inputs => identical deterministic hash.
 * Uses compiled dist/ modules (ESM-safe).
 */

import {
  computeHash
} from '../dist/canonicalization/index.js';

import {
  createPhase1PolicySet
} from '../dist/policy/index.js';

import {
  generateExecutionPlan
} from '../dist/execution/index.js';

// Fixed deterministic fixtures
const FIXED_PROPOSAL = {
  schema_version: 'v1',
  proposal_id: 'fixed-prop-0001',
  timestamp: '2026-02-24T00:00:00.000Z',
  expiry: '2026-02-24T01:00:00.000Z',
  execution_domain: 'base',
  environment: 'simulation',
  opportunity_type: 'swap',
  intent: {
    action: 'swap',
    asset_in: { symbol: 'USDC', chain: 'base', decimals: 6 },
    asset_out: { symbol: 'ETH', chain: 'base', decimals: 18 },
    amount: { type: 'exact', value: 25, unit: 'usd' }
  },
  risk_budget: { max_drawdown_percent: 10, max_loss_usd: 5, max_loss_percent: 10, position_size_percent: 25, risk_reward_min: 2 },
  constraints: { slippage_tolerance_percent: 1.0, stop_loss: { price: 0, type: 'fixed' }, allow_partial_fill: true, deadline: '2026-02-24T01:00:00.000Z', require_success: false },
  reasoning: { alternatives_considered: [], confidence_explanation: 'fixed', market_conditions: 'fixed', risk_assessment: 'fixed', signal_sources: ['template'], timing_rationale: 'fixed' },
  confidence: 0.75,
  agent_id: 'test-agent',
  session_id: 'fixed-session-0001'
};

const FIXED_STATE = {
  timestamp: '2026-02-24T00:00:00.000Z',
  portfolio: {
    total_value_usd: 200,
    available_capital_usd: 200,
    allocated_capital_usd: 0,
    positions: []
  },
  market: {
    asset_prices: { USDC: 1, ETH: 3000 }
  },
  system: {
    daily_trade_count: 0,
    daily_volume_usd: 0
  }
};

function stablePlanView(plan) {
  // Remove any known non-deterministic or metadata fields if they exist.
  const { plan_id, generated_at, ...rest } = plan;
  return rest;
}

async function main() {
  const policySet = createPhase1PolicySet();

  const hashes = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < 100; i++) {
    const result = generateExecutionPlan(FIXED_PROPOSAL, policySet, FIXED_STATE);
    if (!result.plan) {
      fail++;
      continue;
    }
    ok++;
    hashes.push(computeHash(stablePlanView(result.plan)));
  }

  const unique = new Set(hashes);

  console.log('P7-1 Determinism Regression — ExecutionPlan');
  console.log(`iterations: 100`);
  console.log(`plans_ok: ${ok}`);
  console.log(`plans_fail: ${fail}`);
  console.log(`unique_hashes: ${unique.size}`);
  console.log(`sample: ${hashes[0]?.slice(0, 32) || '—'}...`);

  process.exit(unique.size === 1 && ok === 100 ? 0 : 2);
}

main().catch((e) => {
  console.error('DETERMINISM_REGRESSION_FAILED', e);
  process.exit(1);
});
