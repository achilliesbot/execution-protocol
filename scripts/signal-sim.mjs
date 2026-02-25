/**
 * Signal Engine Simulation — 10 simulated trades with hash-chained transcripts
 *
 * Uses TranscriptLogger hash-chain as the audit artifact.
 * No keys, no network.
 */

import fs from 'fs';
import path from 'path';

import { TranscriptLogger } from '../dist/transcript/TranscriptLogger.js';
import { computeHash } from '../dist/canonicalization/index.js';

const OUT_PATH = '/data/.openclaw/workspace/logs/signal_sim_2026-02-25.json';

function nowIso() {
  return new Date().toISOString();
}

function mkTrade(i) {
  // Deterministic-ish parameters (no randomness) for reproducibility.
  const asset = i % 2 === 0 ? 'ETH' : 'BTC';
  const direction = i % 3 === 0 ? 'SHORT' : 'LONG';
  const entry = 1000 + i * 10;
  const stop = direction === 'LONG' ? entry - 25 : entry + 25;
  const take = direction === 'LONG' ? entry + 60 : entry - 60;
  return {
    trade_id: `trade_${String(i + 1).padStart(2, '0')}`,
    asset,
    direction,
    entry_price: entry,
    stop_loss: stop,
    take_profit: take,
    size_usd: 10,
    confidence: 0.75,
    note: 'SIMULATED'
  };
}

async function run() {
  const sessionId = `signal_sim_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

  const logger = new TranscriptLogger();
  logger.startSession(sessionId, 'ACHILLES', 'policy_set_phase1_sim');

  const entries = [];

  // Session init
  entries.push(logger.log('SESSION_INIT', {
    session_id: sessionId,
    simulation: true,
    count: 10
  }));

  const planHashes = [];

  for (let i = 0; i < 10; i++) {
    const trade = mkTrade(i);

    // Plan hash: deterministic hash of trade intent.
    // Use a field name NOT in canonicalizer denylist (avoid: plan_id).
    const plan_hash = computeHash({
      schema_version: 'plan.v1',
      plan_uid: trade.trade_id,
      trade
    });
    planHashes.push(plan_hash);

    entries.push(logger.log('execution_attempted', {
      trade,
      plan_hash,
      step: i + 1
    }));

    // confirm immediately (simulation)
    entries.push(logger.log('execution_confirmed', {
      trade_id: trade.trade_id,
      status: 'SIMULATED_CONFIRMED'
    }));
  }

  // Uniqueness check
  const uniquePlans = new Set(planHashes);
  if (uniquePlans.size !== 10) {
    throw new Error(`Plan hash collision detected: unique=${uniquePlans.size}/10`);
  }

  entries.push(logger.log('SESSION_COMPLETE', {
    session_id: sessionId,
    result: 'SIMULATION_COMPLETE',
    trades: 10,
    unique_plan_hashes: uniquePlans.size
  }));

  const headHash = await logger.finalize();

  const out = {
    generated_at: nowIso(),
    session_id: sessionId,
    trades: 10,
    unique_plan_hashes: uniquePlans.size,
    transcript_head_hash: headHash,
    // Capture first 10 plan hashes for auditability
    plan_hashes: planHashes,
    entries: entries.map(e => ({
      entry_type: e.entry_type,
      previous_hash: e.previous_hash,
      entry_hash: e.entry_hash,
      plan_hash: (e.entry_type === 'execution_attempted' ? e.content?.plan_hash : undefined)
    }))
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`SIM_RUNNING: wrote ${OUT_PATH}`);
  console.log(`TRANSCRIPT_HEAD_HASH: ${headHash}`);
}

run().catch((e) => {
  console.error('SIGNAL_SIM_FAILED', e);
  process.exit(1);
});
