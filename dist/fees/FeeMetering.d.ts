/**
 * Fee Metering Engine — Execution Protocol v2
 *
 * Execution weight metering for usage-based economics.
 * Dry-run mode only. No billing/settlement logic.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
import { VerifierTranscriptSession } from '../integrations';
/**
 * Execution metrics for fee calculation
 */
export interface ExecutionMetrics {
    session_id: string;
    step_count: number;
    complexity_score: number;
    estimated_gas: number;
    compute_units: number;
    io_operations: number;
    policy_checks: number;
}
/**
 * Fee estimate (dry-run)
 */
export interface FeeEstimate {
    base_fee: number;
    complexity_multiplier: number;
    execution_weight: number;
    total: number;
    currency: 'EXEC' | 'USDC' | 'ETH';
    breakdown: FeeBreakdown;
    dry_run: true;
}
/**
 * Fee breakdown
 */
export interface FeeBreakdown {
    base: number;
    per_step: number;
    per_compute_unit: number;
    per_io_operation: number;
    per_policy_check: number;
}
/**
 * Fee configuration
 */
export interface FeeConfig {
    base_fee: number;
    step_rate: number;
    compute_unit_rate: number;
    io_rate: number;
    policy_check_rate: number;
    complexity_threshold: number;
    complexity_multiplier: number;
}
/**
 * Default fee configuration (dry-run rates)
 */
export declare const DEFAULT_FEE_CONFIG: FeeConfig;
/**
 * Count execution steps in session
 * Pure function — no side effects
 */
export declare function countExecutionSteps(session: VerifierTranscriptSession): number;
/**
 * Calculate complexity score
 * Based on step count, content size, and entry variety
 * Pure function — no side effects
 */
export declare function calculateComplexity(session: VerifierTranscriptSession): number;
/**
 * Estimate gas usage
 * Based on operation types in transcript
 * Pure function — no side effects
 */
export declare function estimateGas(session: VerifierTranscriptSession): number;
/**
 * Count compute units
 * Based on entry processing complexity
 * Pure function — no side effects
 */
export declare function countComputeUnits(session: VerifierTranscriptSession): number;
/**
 * Count I/O operations
 * Based on data access patterns
 * Pure function — no side effects
 */
export declare function countIOOperations(session: VerifierTranscriptSession): number;
/**
 * Count policy checks
 * Pure function — no side effects
 */
export declare function countPolicyChecks(session: VerifierTranscriptSession): number;
/**
 * Calculate execution metrics
 * Pure function — no side effects
 */
export declare function calculateMetrics(session: VerifierTranscriptSession): ExecutionMetrics;
/**
 * Calculate fee estimate (dry-run)
 * Pure function — no side effects
 */
export declare function calculateFee(session: VerifierTranscriptSession, config?: FeeConfig, currency?: 'EXEC' | 'USDC' | 'ETH'): FeeEstimate;
/**
 * Calculate fees for multiple sessions
 * Pure function — no side effects
 */
export declare function calculateBatchFees(sessions: VerifierTranscriptSession[], config?: FeeConfig, currency?: 'EXEC' | 'USDC' | 'ETH'): {
    total: number;
    estimates: FeeEstimate[];
};
/**
 * Compare fee estimates
 * Pure function — no side effects
 */
export declare function compareFees(a: FeeEstimate, b: FeeEstimate): number;
/**
 * Get fee summary for display
 * Pure function — no side effects
 */
export declare function getFeeSummary(estimate: FeeEstimate): string;
//# sourceMappingURL=FeeMetering.d.ts.map