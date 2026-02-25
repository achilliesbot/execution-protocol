/**
 * Fee Ledger — Execution Protocol v2
 *
 * Persistent fee accounting (not billing).
 * Append-only records of execution weight calculations.
 *
 * Phase 5 Activation — Economic Layer
 */
import * as fs from 'fs';
import * as path from 'path';
/**
 * Fee ledger configuration
 */
const LEDGER_DIR = path.join(process.env.HOME || '~', '.openclaw', 'fees');
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
 * Get today's date string (YYYY-MM-DD)
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Generate deterministic entry ID
 */
function generateEntryId(sessionId, timestamp) {
    return `fee-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
}
/**
 * Append fee entry to ledger
 * Pure economic accounting — no billing, no charges
 */
export function appendFeeEntry(sessionId, agentId, feeEstimate) {
    ensureLedgerDir();
    const timestamp = new Date().toISOString();
    const today = getToday();
    // Calculate cumulative total
    const currentTotal = getAgentCumulativeTotal(agentId);
    const cumulativeTotal = currentTotal + feeEstimate.total;
    const entry = {
        entry_id: generateEntryId(sessionId, timestamp),
        timestamp,
        session_id: sessionId,
        agent_id: agentId,
        fee_estimate: feeEstimate,
        cumulative_total: cumulativeTotal
    };
    // Append to today's ledger file (JSONL format)
    const ledgerPath = LEDGER_FILE(today);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(ledgerPath, line);
    // Update accumulator
    updateAgentAccumulator(agentId, feeEstimate.total);
    return entry;
}
/**
 * Get agent's cumulative fee total
 */
export function getAgentCumulativeTotal(agentId) {
    const accumulator = getAgentAccumulator(agentId);
    return accumulator?.total_accrued || 0;
}
/**
 * Get agent fee accumulator
 */
export function getAgentAccumulator(agentId) {
    const accumulatorPath = path.join(LEDGER_DIR, 'accumulators.json');
    if (!fs.existsSync(accumulatorPath)) {
        return null;
    }
    const data = JSON.parse(fs.readFileSync(accumulatorPath, 'utf-8'));
    return data[agentId] || null;
}
/**
 * Update agent accumulator
 */
function updateAgentAccumulator(agentId, feeAmount) {
    const accumulatorPath = path.join(LEDGER_DIR, 'accumulators.json');
    let data = {};
    if (fs.existsSync(accumulatorPath)) {
        data = JSON.parse(fs.readFileSync(accumulatorPath, 'utf-8'));
    }
    const current = data[agentId] || {
        agent_id: agentId,
        total_accrued: 0,
        entry_count: 0,
        last_updated: new Date().toISOString()
    };
    data[agentId] = {
        ...current,
        total_accrued: current.total_accrued + feeAmount,
        entry_count: current.entry_count + 1,
        last_updated: new Date().toISOString()
    };
    fs.writeFileSync(accumulatorPath, JSON.stringify(data, null, 2));
}
/**
 * Get all agent accumulators
 */
export function getAllAccumulators() {
    const accumulatorPath = path.join(LEDGER_DIR, 'accumulators.json');
    if (!fs.existsSync(accumulatorPath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(accumulatorPath, 'utf-8'));
}
/**
 * Read ledger entries for a specific date
 */
export function readLedger(date = getToday()) {
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
 * Get fee summary for dashboard
 */
export function getFeeSummary() {
    const accumulators = getAllAccumulators();
    const todayEntries = readLedger(getToday());
    const totalAccrued = Object.values(accumulators).reduce((sum, acc) => sum + acc.total_accrued, 0);
    return {
        total_accrued_all_agents: totalAccrued,
        total_entries_today: todayEntries.length,
        agent_breakdown: Object.values(accumulators).sort((a, b) => b.total_accrued - a.total_accrued)
    };
}
/**
 * Check daily fee accrual cap
 */
export function checkDailyCap(agentId, proposedFee) {
    const today = getToday();
    const todayEntries = readLedger(today).filter(e => e.agent_id === agentId);
    const todayTotal = todayEntries.reduce((sum, e) => sum + e.fee_estimate.total, 0);
    // Default cap: 10000 fee units
    const DAILY_CAP = parseInt(process.env.DAILY_FEE_ACCRUAL_CAP || '10000', 10);
    return (todayTotal + proposedFee) <= DAILY_CAP;
}
