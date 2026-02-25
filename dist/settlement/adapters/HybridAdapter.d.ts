/**
 * Hybrid Adapter — Execution Protocol v2
 *
 * Combines on-chain verification with off-chain payment rails.
 * Devnet/testnet only for on-chain component.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { BaseSettlementAdapter, SettlementRequest, SettlementResult } from '../BaseSettlementAdapter';
/**
 * Hybrid settlement adapter
 */
export declare class HybridAdapter extends BaseSettlementAdapter {
    readonly mode: "hybrid";
    readonly name = "HybridAdapter";
    /**
     * Execute hybrid settlement (sandboxed)
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
        mode: "hybrid";
        simulate: boolean;
        components: string[];
        network: string;
        mainnet_blocked: boolean;
    };
}
//# sourceMappingURL=HybridAdapter.d.ts.map