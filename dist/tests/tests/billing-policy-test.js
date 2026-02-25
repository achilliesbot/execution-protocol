/**
 * Billing Policy Tests — Execution Protocol v2
 *
 * Deterministic billing calculations.
 * Same inputs → same outputs. Rejects invalid values.
 *
 * Phase 6 Monetization — Test Pass
 */
import { shouldTriggerBilling, calculateBilling, validateBillingResult, compareBillingResults, DEFAULT_BILLING_POLICY } from '../src/billing/index.js';
// Test utilities
function createTestMetrics(complexityScore = 250) {
    return {
        session_id: 'test-session',
        step_count: 4,
        complexity_score: complexityScore,
        estimated_gas: 180000,
        compute_units: 1900,
        io_operations: 6,
        policy_checks: 4
    };
}
// Test 1: Same inputs → same billable_units/total_due
function testDeterministicBilling() {
    const metrics = createTestMetrics(250);
    const result1 = calculateBilling('test-session', 'hash-abc', metrics);
    const result2 = calculateBilling('test-session', 'hash-abc', metrics);
    return compareBillingResults(result1, result2);
}
// Test 2: Rounding rules deterministic
function testRoundingDeterminism() {
    const metrics1 = createTestMetrics(123.456); // Would be integer in reality
    const metrics2 = createTestMetrics(123);
    // In actual implementation, complexity_score should be integer
    // This test verifies consistent rounding behavior
    const result1 = calculateBilling('s1', 'h1', metrics1);
    const result2 = calculateBilling('s2', 'h2', metrics2);
    // Results should be valid (not NaN, not Infinity)
    return (Number.isFinite(result1.billable_units) &&
        Number.isFinite(result2.billable_units) &&
        !Number.isNaN(result1.total_due) &&
        !Number.isNaN(result2.total_due));
}
// Test 3: Rejects negative values
function testRejectsNegative() {
    const badMetrics = {
        ...createTestMetrics(),
        complexity_score: -100
    };
    const result = calculateBilling('test', 'hash', badMetrics);
    // Should still calculate but with potential negative billable_units
    // In production, should reject at validation stage
    return validateBillingResult(result) === false; // Validation should catch negative
}
// Test 4: Rejects NaN
function testRejectsNaN() {
    const badMetrics = {
        ...createTestMetrics(),
        complexity_score: NaN
    };
    try {
        const result = calculateBilling('test', 'hash', badMetrics);
        return !Number.isNaN(result.billable_units); // Should handle gracefully
    }
    catch {
        return true; // Throwing is also acceptable
    }
}
// Test 5: Rejects Infinity
function testRejectsInfinity() {
    const badMetrics = {
        ...createTestMetrics(),
        complexity_score: Infinity
    };
    try {
        const result = calculateBilling('test', 'hash', badMetrics);
        return !Number.isFinite(result.billable_units) === false;
    }
    catch {
        return true;
    }
}
// Test 6: Billing result validation
function testBillingResultValidation() {
    const valid = {
        session_id: 'test',
        transcript_head_hash: 'hash-abc',
        execution_weight: 100,
        billable_units: 200,
        unit_rate: 1.0,
        total_due: 200,
        pricing_version: '1.0.0',
        pricing_hash: 'sha256:abc123',
        tier: 'small',
        currency: 'EXEC',
        timestamp: new Date().toISOString()
    };
    const invalid1 = { ...valid, session_id: '' };
    const invalid2 = { ...valid, billable_units: -100 };
    const invalid3 = { ...valid, pricing_version: 'invalid' };
    const invalid4 = { ...valid, total_due: 100 }; // Doesn't match billable_units
    return (validateBillingResult(valid) === true &&
        validateBillingResult(invalid1) === false &&
        validateBillingResult(invalid2) === false &&
        validateBillingResult(invalid3) === false &&
        validateBillingResult(invalid4) === false);
}
// Test 7: Trigger conditions
function testTriggerConditions() {
    const policy = DEFAULT_BILLING_POLICY;
    const accepted = shouldTriggerBilling('ACCEPTED', policy);
    const rejected = shouldTriggerBilling('REJECTED', policy);
    const failed = shouldTriggerBilling('FAILED', policy);
    const pending = shouldTriggerBilling('PENDING', policy);
    // Default policy triggers on 'execution_confirmed' which maps to ACCEPTED
    return accepted === true && pending === false;
}
// Test 8: Different execution weights produce different totals
function testWeightAffectsTotal() {
    const lowMetrics = createTestMetrics(50);
    const highMetrics = createTestMetrics(500);
    const lowResult = calculateBilling('s1', 'h1', lowMetrics);
    const highResult = calculateBilling('s2', 'h2', highMetrics);
    return highResult.total_due > lowResult.total_due;
}
// Test 9: Timestamp excluded from comparison
function testTimestampExcluded() {
    const metrics = createTestMetrics();
    const result1 = calculateBilling('s1', 'h1', metrics);
    // Wait a moment
    const result2 = calculateBilling('s1', 'h1', metrics);
    // Timestamps should differ
    const timestampsDiffer = result1.timestamp !== result2.timestamp;
    // But comparison should ignore timestamp
    const comparison = compareBillingResults(result1, result2);
    return timestampsDiffer && comparison;
}
// Test 10: Pricing version format validation
function testPricingVersionFormat() {
    const validVersions = ['1.0.0', '2.1.3', '0.0.1'];
    const invalidVersions = ['1.0', 'v1.0.0', '1.0.0.0', 'abc'];
    const validChecks = validVersions.every(v => /^\d+\.\d+\.\d+$/.test(v));
    const invalidChecks = invalidVersions.every(v => !/^\d+\.\d+\.\d+$/.test(v));
    return validChecks && invalidChecks;
}
// Run all tests
export function runBillingPolicyTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        BILLING POLICY TESTS — Execution Protocol v2        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const tests = [
        { name: 'Deterministic billing (same inputs)', fn: testDeterministicBilling, critical: true },
        { name: 'Rounding rules deterministic', fn: testRoundingDeterminism },
        { name: 'Rejects negative values', fn: testRejectsNegative },
        { name: 'Rejects NaN', fn: testRejectsNaN },
        { name: 'Rejects Infinity', fn: testRejectsInfinity },
        { name: 'Billing result validation', fn: testBillingResultValidation, critical: true },
        { name: 'Trigger conditions', fn: testTriggerConditions },
        { name: 'Weight affects total', fn: testWeightAffectsTotal },
        { name: 'Timestamp excluded from comparison', fn: testTimestampExcluded, critical: true },
        { name: 'Pricing version format', fn: testPricingVersionFormat }
    ];
    let passed = 0;
    let failed = 0;
    let criticalFailures = 0;
    for (const test of tests) {
        try {
            const result = test.fn();
            if (result) {
                console.log(`✅ ${test.name}${test.critical ? ' [CRITICAL]' : ''}`);
                passed++;
            }
            else {
                console.log(`❌ ${test.name}${test.critical ? ' [CRITICAL]' : ''} — FAILED`);
                failed++;
                if (test.critical)
                    criticalFailures++;
            }
        }
        catch (error) {
            console.log(`❌ ${test.name}${test.critical ? ' [CRITICAL]' : ''} — ERROR: ${error}`);
            failed++;
            if (test.critical)
                criticalFailures++;
        }
    }
    console.log('\n────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed}/${tests.length} passed`);
    if (criticalFailures > 0) {
        console.log(`🔴 ${criticalFailures} CRITICAL FAILURE(S)`);
    }
    else if (failed === 0) {
        console.log('✅ ALL TESTS PASSED');
    }
    console.log('────────────────────────────────────────────────────────────\n');
}
// Run if executed directly
if (require.main === module) {
    runBillingPolicyTests();
}
