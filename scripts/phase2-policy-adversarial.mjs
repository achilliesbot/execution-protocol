/**
 * Phase 7 — P7-3 Policy Set Adversarial Simulation (Node ESM)
 * 
 * Proves Phase 2 ($200 real capital) policy caps cannot be violated.
 */

import { createPhase2PolicySet, validateAgainstPolicySet } from '../dist/policy/index.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function baseState() {
  return {
    timestamp: '2026-02-26T00:00:00Z',
    portfolio: {
      allocated_capital_usd: 200,
      daily_loss_usd: 0,
      open_positions_count: 0
    }
  };
}

function baseProposal() {
  return {
    timestamp: '2026-02-26T00:00:00Z',
    intent: {
      asset_out: { symbol: 'BNKR' },
      amount: { value: 10, unit: 'USD' }
    },
    intent_amount_usd: 10,
    constraints: {
      stop_loss: { percent: 2 },
      take_profit: { percent: 4 },
      leverage: 1,
      slippage_percent: 0.5
    }
  };
}

function run() {
  const policy = createPhase2PolicySet();
  const state = baseState();

  // 1) Valid baseline
  {
    const p = baseProposal();
    const r = validateAgainstPolicySet(p, policy, state);
    assert(r.valid, 'Baseline proposal should be valid');
  }

  // 2) Max single position > $40
  {
    const p = baseProposal();
    p.intent.amount.value = 41;
    p.intent_amount_usd = 41;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Position > $40 must be blocked');
  }

  // 3) Daily loss > $20
  {
    const p = baseProposal();
    const s = baseState();
    s.portfolio.daily_loss_usd = 21;
    const r = validateAgainstPolicySet(p, policy, s);
    assert(!r.valid, 'Daily loss > $20 must be blocked');
  }

  // 4) Open positions > 3
  {
    const p = baseProposal();
    const s = baseState();
    s.portfolio.open_positions_count = 4;
    const r = validateAgainstPolicySet(p, policy, s);
    assert(!r.valid, 'Open positions > 3 must be blocked');
  }

  // 5) Disallowed asset
  {
    const p = baseProposal();
    p.intent.asset_out.symbol = 'ETH';
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Disallowed asset must be blocked');
  }

  // 6) Missing stop loss
  {
    const p = baseProposal();
    p.constraints.stop_loss = null;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Missing stop loss must be blocked');
  }

  // 7) Missing take profit
  {
    const p = baseProposal();
    p.constraints.take_profit = null;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Missing take profit must be blocked');
  }

  // 8) Leverage > 2x
  {
    const p = baseProposal();
    p.constraints.leverage = 3;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Leverage > 2 must be blocked');
  }

  // 9) Slippage > 1%
  {
    const p = baseProposal();
    p.constraints.slippage_percent = 1.5;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, 'Slippage > 1% must be blocked');
  }

  // 10) Autonomy threshold: $20+ must escalate (treated as invalid until approval gate)
  {
    const p = baseProposal();
    p.intent.amount.value = 20;
    p.intent_amount_usd = 20;
    const r = validateAgainstPolicySet(p, policy, state);
    assert(!r.valid, '$20 trade must require approval (escalate)');
    assert(r.violations.some(v => v.action === 'escalate'), 'Expected escalate violation');
  }

  console.log('✅ Phase 2 Policy Adversarial Simulation PASS (all caps enforced)');
}

run();
