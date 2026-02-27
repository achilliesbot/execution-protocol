/**
 * Phase 7 — P7-4 Execution Toggle
 *
 * Modes:
 * - SIM: simulated execution only (default)
 * - DRY_RUN: generate deterministic tx payloads + logs, no broadcast
 * - LIVE: broadcasting permitted ONLY when explicitly enabled by operator
 */
import { computeHash } from '../canonicalization/index.js';
/**
 * Read execution mode from env.
 * Default: SIM (safety first)
 */
export function getExecutionMode() {
    const raw = (process.env.EXECUTION_MODE || 'SIM').toUpperCase();
    if (raw === 'LIVE')
        return 'LIVE';
    if (raw === 'DRY_RUN' || raw === 'DRY-RUN')
        return 'DRY_RUN';
    return 'SIM';
}
/**
 * LIVE broadcast guard.
 * Broadcast must be impossible unless Commander/operator explicitly toggles it.
 *
 * Required env to enable broadcast:
 * - EXECUTION_MODE=LIVE
 * - LIVE_OPERATOR_ACK=I_UNDERSTAND_LIVE
 */
export function getExecutionModeStatus() {
    const mode = getExecutionMode();
    if (mode !== 'LIVE') {
        return { mode, liveBroadcastEnabled: false, reason: 'Mode not LIVE' };
    }
    const ack = process.env.LIVE_OPERATOR_ACK || '';
    if (ack !== 'I_UNDERSTAND_LIVE') {
        return { mode, liveBroadcastEnabled: false, reason: 'Missing LIVE_OPERATOR_ACK' };
    }
    return { mode, liveBroadcastEnabled: true };
}
/**
 * Deterministic tx id for SIM/DRY_RUN artifacts.
 */
export function computeTxPayloadHash(payload) {
    return computeHash(payload);
}
//# sourceMappingURL=ExecutionMode.js.map