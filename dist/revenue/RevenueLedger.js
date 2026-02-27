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
/**
 * Ledger configuration
 */
const LEDGER_DIR = path.join(os.homedir(), '.openclaw', 'revenue');
const LEDGER_FILE = (date) => path.join(LEDGER_DIR, `${date}.jsonl`);
function ensureLedgerDir() {
    if (!fs.existsSync(LEDGER_DIR)) {
        fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
}
function getToday() {
    return new Date().toISOString().split('T')[0];
}
function generateEntryId(sessionId, timestamp) {
    return `rev-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
}
function toBigIntMoney(amount) {
    if (!Number.isFinite(amount))
        throw new Error('Invalid money amount: must be finite');
    // Protocol invariant: billing outputs integer units.
    return BigInt(Math.trunc(amount));
}
function parseStoredSummary(x, agentId) {
    // Backward compatible: allow previous numeric fields.
    const asBig = (v) => {
        if (typeof v === 'bigint')
            return v;
        if (typeof v === 'number')
            return BigInt(Math.trunc(v));
        if (typeof v === 'string' && v.length > 0)
            return BigInt(v);
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
function toStoredSummary(s) {
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
export function appendRevenueEntry(billingResult, settlementMode, simulate = true) {
    ensureLedgerDir();
    const timestamp = new Date().toISOString();
    const today = getToday();
    const entry = {
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
export function updateSettlementStatus(entryId, status, txHash) {
    // Phase 6 stub: real implementation would append a settlement update record.
    console.log(`Settlement update: ${entryId} → ${status}` + (txHash ? ` (${txHash})` : ''));
}
/**
 * Get agent summary
 */
export function getAgentSummary(agentId) {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    if (!fs.existsSync(summaryPath))
        return null;
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    const raw = data[agentId];
    if (!raw)
        return null;
    return parseStoredSummary(raw, agentId);
}
/**
 * Update agent summary (BigInt-safe)
 */
function updateAgentSummary(agentId, amount, status) {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    let data = {};
    if (fs.existsSync(summaryPath)) {
        data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    }
    const current = parseStoredSummary(data[agentId], agentId);
    const next = {
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
export function readRevenueLedger(date = getToday()) {
    const ledgerPath = LEDGER_FILE(date);
    if (!fs.existsSync(ledgerPath))
        return [];
    const content = fs.readFileSync(ledgerPath, 'utf-8');
    if (content.trim().length === 0)
        return [];
    return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
}
/**
 * Get revenue dashboard data (JSON-safe strings for BigInt totals)
 */
export function getRevenueDashboard() {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    const todayEntries = readRevenueLedger(getToday());
    let summaries = {};
    if (fs.existsSync(summaryPath)) {
        summaries = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
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
//# sourceMappingURL=RevenueLedger.js.map