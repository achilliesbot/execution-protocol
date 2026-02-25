/**
 * Revenue Ledger — Execution Protocol v2
 *
 * Append-only record of all billing events.
 * No updates, no deletes. Permanent audit trail.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
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
 * Append billing result to revenue ledger
 * Append-only — no updates, no deletes
 */
export declare function appendRevenueEntry(billingResult: BillingResult, settlementMode: 'null' | 'offchain' | 'onchain' | 'hybrid', simulate?: boolean): RevenueLedgerEntry;
/**
 * Update settlement status (called by settlement adapter)
 */
export declare function updateSettlementStatus(entryId: string, status: 'SETTLED' | 'FAILED', txHash?: string): void;
/**
 * Get agent summary
 */
export declare function getAgentSummary(agentId: string): AgentRevenueSummary | null;
/**
 * Read ledger entries for a date
 */
export declare function readRevenueLedger(date?: string): RevenueLedgerEntry[];
/**
 * Get revenue dashboard data (JSON-safe strings for BigInt totals)
 */
export declare function getRevenueDashboard(): {
    total_billed_all_time: string;
    total_settled: string;
    total_pending: string;
    total_simulated: string;
    today_entries: number;
    agent_breakdown: Array<StoredAgentRevenueSummary>;
};
export {};
//# sourceMappingURL=RevenueLedger.d.ts.map