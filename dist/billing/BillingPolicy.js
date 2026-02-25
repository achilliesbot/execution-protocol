/**
 * Billing Policy — Execution Protocol v2
 *
 * Deterministic billing calculations.
 * Single path: execution_weight → billable_units → total_due
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import { loadPricingConfig, calculateBillableUnits, computePricingHash } from '../pricing/index.js';
/**
 * Default billing policy
 */
export const DEFAULT_BILLING_POLICY = {
    trigger_on: 'execution_confirmed', // Bill only on confirmed execution
    pricing_version: '1.0.0'
};
/**
 * Check if billing should trigger for this session state
 */
export function shouldTriggerBilling(sessionStatus, policy = DEFAULT_BILLING_POLICY) {
    switch (policy.trigger_on) {
        case 'session_accepted':
            return sessionStatus === 'ACCEPTED';
        case 'execution_attempted':
            // Trigger on any non-pending status
            return sessionStatus !== 'PENDING';
        case 'execution_confirmed':
            // Only trigger on successful execution
            return sessionStatus === 'ACCEPTED'; // SUCCESS maps to ACCEPTED
        default:
            return false;
    }
}
/**
 * Calculate billing from execution metrics
 * Pure function — deterministic
 */
export function calculateBilling(sessionId, transcriptHeadHash, metrics, policy = DEFAULT_BILLING_POLICY) {
    const complexityScore = metrics.complexity_score;
    if (!Number.isFinite(complexityScore) || complexityScore < 0) {
        throw new Error('Invalid complexity_score: must be finite and >= 0');
    }
    // Load pricing config
    const pricing = loadPricingConfig(policy.pricing_version);
    // Determine tier (reuses pricing tier selection)
    const { tier } = calculateBillableUnits(complexityScore, pricing);
    // Get unit rate for the tier (must exist)
    const tierConfig = pricing.tiers.find(t => t.name === tier);
    if (!tierConfig) {
        throw new Error(`Pricing tier not found: ${tier}`);
    }
    const unitRate = tierConfig.unit_rate;
    // Calculate total due using unit_rate explicitly
    const totalDue = Math.round(pricing.base_fee + complexityScore * unitRate);
    if (!Number.isFinite(totalDue) || totalDue < 0) {
        throw new Error('Billing calculation produced invalid total_due');
    }
    // In this model, billable_units == total_due
    const billableUnits = totalDue;
    return {
        session_id: sessionId,
        transcript_head_hash: transcriptHeadHash,
        execution_weight: complexityScore,
        billable_units: billableUnits,
        unit_rate: unitRate,
        total_due: totalDue,
        pricing_version: pricing.version,
        pricing_hash: computePricingHash(pricing),
        tier,
        currency: pricing.currency,
        timestamp: new Date().toISOString()
    };
}
/**
 * Validate billing result integrity
 */
export function validateBillingResult(result) {
    // Check all required fields present
    if (!result.session_id || !result.transcript_head_hash) {
        return false;
    }
    // Check values are non-negative
    if (result.execution_weight < 0 || result.billable_units < 0 || result.total_due < 0) {
        return false;
    }
    // Check pricing version format
    if (!/^\d+\.\d+\.\d+$/.test(result.pricing_version)) {
        return false;
    }
    // Check hash format
    if (!result.pricing_hash || result.pricing_hash.length < 16) {
        return false;
    }
    // Verify calculation: total_due should equal billable_units (in this model)
    if (result.total_due !== result.billable_units) {
        return false;
    }
    return true;
}
/**
 * Compare two billing results (for testing determinism)
 */
export function compareBillingResults(a, b) {
    return (a.session_id === b.session_id &&
        a.execution_weight === b.execution_weight &&
        a.billable_units === b.billable_units &&
        a.total_due === b.total_due &&
        a.pricing_version === b.pricing_version &&
        a.pricing_hash === b.pricing_hash &&
        a.tier === b.tier
    // Exclude timestamp (non-deterministic)
    );
}
//# sourceMappingURL=BillingPolicy.js.map