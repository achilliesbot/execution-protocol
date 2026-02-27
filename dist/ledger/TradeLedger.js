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
import { computeHash } from '../canonicalization/index.js';
const LEDGER_DIR = path.join(process.env.HOME || '~', '.openclaw', 'trades');
const LEDGER_FILE = (date) => path.join(LEDGER_DIR, `${date}.jsonl`);
function ensureLedgerDir() {
    if (!fs.existsSync(LEDGER_DIR)) {
        fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
}
function getToday() {
    return new Date().toISOString().split('T')[0];
}
function readLastEntryHash(date) {
    const p = LEDGER_FILE(date);
    if (!fs.existsSync(p))
        return null;
    const content = fs.readFileSync(p, 'utf-8').trim();
    if (!content)
        return null;
    const lastLine = content.split('\n').filter(Boolean).slice(-1)[0];
    try {
        const last = JSON.parse(lastLine);
        return last.entry_hash || null;
    }
    catch {
        return null;
    }
}
function computeEntryHash(entry) {
    // Only immutable semantic fields. entry_hash itself excluded by type.
    return computeHash(entry);
}
function generateEntryId(sessionId, timestamp) {
    return `trade-${Buffer.from(`${sessionId}:${timestamp}`).toString('base64').substring(0, 16)}`;
}
/**
 * Append trade entry (append-only)
 */
export function appendTradeEntry(input) {
    ensureLedgerDir();
    const timestamp = new Date().toISOString();
    const today = getToday();
    const prev = readLastEntryHash(today);
    const entryNoHash = {
        entry_id: generateEntryId(input.session_id, timestamp),
        timestamp,
        ...input,
        prev_entry_hash: prev
    };
    const entry_hash = computeEntryHash(entryNoHash);
    const entry = { ...entryNoHash, entry_hash };
    fs.appendFileSync(LEDGER_FILE(today), JSON.stringify(entry) + '\n');
    return entry;
}
/**
 * Read ledger entries (by date)
 */
export function readTradeLedger(date = getToday()) {
    const p = LEDGER_FILE(date);
    if (!fs.existsSync(p))
        return [];
    const content = fs.readFileSync(p, 'utf-8');
    return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
}
function hasRequiredFields(e) {
    return !!(e.entry_id && e.timestamp && e.session_id &&
        e.signal_id && e.signal_hash && e.plan_hash &&
        e.policy_set_hash && e.transcript_head_hash &&
        e.asset && e.direction && Number.isFinite(e.amount_usd) &&
        e.settlement && e.entry_hash);
}
function settlementArtifactsValid(e) {
    const s = e.settlement;
    if (!s || !s.mode)
        return false;
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
export function reconcileTradeLedger(date = getToday()) {
    const entries = readTradeLedger(date);
    const notes = [];
    let chain_ok = true;
    let missing_fields = 0;
    let invalid_settlement_artifacts = 0;
    let prev = null;
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
//# sourceMappingURL=TradeLedger.js.map