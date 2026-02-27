/**
 * Pricing Config Tests — Execution Protocol v2
 *
 * Pricing hash stability, version immutability, determinism.
 *
 * Phase 6 Monetization — Test Pass
 */
import { computePricingHash, validatePricingConfig, calculateBillableUnits, DEFAULT_PRICING } from '../src/pricing/index.js';
import * as fs from 'fs';
import * as path from 'path';
// Test utilities
const TEST_PRICING_DIR = path.join('/tmp', 'pricing-test');
function cleanupTestPricing() {
    if (fs.existsSync(TEST_PRICING_DIR)) {
        fs.rmSync(TEST_PRICING_DIR, { recursive: true });
    }
}
// Test 1: Pricing hash stable across 100 iterations
function testPricingHashStability() {
    const config = { ...DEFAULT_PRICING };
    const hash1 = computePricingHash(config);
    for (let i = 0; i < 99; i++) {
        const hashN = computePricingHash(config);
        if (hashN !== hash1) {
            return false;
        }
    }
    return true;
}
// Test 2: Version file immutability (reject in-place edits)
function testVersionFileImmutability() {
    cleanupTestPricing();
    // Create a test pricing config
    const config = {
        ...DEFAULT_PRICING,
        version: '1.0.0-test'
    };
    // Mock the save location
    const originalDir = path.join(__dirname, '../../pricing');
    try {
        // First save should work
        const testPath = path.join(TEST_PRICING_DIR, 'pricing.v1.0.0-test.json');
        fs.mkdirSync(TEST_PRICING_DIR, { recursive: true });
        fs.writeFileSync(testPath, JSON.stringify(config, null, 2));
        // Second save should fail (file exists)
        try {
            fs.writeFileSync(testPath, JSON.stringify({ ...config, base_fee: 999 }, null, 2));
            // If we get here, overwrite succeeded (bad)
            cleanupTestPricing();
            return false;
        }
        catch {
            // Expected: overwrite should be prevented
            cleanupTestPricing();
            return true;
        }
    }
    catch {
        cleanupTestPricing();
        return false;
    }
}
// Test 3: Deterministic parse/canonicalization
function testDeterministicParse() {
    const config1 = { ...DEFAULT_PRICING };
    const config2 = JSON.parse(JSON.stringify(DEFAULT_PRICING));
    const hash1 = computePricingHash(config1);
    const hash2 = computePricingHash(config2);
    return hash1 === hash2;
}
// Test 4: Validate pricing config integrity
function testValidatePricingConfig() {
    // Valid config
    const valid = validatePricingConfig(DEFAULT_PRICING);
    // Invalid: missing version
    const invalid1 = { ...DEFAULT_PRICING, version: '' };
    // Invalid: negative base fee
    const invalid2 = { ...DEFAULT_PRICING, base_fee: -100 };
    // Invalid: bad currency
    const invalid3 = { ...DEFAULT_PRICING, currency: 'INVALID' };
    return (valid === true &&
        validatePricingConfig(invalid1) === false &&
        validatePricingConfig(invalid2) === false &&
        validatePricingConfig(invalid3) === false);
}
// Test 5: Tier continuity check
function testTierContinuity() {
    const config = DEFAULT_PRICING;
    let expectedMin = 0;
    for (const tier of config.tiers) {
        if (tier.min_weight !== expectedMin) {
            return false;
        }
        expectedMin = tier.max_weight;
    }
    return true;
}
// Test 6: Billable units calculation deterministic
function testBillableUnitsDeterminism() {
    const config = DEFAULT_PRICING;
    const weight = 250;
    const result1 = calculateBillableUnits(weight, config);
    const result2 = calculateBillableUnits(weight, config);
    return (result1.tier === result2.tier &&
        result1.billable_units === result2.billable_units);
}
// Test 7: Different weights produce different tiers
function testTierProgression() {
    const config = DEFAULT_PRICING;
    const micro = calculateBillableUnits(50, config);
    const small = calculateBillableUnits(200, config);
    const medium = calculateBillableUnits(600, config);
    const large = calculateBillableUnits(1500, config);
    return (micro.tier === 'micro' &&
        small.tier === 'small' &&
        medium.tier === 'medium' &&
        large.tier === 'large');
}
// Test 8: Pricing hash excludes metadata
function testHashExcludesMetadata() {
    const config1 = { ...DEFAULT_PRICING, metadata: { description: 'A' } };
    const config2 = { ...DEFAULT_PRICING, metadata: { description: 'B' } };
    const hash1 = computePricingHash(config1);
    const hash2 = computePricingHash(config2);
    // Hashes should be identical (metadata not included)
    return hash1 === hash2;
}
// Run all tests
export function runPricingConfigTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       PRICING CONFIG TESTS — Execution Protocol v2         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const tests = [
        { name: 'Pricing hash stable (100 iterations)', fn: testPricingHashStability, critical: true },
        { name: 'Version file immutability', fn: testVersionFileImmutability, critical: true },
        { name: 'Deterministic parse/canonicalization', fn: testDeterministicParse, critical: true },
        { name: 'Validate pricing config integrity', fn: testValidatePricingConfig },
        { name: 'Tier continuity check', fn: testTierContinuity },
        { name: 'Billable units determinism', fn: testBillableUnitsDeterminism },
        { name: 'Tier progression', fn: testTierProgression },
        { name: 'Hash excludes metadata', fn: testHashExcludesMetadata }
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
    runPricingConfigTests();
}
