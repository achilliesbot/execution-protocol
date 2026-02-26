/**
 * Trade Ledger — Execution Protocol v2 (Phase 7)
 *
 * Append-only JSONL ledger. Every trade is traceable:
 * signal → plan_hash → policy_set_hash → transcript_head_hash → settlement artifacts
 *
 * Design:
 * - Append-only file per day (YYYY-MM-DD.jsonl)
 * - Tamper-evident hash chain: each entry includes prev_entry_hash + entry_hash
 * - Reconciliation verifies chain integrity + required fields
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeHash } from '../canonicalization';

export type ExecutionMode = 'SIM' | 'DRY_RUN' | 'LIVE';

export interface TradeSettlementArtifacts {
  mode: ExecutionMode;
  // DRY_RUN artifact
  tx_payload_hash?: string;
  tx_payload?: {
    to: string;
    data: string;
    value: string;
    gas_limit: number;
  };
  // LIVE artifact
  transaction_hash?: string | null;
  status?: 'SIMULATED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
}

export interface TradeLedgerEntry {
  entry_id: string;
  timestamp: string;

  // Traceability anchors
  session_id: string;
  signal_id: string;
  signal_hash: string;
  plan_hash: string;
  policy_set_hash: string;
  transcript_head_hash: string;

  // Trade intent summary (non-sensitive)
  asset: string;
  direction: 'buy' | 'sell' | 'swap';
  amount_usd: number;

  // Settlement
  settlement: TradeSettlementArtifacts;

  // Tamper-evident chain
  prev_entry_hash: string | null;
  entry_hash: string;
}

export interface ReconciliationReport {
  ok: boolean;
  entries: number;
  chain_ok: boolean;
  missing_fields: number;
  invalid_settlement_artifacts: number;
  notes: string[];
}

const LEDGER_DIR = path.join(process.env.HOME || '~', '.openclaw', 'trades');
const LEDGER_FILE = (date: string) => path.join(LEDGER_DIR, `${date}.jsonl`);

function ensureLedgerDir(): void {
  if (!fs.existsSync(LEDGER_DIR)) {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
  }
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function readLastEntryHash(date: string): string | null {
  const p = LEDGER_FILE(date);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, 'utf-8').trim();
  if (!content) return null;
  const lastLine = content.split('\n').filter(Boolean).slice(-1)[0];
  try {
    const last = JSON.parse(lastLine) as TradeLedgerEntry;
    return last.entry_hash || null;
  } catch {
    return null;
  }
}

function computeEntryHash(entry: Omit<TradeLedgerEntry, 'entry_hash'>): string {
  // Only immutable semantic fields. entry_hash itself excluded by type.
  return computeHash(entry as unknown as Record<string, unknown>);
}

function generateEntryId(sessionId: string, timestamp: string): string {
  return `trade-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
}

/**
 * Append trade entry (append-only)
 */
export function appendTradeEntry(input: Omit<TradeLedgerEntry, 'entry_id' | 'timestamp' | 'prev_entry_hash' | 'entry_hash'>): TradeLedgerEntry {
  ensureLedgerDir();

  const timestamp = new Date().toISOString();
  const today = getToday();
  const prev = readLastEntryHash(today);

  const entryNoHash: Omit<TradeLedgerEntry, 'entry_hash'> = {
    entry_id: generateEntryId(input.session_id, timestamp),
    timestamp,
    ...input,
    prev_entry_hash: prev
  };

  const entry_hash = computeEntryHash(entryNoHash);
  const entry: TradeLedgerEntry = { ...entryNoHash, entry_hash };

  fs.appendFileSync(LEDGER_FILE(today), JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Read ledger entries (by date)
 */
export function readTradeLedger(date: string = getToday()): TradeLedgerEntry[] {
  const p = LEDGER_FILE(date);
  if (!fs.existsSync(p)) return [];
  const content = fs.readFileSync(p, 'utf-8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function hasRequiredFields(e: TradeLedgerEntry): boolean {
  return !!(
    e.entry_id && e.timestamp && e.session_id &&
    e.signal_id && e.signal_hash && e.plan_hash &&
    e.policy_set_hash && e.transcript_head_hash &&
    e.asset && e.direction && Number.isFinite(e.amount_usd) &&
    e.settlement && e.entry_hash
  );
}

function settlementArtifactsValid(e: TradeLedgerEntry): boolean {
  const s = e.settlement;
  if (!s || !s.mode) return false;
  if (s.mode === 'SIM') {
    // No tx required
    return true;
  }
  if (s.mode === 'DRY_RUN') {
    return !!(s.tx_payload_hash && s.tx_payload);
  }
  // LIVE
  return !!(s.transaction_hash !== undefined && s.status);
}

/**
 * Reconcile ledger integrity:
 * - hash chain matches
 * - required fields exist
 * - settlement artifacts satisfy mode constraints
 */
export function reconcileTradeLedger(date: string = getToday()): ReconciliationReport {
  const entries = readTradeLedger(date);
  const notes: string[] = [];

  let chain_ok = true;
  let missing_fields = 0;
  let invalid_settlement_artifacts = 0;

  let prev: string | null = null;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    if (!hasRequiredFields(e)) {
      missing_fields++;
      notes.push(`Missing required fields at line ${i + 1}`);
    }

    if (!settlementArtifactsValid(e)) {
      invalid_settlement_artifacts++;
      notes.push(`Invalid settlement artifacts at line ${i + 1} (mode=${e.settlement?.mode})`);
    }

    // chain check
    if (e.prev_entry_hash !== prev) {
      chain_ok = false;
      notes.push(`Hash chain break at line ${i + 1}`);
    }

    // entry hash check
    const { entry_hash, ...rest } = e;
    const recomputed = computeEntryHash(rest);
    if (recomputed !== entry_hash) {
      chain_ok = false;
      notes.push(`Entry hash mismatch at line ${i + 1}`);
    }

    prev = entry_hash;
  }

  const ok = chain_ok && missing_fields === 0 && invalid_settlement_artifacts === 0;

  return {
    ok,
    entries: entries.length,
    chain_ok,
    missing_fields,
    invalid_settlement_artifacts,
    notes
  };
}
