/**
 * Null Adapter — Execution Protocol v2
 * 
 * Abstract-only mode. No settlement execution.
 * Default adapter for Phase 6.
 * 
 * Phase 6 Monetization — Pluggable Settlement
 */

import { BaseSettlementAdapter, SettlementRequest, SettlementResult } from '../BaseSettlementAdapter';

/**
 * Null adapter — no-op settlement
 */
export class NullAdapter extends BaseSettlementAdapter {
  readonly mode = 'null' as const;
  readonly name = 'NullAdapter';
  
  /**
   * Always returns simulated success
   * Never executes real settlement
   */
  async settle(request: SettlementRequest, simulate: boolean = true): Promise<SettlementResult> {
    // Validate request
    if (!this.validateRequest(request)) {
      return this.createFailedResult('Invalid settlement request');
    }
    
    // Null adapter always simulates — no real execution
    return {
      success: true,
      transaction_hash: null, // No transaction in null mode
      status: 'SIMULATED',
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Always ready
   */
  isReady(): boolean {
    return true; // Null adapter requires no configuration
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      ready: true,
      mode: this.mode,
      simulate: true,
      description: 'Abstract-only mode. No settlement execution.'
    };
  }
}
