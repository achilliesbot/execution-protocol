/**
 * P7-5 Test: Trade Ledger + Reconciliation
 */

import { appendTradeEntry, reconcileTradeLedger, readTradeLedger } from '../dist/ledger/index.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  // isolate HOME
  process.env.HOME = '/tmp';

  // Append SIM entry
  const e1 = appendTradeEntry({
    session_id: 'sess1',
    signal_id: 'sig1',
    signal_hash: 'sha256:sig1',
    plan_hash: 'sha256:plan1',
    policy_set_hash: 'sha256:policy2',
    transcript_head_hash: 'sha256:th1',
    asset: 'BNKR',
    direction: 'buy',
    amount_usd: 10,
    settlement: { mode: 'SIM' }
  });
  assert(!!e1.entry_hash, 'entry_hash required');

  // Append DRY_RUN entry
  const e2 = appendTradeEntry({
    session_id: 'sess2',
    signal_id: 'sig2',
    signal_hash: 'sha256:sig2',
    plan_hash: 'sha256:plan2',
    policy_set_hash: 'sha256:policy2',
    transcript_head_hash: 'sha256:th2',
    asset: 'CLAWD',
    direction: 'swap',
    amount_usd: 15,
    settlement: {
      mode: 'DRY_RUN',
      tx_payload_hash: 'sha256:payload',
      tx_payload: { to: '0xabc', data: '0xdead', value: '0', gas_limit: 100000 }
    }
  });
  assert(e2.prev_entry_hash === e1.entry_hash, 'hash chain must link');

  // Append LIVE entry
  const e3 = appendTradeEntry({
    session_id: 'sess3',
    signal_id: 'sig3',
    signal_hash: 'sha256:sig3',
    plan_hash: 'sha256:plan3',
    policy_set_hash: 'sha256:policy2',
    transcript_head_hash: 'sha256:th3',
    asset: 'BNKRW',
    direction: 'sell',
    amount_usd: 5,
    settlement: { mode: 'LIVE', transaction_hash: '0xtx', status: 'PENDING' }
  });
  assert(e3.prev_entry_hash === e2.entry_hash, 'hash chain must link');

  const entries = readTradeLedger();
  assert(entries.length >= 3, 'should have entries');

  const report = reconcileTradeLedger();
  assert(report.ok, `reconciliation must pass: ${JSON.stringify(report)}`);

  console.log('✅ P7-5 Trade Ledger + Reconciliation Test PASS');
}

run();
