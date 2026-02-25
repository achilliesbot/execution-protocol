/**
 * On-Chain Adapter — Execution Protocol v2
 *
 * On-chain settlement via smart contract.
 * Devnet/testnet only. Mainnet blocked.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { BaseSettlementAdapter } from '../SettlementAdapter.js';
import { isMainnetAllowed } from '../../config/Phase6Flags.js';
/**
 * On-chain settlement adapter
 */
export class OnChainAdapter extends BaseSettlementAdapter {
    constructor() {
        super(...arguments);
        this.mode = 'onchain';
        this.name = 'OnChainAdapter';
    }
    /**
     * Execute on-chain settlement (sandboxed)
     */
    async settle(request, simulate = true) {
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
        // STUB: Real on-chain settlement would:
        // 1. Connect to RPC endpoint
        // 2. Submit transaction to settlement contract
        // 3. Wait for confirmation
        // 4. Return transaction hash
        return this.createFailedResult('STUB: On-chain settlement not yet implemented');
    }
    /**
     * Check if adapter is ready
     */
    isReady() {
        // Would check RPC connection, contract address, etc.
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
            network: 'devnet/testnet only',
            mainnet_blocked: true
        };
    }
}
