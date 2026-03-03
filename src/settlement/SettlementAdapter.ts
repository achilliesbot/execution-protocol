/**
 * Settlement Adapter Factory — Execution Protocol v2
 *
 * ESM-safe: uses static imports.
 * Circular-dep safe: adapters import base types from BaseSettlementAdapter.ts, not from this module.
 */

import {
  BaseSettlementAdapter,
  SettlementAdapter,
  SettlementRequest,
  SettlementResult
} from './BaseSettlementAdapter';

import { NullAdapter } from './adapters/NullAdapter';
import { OffChainAdapter } from './adapters/OffChainAdapter';
import { OnChainAdapter } from './adapters/OnChainAdapter';
import { HybridAdapter } from './adapters/HybridAdapter';

export {
  BaseSettlementAdapter,
  SettlementAdapter,
  SettlementRequest,
  SettlementResult
};

/**
 * Settlement adapter factory
 */
export function createSettlementAdapter(
  mode: 'null' | 'offchain' | 'onchain' | 'hybrid'
): SettlementAdapter {
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
