/**
 * Fee Ledger — Execution Protocol v2
 *
 * Persistent fee accounting (not billing).
 * Append-only records of execution weight calculations.
 *
 * Phase 5 Activation — Economic Layer
 */
import { FeeEstimate } from '../fees';
/**
 * Fee ledger entry
 */
export interface FeeLedgerEntry {
    entry_id: string;
    timestamp: string;
    session_id: string;
    agent_id: string;
    fee_estimate: FeeEstimate;
    cumulative_total: number;
}
/**
 * Fee accumulator per agent
 */
export interface AgentFeeAccumulator {
    agent_id: string;
    total_accrued: number;
    entry_count: number;
    last_updated: string;
}
/**
 * Append fee entry to ledger
 * Pure economic accounting — no billing, no charges
 */
export declare function appendFeeEntry(sessionId: string, agentId: string, feeEstimate: FeeEstimate): FeeLedgerEntry;
/**
 * Get agent's cumulative fee total
 */
export declare function getAgentCumulativeTotal(agentId: string): number;
/**
 * Get agent fee accumulator
 */
export declare function getAgentAccumulator(agentId: string): AgentFeeAccumulator | null;
/**
 * Get all agent accumulators
 */
export declare function getAllAccumulators(): Record<string, AgentFeeAccumulator>;
/**
 * Read ledger entries for a specific date
 */
export declare function readLedger(date?: string): FeeLedgerEntry[];
/**
 * Get fee summary for dashboard
 */
export declare function getFeeSummary(): {
    total_accrued_all_agents: number;
    total_entries_today: number;
    agent_breakdown: AgentFeeAccumulator[];
};
/**
 * Check daily fee accrual cap
 */
export declare function checkDailyCap(agentId: string, proposedFee: number): boolean;
//# sourceMappingURL=FeeLedger.d.ts.map