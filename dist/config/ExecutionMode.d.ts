/**
 * Phase 7 — P7-4 Execution Toggle
 *
 * Modes:
 * - SIM: simulated execution only (default)
 * - DRY_RUN: generate deterministic tx payloads + logs, no broadcast
 * - LIVE: broadcasting permitted ONLY when explicitly enabled by operator
 */
export type ExecutionMode = 'SIM' | 'DRY_RUN' | 'LIVE';
export interface ExecutionModeStatus {
    mode: ExecutionMode;
    liveBroadcastEnabled: boolean;
    reason?: string;
}
/**
 * Read execution mode from env.
 * Default: SIM (safety first)
 */
export declare function getExecutionMode(): ExecutionMode;
/**
 * LIVE broadcast guard.
 * Broadcast must be impossible unless Commander/operator explicitly toggles it.
 *
 * Required env to enable broadcast:
 * - EXECUTION_MODE=LIVE
 * - LIVE_OPERATOR_ACK=I_UNDERSTAND_LIVE
 */
export declare function getExecutionModeStatus(): ExecutionModeStatus;
/**
 * Deterministic tx id for SIM/DRY_RUN artifacts.
 */
export declare function computeTxPayloadHash(payload: Record<string, unknown> | object): string;
//# sourceMappingURL=ExecutionMode.d.ts.map