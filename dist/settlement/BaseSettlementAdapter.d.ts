/**
 * Settlement Base Types — Execution Protocol v2
 *
 * NOTE: This file is intentionally split out to avoid ESM circular deps:
 * - Adapters import BaseSettlementAdapter from here
 * - Factory can import adapters without adapters importing the factory module
 */
/**
 * Settlement request
 */
export interface SettlementRequest {
    entry_id: string;
    amount: number;
    currency: string;
    recipient: string;
    metadata: {
        session_id: string;
        transcript_head_hash: string;
    };
}
/**
 * Settlement result
 */
export interface SettlementResult {
    success: boolean;
    transaction_hash: string | null;
    status: 'SIMULATED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
    error?: string;
    timestamp: string;
}
/**
 * Settlement adapter interface
 */
export interface SettlementAdapter {
    readonly mode: 'null' | 'offchain' | 'onchain' | 'hybrid';
    readonly name: string;
    settle(request: SettlementRequest, simulate: boolean): Promise<SettlementResult>;
    isReady(): boolean;
    getStatus(): {
        ready: boolean;
        mode: string;
        simulate: boolean;
        network?: string;
    };
}
/**
 * Abstract base class for settlement adapters
 */
export declare abstract class BaseSettlementAdapter implements SettlementAdapter {
    abstract readonly mode: 'null' | 'offchain' | 'onchain' | 'hybrid';
    abstract readonly name: string;
    protected simulate: boolean;
    abstract settle(request: SettlementRequest, simulate: boolean): Promise<SettlementResult>;
    abstract isReady(): boolean;
    getStatus(): {
        ready: boolean;
        mode: "null" | "offchain" | "onchain" | "hybrid";
        simulate: boolean;
    };
    /**
     * Validate settlement request (fail-closed)
     */
    protected validateRequest(request: SettlementRequest): boolean;
    protected createSimulatedResult(request: SettlementRequest): SettlementResult;
    protected createFailedResult(error: string): SettlementResult;
}
//# sourceMappingURL=BaseSettlementAdapter.d.ts.map