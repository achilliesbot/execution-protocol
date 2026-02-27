/**
 * Settlement Base Types — Execution Protocol v2
 *
 * NOTE: This file is intentionally split out to avoid ESM circular deps:
 * - Adapters import BaseSettlementAdapter from here
 * - Factory can import adapters without adapters importing the factory module
 */
/**
 * Abstract base class for settlement adapters
 */
export class BaseSettlementAdapter {
    constructor() {
        this.simulate = true;
    }
    getStatus() {
        return {
            ready: this.isReady(),
            mode: this.mode,
            simulate: this.simulate
        };
    }
    /**
     * Validate settlement request (fail-closed)
     */
    validateRequest(request) {
        if (!request.entry_id)
            return false;
        if (typeof request.amount !== 'number' || !Number.isFinite(request.amount) || request.amount <= 0)
            return false;
        if (!request.currency || typeof request.currency !== 'string')
            return false;
        if (!request.recipient || typeof request.recipient !== 'string' || request.recipient.length < 10)
            return false;
        if (!request.metadata || typeof request.metadata.session_id !== 'string' || typeof request.metadata.transcript_head_hash !== 'string')
            return false;
        return true;
    }
    createSimulatedResult(request) {
        return {
            success: true,
            transaction_hash: `sim_${Date.now()}_${request.entry_id.substring(0, 8)}`,
            status: 'SIMULATED',
            timestamp: new Date().toISOString()
        };
    }
    createFailedResult(error) {
        return {
            success: false,
            transaction_hash: null,
            status: 'FAILED',
            error,
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=BaseSettlementAdapter.js.map