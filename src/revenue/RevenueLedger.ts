/**
 * Revenue Ledger — Execution Protocol v2
 *
 * Append-only record of all billing events.
 * No updates, no deletes. Permanent audit trail.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BillingResult } from '../billing';

/**
 * Revenue ledger entry
 */
export interface RevenueLedgerEntry {
  entry_id: string;
  timestamp: string;
  session_id: string;
  transcript_head_hash: string;
  execution_weight: number;
  billable_units: number;
  unit_rate: number;
  total_due: number;
  pricing_version: string;
  pricing_hash: string;
  settlement_mode: 'null' | 'offchain' | 'onchain' | 'hybrid';
  status: 'PENDING' | 'SIMULATED' | 'SETTLED' | 'FAILED';
  settlement_tx_hash?: string | null;
  settlement_timestamp?: string | null;
}

/**
 * Revenue summary per agent (BigInt for safe accumulation)
 */
export interface AgentRevenueSummary {
  agent_id: string;
  total_billed: bigint;
  total_settled: bigint;
  total_pending: bigint;
  total_simulated: bigint;
  entry_count: number;
  last_updated: string;
}

/**
 * Stored summary shape (JSON-safe)
 */
type StoredAgentRevenueSummary = Omit<AgentRevenueSummary, 'total_billed' | 'total_settled' | 'total_pending' | 'total_simulated'> & {
  total_billed: string;
  total_settled: string;
  total_pending: string;
  total_simulated: string;
};

/**
 * Ledger configuration
 */
const LEDGER_DIR = path.join(os.homedir(), '.openclaw', 'revenue');
const LEDGER_FILE = (date: string) => path.join(LEDGER_DIR, `${date}.jsonl`);

function ensureLedgerDir(): void {
  if (!fs.existsSync(LEDGER_DIR)) {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
  }
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function generateEntryId(sessionId: string, timestamp: string): string {
  return `rev-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
}

function toBigIntMoney(amount: number): bigint {
  if (!Number.isFinite(amount)) throw new Error('Invalid money amount: must be finite');
  // Protocol invariant: billing outputs integer units.
  return BigInt(Math.trunc(amount));
}

function parseStoredSummary(x: any, agentId: string): AgentRevenueSummary {
  // Backward compatible: allow previous numeric fields.
  const asBig = (v: any): bigint => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return BigInt(Math.trunc(v));
    if (typeof v === 'string' && v.length > 0) return BigInt(v);
    return 0n;
  };

  return {
    agent_id: agentId,
    total_billed: asBig(x?.total_billed),
    total_settled: asBig(x?.total_settled),
    total_pending: asBig(x?.total_pending),
    total_simulated: asBig(x?.total_simulated),
    entry_count: typeof x?.entry_count === 'number' ? x.entry_count : 0,
    last_updated: typeof x?.last_updated === 'string' ? x.last_updated : new Date().toISOString()
  };
}

function toStoredSummary(s: AgentRevenueSummary): StoredAgentRevenueSummary {
  return {
    agent_id: s.agent_id,
    total_billed: s.total_billed.toString(),
    total_settled: s.total_settled.toString(),
    total_pending: s.total_pending.toString(),
    total_simulated: s.total_simulated.toString(),
    entry_count: s.entry_count,
    last_updated: s.last_updated
  };
}

/**
 * Append billing result to revenue ledger
 * Append-only — no updates, no deletes
 */
export function appendRevenueEntry(
  billingResult: BillingResult,
  settlementMode: 'null' | 'offchain' | 'onchain' | 'hybrid',
  simulate: boolean = true
): RevenueLedgerEntry {
  ensureLedgerDir();

  const timestamp = new Date().toISOString();
  const today = getToday();

  const entry: RevenueLedgerEntry = {
    entry_id: generateEntryId(billingResult.session_id, timestamp),
    timestamp,
    session_id: billingResult.session_id,
    transcript_head_hash: billingResult.transcript_head_hash,
    execution_weight: billingResult.execution_weight,
    billable_units: billingResult.billable_units,
    unit_rate: billingResult.unit_rate,
    total_due: billingResult.total_due,
    pricing_version: billingResult.pricing_version,
    pricing_hash: billingResult.pricing_hash,
    settlement_mode: settlementMode,
    status: simulate ? 'SIMULATED' : 'PENDING'
  };

  const ledgerPath = LEDGER_FILE(today);
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n');

  const agentId = billingResult.session_id.split('-')[0] || 'unknown';
  updateAgentSummary(agentId, toBigIntMoney(billingResult.total_due), entry.status);

  return entry;
}

/**
 * Update settlement status (called by settlement adapter)
 */
export function updateSettlementStatus(entryId: string, status: 'SETTLED' | 'FAILED', txHash?: string): void {
  // Phase 6 stub: real implementation would append a settlement update record.
  console.log(`Settlement update: ${entryId} → ${status}` + (txHash ? ` (${txHash})` : ''));
}

/**
 * Get agent summary
 */
export function getAgentSummary(agentId: string): AgentRevenueSummary | null {
  const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
  if (!fs.existsSync(summaryPath)) return null;

  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as Record<string, any>;
  const raw = data[agentId];
  if (!raw) return null;

  return parseStoredSummary(raw, agentId);
}

/**
 * Update agent summary (BigInt-safe)
 */
function updateAgentSummary(agentId: string, amount: bigint, status: RevenueLedgerEntry['status']): void {
  const summaryPath = path.join(LEDGER_DIR, 'summaries.json');

  let data: Record<string, any> = {};
  if (fs.existsSync(summaryPath)) {
    data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as Record<string, any>;
  }

  const current = parseStoredSummary(data[agentId], agentId);

  const next: AgentRevenueSummary = {
    ...current,
    total_billed: current.total_billed + amount,
    total_pending: status === 'PENDING' ? current.total_pending + amount : current.total_pending,
    total_settled: status === 'SETTLED' ? current.total_settled + amount : current.total_settled,
    total_simulated: status === 'SIMULATED' ? current.total_simulated + amount : current.total_simulated,
    entry_count: current.entry_count + 1,
    last_updated: new Date().toISOString()
  };

  data[agentId] = toStoredSummary(next);
  fs.writeFileSync(summaryPath, JSON.stringify(data, null, 2));
}

/**
 * Read ledger entries for a date
 */
export function readRevenueLedger(date: string = getToday()): RevenueLedgerEntry[] {
  const ledgerPath = LEDGER_FILE(date);
  if (!fs.existsSync(ledgerPath)) return [];

  const content = fs.readFileSync(ledgerPath, 'utf-8');
  if (content.trim().length === 0) return [];

  return content
    .trim()
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line));
}

/**
 * Get revenue dashboard data (JSON-safe strings for BigInt totals)
 */
export function getRevenueDashboard(): {
  total_billed_all_time: string;
  total_settled: string;
  total_pending: string;
  total_simulated: string;
  today_entries: number;
  agent_breakdown: Array<StoredAgentRevenueSummary>;
} {
  const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
  const todayEntries = readRevenueLedger(getToday());

  let summaries: Record<string, any> = {};
  if (fs.existsSync(summaryPath)) {
    summaries = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as Record<string, any>;
  }

  const parsed = Object.entries(summaries).map(([agentId, raw]) => parseStoredSummary(raw, agentId));

  const totalBilled = parsed.reduce((sum, s) => sum + s.total_billed, 0n);
  const totalSettled = parsed.reduce((sum, s) => sum + s.total_settled, 0n);
  const totalPending = parsed.reduce((sum, s) => sum + s.total_pending, 0n);
  const totalSimulated = parsed.reduce((sum, s) => sum + s.total_simulated, 0n);

  const breakdown = parsed
    .slice()
    .sort((a, b) => (b.total_billed > a.total_billed ? 1 : b.total_billed < a.total_billed ? -1 : 0))
    .map(toStoredSummary);

  return {
    total_billed_all_time: totalBilled.toString(),
    total_settled: totalSettled.toString(),
    total_pending: totalPending.toString(),
    total_simulated: totalSimulated.toString(),
    today_entries: todayEntries.length,
    agent_breakdown: breakdown
  };
}
