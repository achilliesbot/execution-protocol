/**
 * Phase 7 — P7-4 Execution Toggle: SIM → DRY_RUN → LIVE
 *
 * Requirements:
 * - Default must be SIM
 * - DRY_RUN generates deterministic tx payloads + logs
 * - Broadcast must be impossible unless LIVE is explicitly toggled by Commander/operator
 */
import { SettlementAdapter, SettlementRequest, SettlementResult } from './BaseSettlementAdapter';
export interface TxPayload {
    to: string;
    data: string;
    value: string;
    gas_limit: number;
}
export interface ToggleSettlementResult extends SettlementResult {
    mode: 'SIM' | 'DRY_RUN' | 'LIVE';
    tx_payload?: TxPayload;
    tx_payload_hash?: string;
}
/**
 * Settle according to execution mode.
 */
export declare function settleWithExecutionToggle(adapter: SettlementAdapter, request: SettlementRequest): Promise<ToggleSettlementResult>;
//# sourceMappingURL=ExecutionToggle.d.ts.map