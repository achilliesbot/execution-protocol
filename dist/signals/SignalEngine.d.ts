/**
 * SignalEngine.ts
 *
 * Phase 2: Agent-agnostic signal aggregation
 *
 * Design Principles:
 * - Plugin architecture: Any signal source can register
 * - No hardcoded dependencies: All sources injected
 * - Deterministic scoring: Same signals → Same score
 * - Security: All signals validated before processing
 */
export interface Signal {
    id: string;
    source: string;
    asset: string;
    direction: 'LONG' | 'SHORT';
    confidence: number;
    timestamp: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    metadata?: {
        socialMentions?: number;
        whaleMovements?: boolean;
        technicalScore?: number;
        timeframe?: string;
        [key: string]: any;
    };
}
export interface SignalSource {
    id: string;
    name: string;
    weight: number;
    enabled: boolean;
    fetch(): Promise<Signal[]>;
    validate(signal: Signal): boolean;
}
export interface ScoredSignal {
    signal: Signal;
    riskRewardRatio: number;
    potentialLoss: number;
    potentialGain: number;
    weightedConfidence: number;
    finalScore: number;
    passesConstraints: boolean;
    rejectionReason?: string;
}
/**
 * SignalEngine — Plugin-based signal aggregation
 *
 * Agents register their signal sources, engine aggregates deterministically.
 */
export declare class SignalEngine {
    private sources;
    private signals;
    private scoredSignals;
    private readonly MIN_CONFIDENCE;
    private readonly MIN_RISK_REWARD;
    private readonly MAX_SIGNAL_AGE;
    /**
     * Register a signal source plugin
     *
     * Any agent can register their own source:
     * - Twitter sentiment
     * - Whale watching
     * - Technical analysis
     * - On-chain metrics
     * - Custom agent logic
     */
    registerSource(source: SignalSource): void;
    /**
     * Fetch signals from all enabled sources
     */
    fetchAllSignals(): Promise<Signal[]>;
    /**
     * Score all signals with deterministic algorithm
     */
    scoreSignals(): ScoredSignal[];
    /**
     * Get top N signals that pass constraints
     */
    getTopSignals(n: number): ScoredSignal[];
    /**
     * Security: Validate signal structure
     */
    private validateSignal;
    /**
     * Security: Check all constraints
     */
    private checkConstraints;
    private getRejectionReason;
    getStats(): {
        sources: number;
        signals: number;
        valid: number;
    };
}
export declare const signalEngine: SignalEngine;
//# sourceMappingURL=SignalEngine.d.ts.map