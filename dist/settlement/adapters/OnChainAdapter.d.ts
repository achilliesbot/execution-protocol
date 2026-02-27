/**
 * On-Chain Adapter — Execution Protocol v2
 *
 * On-chain settlement via smart contract.
 * Devnet/testnet only. Mainnet blocked.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { BaseSettlementAdapter, SettlementRequest, SettlementResult } from '../BaseSettlementAdapter';
/**
 * On-chain settlement adapter
 */
export declare class OnChainAdapter extends BaseSettlementAdapter {
    readonly mode: "onchain";
    readonly name = "OnChainAdapter";
    /**
     * Execute on-chain settlement (sandboxed)
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
        mode: "onchain";
        simulate: boolean;
        network: string;
        mainnet_blocked: boolean;
    };
}
//# sourceMappingURL=OnChainAdapter.d.ts.map