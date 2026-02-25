/**
 * Billing Policy — Execution Protocol v2
 *
 * Deterministic billing calculations.
 * Single path: execution_weight → billable_units → total_due
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { ExecutionMetrics } from '../fees';
/**
 * Billing policy result
 */
export interface BillingResult {
    session_id: string;
    transcript_head_hash: string;
    execution_weight: number;
    billable_units: number;
    unit_rate: number;
    total_due: number;
    pricing_version: string;
    pricing_hash: string;
    tier: string;
    currency: string;
    timestamp: string;
}
/**
 * Billing policy configuration
 */
export interface BillingPolicy {
    trigger_on: 'session_accepted' | 'execution_attempted' | 'execution_confirmed';
    pricing_version: string;
}
/**
 * Default billing policy
 */
export declare const DEFAULT_BILLING_POLICY: BillingPolicy;
/**
 * Check if billing should trigger for this session state
 */
export declare function shouldTriggerBilling(sessionStatus: 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'PENDING', policy?: BillingPolicy): boolean;
/**
 * Calculate billing from execution metrics
 * Pure function — deterministic
 */
export declare function calculateBilling(sessionId: string, transcriptHeadHash: string, metrics: ExecutionMetrics, policy?: BillingPolicy): BillingResult;
/**
 * Validate billing result integrity
 */
export declare function validateBillingResult(result: BillingResult): boolean;
/**
 * Compare two billing results (for testing determinism)
 */
export declare function compareBillingResults(a: BillingResult, b: BillingResult): boolean;
//# sourceMappingURL=BillingPolicy.d.ts.map