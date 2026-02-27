/**
 * Off-Chain Adapter — Execution Protocol v2
 *
 * Off-chain settlement via traditional payment rails.
 * Stripe-style integration. No blockchain required.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { BaseSettlementAdapter, SettlementRequest, SettlementResult } from '../BaseSettlementAdapter';
/**
 * Off-chain settlement adapter
 */
export declare class OffChainAdapter extends BaseSettlementAdapter {
    readonly mode: "offchain";
    readonly name = "OffChainAdapter";
    /**
     * Execute off-chain settlement (sandboxed)
     */
    settle(request: SettlementRequest, simulate?: boolean): Promise<SettlementResult>;
    /**
     * Check if adapter is ready
     */
    isReady(): boolean;
    /**
     * Get status
     */
    getStatus(): {
        ready: boolean;
        mode: "offchain";
        simulate: boolean;
        provider: string;
        network: string;
    };
}
//# sourceMappingURL=OffChainAdapter.d.ts.map