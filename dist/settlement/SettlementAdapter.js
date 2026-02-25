/**
 * Settlement Adapter Factory — Execution Protocol v2
 *
 * ESM-safe: uses static imports.
 * Circular-dep safe: adapters import base types from BaseSettlementAdapter.ts, not from this module.
 */
import { BaseSettlementAdapter } from './BaseSettlementAdapter.js';
import { NullAdapter } from './adapters/NullAdapter.js';
import { OffChainAdapter } from './adapters/OffChainAdapter.js';
import { OnChainAdapter } from './adapters/OnChainAdapter.js';
import { HybridAdapter } from './adapters/HybridAdapter.js';
export { BaseSettlementAdapter };
/**
 * Settlement adapter factory
 */
export function createSettlementAdapter(mode) {
    switch (mode) {
        case 'null':
            return new NullAdapter();
        case 'offchain':
            return new OffChainAdapter();
        case 'onchain':
            return new OnChainAdapter();
        case 'hybrid':
            return new HybridAdapter();
        default:
            throw new Error(`Unknown settlement mode: ${mode}`);
    }
}
//# sourceMappingURL=SettlementAdapter.js.map