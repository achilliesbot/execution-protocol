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
export type ExecutionMode = 'SIM' | 'DRY_RUN' | 'LIVE';
export interface TradeSettlementArtifacts {
    mode: ExecutionMode;
    tx_payload_hash?: string;
    tx_payload?: {
        to: string;
        data: string;
        value: string;
        gas_limit: number;
    };
    transaction_hash?: string | null;
    status?: 'SIMULATED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
}
export interface TradeLedgerEntry {
    entry_id: string;
    timestamp: string;
    session_id: string;
    signal_id: string;
    signal_hash: string;
    plan_hash: string;
    policy_set_hash: string;
    transcript_head_hash: string;
    asset: string;
    direction: 'buy' | 'sell' | 'swap';
    amount_usd: number;
    settlement: TradeSettlementArtifacts;
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
/**
 * Append trade entry (append-only)
 */
export declare function appendTradeEntry(input: Omit<TradeLedgerEntry, 'entry_id' | 'timestamp' | 'prev_entry_hash' | 'entry_hash'>): TradeLedgerEntry;
/**
 * Read ledger entries (by date)
 */
export declare function readTradeLedger(date?: string): TradeLedgerEntry[];
/**
 * Reconcile ledger integrity:
 * - hash chain matches
 * - required fields exist
 * - settlement artifacts satisfy mode constraints
 */
export declare function reconcileTradeLedger(date?: string): ReconciliationReport;
//# sourceMappingURL=TradeLedger.d.ts.map