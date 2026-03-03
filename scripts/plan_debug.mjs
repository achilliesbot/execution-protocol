import { generateExecutionPlan } from '../dist/execution/ExecutionPlanGenerator.js';
import { createPhase1PolicySet } from '../dist/policy/index.js';

const fixedProposal = {
  schema_version: 'v1',
  proposal_id: 'fixed-proposal-0001',
  timestamp: '2026-02-24T00:00:00.000Z',
  expiry: '2026-02-24T01:00:00.000Z',
  execution_domain: 'test',
  environment: 'simulation',
  opportunity_type: 'arbitrage',
  intent: {
    action: 'swap',
    asset_in: { symbol: 'USDC', chain: 'base', decimals: 6, address: '0xUSDC' },
    asset_out: { symbol: 'ETH', chain: 'base', decimals: 18, address: '0xETH' },
    amount: { type: 'exact', value: 10, unit: 'usd' }
  },
  risk_budget: { max_drawdown_percent: 1 },
  constraints: { slippage_tolerance_percent: 1.0, stop_loss: null },
  reasoning: {},
  confidence: 0.95,
  agent_id: 'test-agent',
  session_id: 'fixed-session-0001'
};

const fixedState = {
  timestamp: '2026-02-24T00:00:00.000Z',
  portfolio: { total_value_usd: 1000, available_capital_usd: 1000, allocated_capital_usd: 0, positions: [] },
  market: { asset_prices: { USDC: 1, ETH: 2000 }, network_congestion: 'low' },
  system: { daily_trade_count: 0, daily_volume_usd: 0 }
};

const policySet = createPhase1PolicySet();

function runOnce(i) {
  const realDateNow = Date.now;
  const realRandom = Math.random;
  Date.now = () => 1677200000000; // fixed
  Math.random = () => 0.123456;

  const result = generateExecutionPlan(fixedProposal, policySet, fixedState);

  Date.now = realDateNow;
  Math.random = realRandom;

  return result;
}

(async ()=>{
  const out1 = runOnce(1);
  const out2 = runOnce(2);
  console.log('=== PLAN RUN 1 ===');
  console.log(JSON.stringify(out1, null, 2));
  console.log('\n=== PLAN RUN 2 ===');
  console.log(JSON.stringify(out2, null, 2));
})();
