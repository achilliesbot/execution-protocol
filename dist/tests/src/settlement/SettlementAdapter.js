/**
 * Settlement Adapter Interface — Execution Protocol v2
 *
 * Pluggable settlement behind one interface.
 * Modes: null, offchain, onchain, hybrid
 *
 * Phase 6 Monetization — All settlement paths unified
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
     * Validate settlement request
     */
    validateRequest(request) {
        if (!request.entry_id || request.amount <= 0) {
            return false;
        }
        if (!request.recipient || request.recipient.length < 10) {
            return false;
        }
        return true;
    }
    /**
     * Create simulated result
     */
    createSimulatedResult(request) {
        return {
            success: true,
            transaction_hash: `sim_${Date.now()}_${request.entry_id.substring(0, 8)}`,
            status: 'SIMULATED',
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Create failed result
     */
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
/**
 * Settlement adapter factory
 */
export function createSettlementAdapter(mode) {
    switch (mode) {
        case 'null':
            const { NullAdapter } = require('./adapters/NullAdapter');
            return new NullAdapter();
        case 'offchain':
            const { OffChainAdapter } = require('./adapters/OffChainAdapter');
            return new OffChainAdapter();
        case 'onchain':
            const { OnChainAdapter } = require('./adapters/OnChainAdapter');
            return new OnChainAdapter();
        case 'hybrid':
            const { HybridAdapter } = require('./adapters/HybridAdapter');
            return new HybridAdapter();
        default:
            throw new Error(`Unknown settlement mode: ${mode}`);
    }
}
