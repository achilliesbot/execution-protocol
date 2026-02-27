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
/**
 * Ledger configuration
 */
const LEDGER_DIR = path.join(process.env.HOME || '~', '.openclaw', 'revenue');
const LEDGER_FILE = (date) => path.join(LEDGER_DIR, `${date}.jsonl`);
/**
 * Ensure ledger directory exists
 */
function ensureLedgerDir() {
    if (!fs.existsSync(LEDGER_DIR)) {
        fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
}
/**
 * Get today's date string
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Generate deterministic entry ID
 */
function generateEntryId(sessionId, timestamp) {
    return `rev-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
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
    // Append to today's ledger file (JSONL format)
    const ledgerPath = LEDGER_FILE(today);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(ledgerPath, line);
    // Update agent summary
    updateAgentSummary(billingResult.session_id.split('-')[0] || 'unknown', billingResult.total_due, entry.status);
    return entry;
}
/**
 * Update settlement status (called by settlement adapter)
 */
export function updateSettlementStatus(entryId, status, txHash) {
    // In a real implementation, this would:
    // 1. Find the entry in the ledger
    // 2. Append an update record (not modify original)
    // 3. For Phase 6: stub implementation
    console.log(`Settlement update: ${entryId} → ${status}` + (txHash ? ` (${txHash})` : ''));
}
/**
 * Get agent summary
 */
export function getAgentSummary(agentId) {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    if (!fs.existsSync(summaryPath)) {
        return null;
    }
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    return data[agentId] || null;
}
/**
 * Update agent summary
 */
function updateAgentSummary(agentId, amount, status) {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    let data = {};
    if (fs.existsSync(summaryPath)) {
        data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    }
    const current = data[agentId] || {
        agent_id: agentId,
        total_billed: 0,
        total_settled: 0,
        total_pending: 0,
        entry_count: 0,
        last_updated: new Date().toISOString()
    };
    data[agentId] = {
        ...current,
        total_billed: current.total_billed + amount,
        total_pending: status === 'PENDING' ? current.total_pending + amount : current.total_pending,
        total_settled: status === 'SETTLED' ? current.total_settled + amount : current.total_settled,
        entry_count: current.entry_count + 1,
        last_updated: new Date().toISOString()
    };
    fs.writeFileSync(summaryPath, JSON.stringify(data, null, 2));
}
/**
 * Read ledger entries for a date
 */
export function readRevenueLedger(date = getToday()) {
    const ledgerPath = LEDGER_FILE(date);
    if (!fs.existsSync(ledgerPath)) {
        return [];
    }
    const content = fs.readFileSync(ledgerPath, 'utf-8');
    return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
}
/**
 * Get revenue dashboard data
 */
export function getRevenueDashboard() {
    const summaryPath = path.join(LEDGER_DIR, 'summaries.json');
    const todayEntries = readRevenueLedger(getToday());
    let summaries = {};
    if (fs.existsSync(summaryPath)) {
        summaries = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    }
    const allSummaries = Object.values(summaries);
    return {
        total_billed_all_time: allSummaries.reduce((sum, s) => sum + s.total_billed, 0),
        total_settled: allSummaries.reduce((sum, s) => sum + s.total_settled, 0),
        total_pending: allSummaries.reduce((sum, s) => sum + s.total_pending, 0),
        today_entries: todayEntries.length,
        agent_breakdown: allSummaries.sort((a, b) => b.total_billed - a.total_billed)
    };
}
