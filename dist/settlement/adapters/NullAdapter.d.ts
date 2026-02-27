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
export declare class NullAdapter extends BaseSettlementAdapter {
    readonly mode: "null";
    readonly name = "NullAdapter";
    /**
     * Always returns simulated success
     * Never executes real settlement
     */
    settle(request: SettlementRequest, simulate?: boolean): Promise<SettlementResult>;
    /**
     * Always ready
     */
    isReady(): boolean;
    /**
     * Get status
     */
    getStatus(): {
        ready: boolean;
        mode: "null";
        simulate: boolean;
        description: string;
    };
}
//# sourceMappingURL=NullAdapter.d.ts.map