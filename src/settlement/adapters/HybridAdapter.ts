/**
 * Hybrid Adapter — Execution Protocol v2
 * 
 * Combines on-chain verification with off-chain payment rails.
 * Devnet/testnet only for on-chain component.
 * 
 * Phase 6 Monetization — Pluggable Settlement
 */

import { BaseSettlementAdapter, SettlementRequest, SettlementResult } from '../BaseSettlementAdapter';
import { isMainnetAllowed } from '../../config/Phase6Flags';

/**
 * Hybrid settlement adapter
 */
export class HybridAdapter extends BaseSettlementAdapter {
  readonly mode = 'hybrid' as const;
  readonly name = 'HybridAdapter';
  
  /**
   * Execute hybrid settlement (sandboxed)
   */
  async settle(request: SettlementRequest, simulate: boolean = true): Promise<SettlementResult> {
    // Validate request
    if (!this.validateRequest(request)) {
      return this.createFailedResult('Invalid settlement request');
    }
    
    // Safety: Check mainnet not allowed
    if (isMainnetAllowed()) {
      return this.createFailedResult('Mainnet settlement not permitted in Phase 6');
    }
    
    // If simulating, return simulated result
    if (simulate) {
      return this.createSimulatedResult(request);
    }
    
    // STUB: Real hybrid settlement would:
    // 1. Record settlement intent on-chain (attestation)
    // 2. Execute off-chain payment (Stripe, etc.)
    // 3. Record completion on-chain
    // 4. Return combined receipt
    
    return this.createFailedResult('STUB: Hybrid settlement not yet implemented');
  }
  
  /**
   * Check if adapter is ready
   */
  isReady(): boolean {
    // Would check both on-chain and off-chain connections
    return false; // STUB: Not ready until implemented
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      ready: this.isReady(),
      mode: this.mode,
      simulate: this.simulate,
      components: ['onchain_attestation', 'offchain_payment'],
      network: 'devnet/testnet only',
      mainnet_blocked: true
    };
  }
}
