/**
 * P7-4 Test: Execution Toggle
 */

import { settleWithExecutionToggle } from '../dist/settlement/index.js';

// Minimal adapter stub
const adapter = {
  mode: 'null',
  name: 'TestAdapter',
  settleCalls: [] as any[],
  async settle(req: any, simulate: boolean) {
    this.settleCalls.push({ simulate, req });
    return {
      success: true,
      transaction_hash: simulate ? 'sim_hash' : 'live_hash',
      status: simulate ? 'SIMULATED' : 'PENDING',
      timestamp: '2026-02-26T00:00:00Z'
    };
  },
  isReady() { return true; },
  getStatus() { return { ready: true, mode: 'null', simulate: true }; }
};

const req = {
  entry_id: 'entry_123',
  amount: 10,
  currency: 'USD',
  recipient: '0x1111111111111111111111111111111111111111',
  metadata: { session_id: 's1', transcript_head_hash: 'sha256:abc' }
};

async function run() {
  // SIM default
  delete process.env.EXECUTION_MODE;
  delete process.env.LIVE_OPERATOR_ACK;
  adapter.settleCalls = [];
  const sim = await settleWithExecutionToggle(adapter as any, req as any);
  if (sim.mode !== 'SIM') throw new Error('Expected SIM');
  if (adapter.settleCalls[0]?.simulate !== true) throw new Error('SIM must call settle(simulate=true)');

  // DRY_RUN
  process.env.EXECUTION_MODE = 'DRY_RUN';
  adapter.settleCalls = [];
  const dry = await settleWithExecutionToggle(adapter as any, req as any);
  if (dry.mode !== 'DRY_RUN') throw new Error('Expected DRY_RUN');
  if (!dry.tx_payload || !dry.tx_payload_hash) throw new Error('DRY_RUN must include tx payload + hash');
  if (adapter.settleCalls.length !== 0) throw new Error('DRY_RUN must not call adapter.settle');

  // LIVE without ACK (must fail closed)
  process.env.EXECUTION_MODE = 'LIVE';
  delete process.env.LIVE_OPERATOR_ACK;
  adapter.settleCalls = [];
  const liveBlocked = await settleWithExecutionToggle(adapter as any, req as any);
  if (liveBlocked.success !== false) throw new Error('LIVE without ACK must fail');
  if (adapter.settleCalls.length !== 0) throw new Error('LIVE without ACK must not call adapter.settle');

  // LIVE with ACK (allowed to attempt)
  process.env.EXECUTION_MODE = 'LIVE';
  process.env.LIVE_OPERATOR_ACK = 'I_UNDERSTAND_LIVE';
  adapter.settleCalls = [];
  const live = await settleWithExecutionToggle(adapter as any, req as any);
  if (live.mode !== 'LIVE') throw new Error('Expected LIVE');
  if (adapter.settleCalls[0]?.simulate !== false) throw new Error('LIVE must call settle(simulate=false)');

  console.log('✅ P7-4 Execution Toggle Test PASS');
}

run();
