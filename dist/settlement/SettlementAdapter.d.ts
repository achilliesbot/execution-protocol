/**
 * Settlement Adapter Factory — Execution Protocol v2
 *
 * ESM-safe: uses static imports.
 * Circular-dep safe: adapters import base types from BaseSettlementAdapter.ts, not from this module.
 */
import { BaseSettlementAdapter, SettlementAdapter, SettlementRequest, SettlementResult } from './BaseSettlementAdapter';
export { BaseSettlementAdapter, SettlementAdapter, SettlementRequest, SettlementResult };
/**
 * Settlement adapter factory
 */
export declare function createSettlementAdapter(mode: 'null' | 'offchain' | 'onchain' | 'hybrid'): SettlementAdapter;
//# sourceMappingURL=SettlementAdapter.d.ts.map