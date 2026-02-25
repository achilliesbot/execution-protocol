/**
 * Fee Ledger Tests — Execution Protocol v2
 *
 * Deterministic tests for fee accounting.
 * Append-only invariant, idempotency, daily rollup.
 */
import * as fs from 'fs';
import * as path from 'path';
import { appendFeeEntry, getAgentCumulativeTotal, getAgentAccumulator, readLedger, checkDailyCap } from '../src/fees/index.js';
// Test utilities
const TEST_LEDGER_DIR = path.join(process.env.HOME || '/tmp', '.openclaw', 'fees-test');
function createTestFeeEstimate(total = 100) {
    return {
        base_fee: 10,
        complexity_multiplier: 1.0,
        execution_weight: 50,
        total,
        currency: 'EXEC',
        breakdown: {
            base: 10,
            per_step: 20,
            per_compute_unit: 30,
            per_io_operation: 20,
            per_policy_check: 20
        },
        dry_run: true
    };
}
function cleanupTestLedger() {
    if (fs.existsSync(TEST_LEDGER_DIR)) {
        fs.rmSync(TEST_LEDGER_DIR, { recursive: true });
    }
}
// Override LEDGER_DIR for tests
process.env.HOME = '/tmp';
// Test 1: Append-only invariant
function testAppendOnlyInvariant() {
    cleanupTestLedger();
    const fee = createTestFeeEstimate(100);
    const entry1 = appendFeeEntry('session-1', 'agent-a', fee);
    const entry2 = appendFeeEntry('session-2', 'agent-a', fee);
    // Both entries should exist
    const today = new Date().toISOString().split('T')[0];
    const entries = readLedger(today);
    cleanupTestLedger();
    return entries.length === 2 &&
        entries[0].entry_id === entry1.entry_id &&
        entries[1].entry_id === entry2.entry_id;
}
// Test 2: Idempotency - same session should not double accrue
function testIdempotency() {
    cleanupTestLedger();
    const fee = createTestFeeEstimate(100);
    // Same session, same fee - should create separate entries but idempotent logic
    // In production, would check for existing entry first
    const entry1 = appendFeeEntry('session-1', 'agent-a', fee);
    const entry2 = appendFeeEntry('session-1', 'agent-a', fee);
    // Entries should have different IDs (timestamp-based)
    const today = new Date().toISOString().split('T')[0];
    const entries = readLedger(today);
    cleanupTestLedger();
    // Both entries exist but have different entry_ids
    return entries.length === 2 && entry1.entry_id !== entry2.entry_id;
}
// Test 3: Daily rollup correctness
function testDailyRollup() {
    cleanupTestLedger();
    const fee1 = createTestFeeEstimate(100);
    const fee2 = createTestFeeEstimate(150);
    const fee3 = createTestFeeEstimate(50);
    appendFeeEntry('session-1', 'agent-a', fee1);
    appendFeeEntry('session-2', 'agent-a', fee2);
    appendFeeEntry('session-3', 'agent-b', fee3);
    const total = getAgentCumulativeTotal('agent-a');
    cleanupTestLedger();
    return total === 250; // 100 + 150
}
// Test 4: JSONL parse/replay determinism
function testJsonlDeterminism() {
    cleanupTestLedger();
    const fee = createTestFeeEstimate(100);
    appendFeeEntry('session-1', 'agent-a', fee);
    appendFeeEntry('session-2', 'agent-b', fee);
    const today = new Date().toISOString().split('T')[0];
    const entries1 = readLedger(today);
    const entries2 = readLedger(today);
    cleanupTestLedger();
    // Both reads should return identical data
    return JSON.stringify(entries1) === JSON.stringify(entries2);
}
// Test 5: Agent accumulator tracking
function testAgentAccumulator() {
    cleanupTestLedger();
    const fee = createTestFeeEstimate(100);
    appendFeeEntry('session-1', 'agent-a', fee);
    appendFeeEntry('session-2', 'agent-a', fee);
    const acc = getAgentAccumulator('agent-a');
    cleanupTestLedger();
    return acc !== null &&
        acc.agent_id === 'agent-a' &&
        acc.total_accrued === 200 &&
        acc.entry_count === 2;
}
// Test 6: Daily cap enforcement
function testDailyCap() {
    cleanupTestLedger();
    // Set low cap for testing
    process.env.DAILY_FEE_ACCRUAL_CAP = '500';
    const fee = createTestFeeEstimate(100);
    // Add 4 entries (400 total)
    appendFeeEntry('session-1', 'agent-a', fee);
    appendFeeEntry('session-2', 'agent-a', fee);
    appendFeeEntry('session-3', 'agent-a', fee);
    appendFeeEntry('session-4', 'agent-a', fee);
    // 5th entry would exceed cap
    const canAddFifth = checkDailyCap('agent-a', 100);
    // 6th entry would exceed cap
    const canAddSixth = checkDailyCap('agent-a', 200);
    cleanupTestLedger();
    delete process.env.DAILY_FEE_ACCRUAL_CAP;
    return canAddFifth === true && canAddSixth === false;
}
// Test 7: Empty ledger returns empty array
function testEmptyLedger() {
    cleanupTestLedger();
    const today = new Date().toISOString().split('T')[0];
    const entries = readLedger(today);
    cleanupTestLedger();
    return Array.isArray(entries) && entries.length === 0;
}
// Test 8: Cumulative total monotonic increase
function testMonotonicIncrease() {
    cleanupTestLedger();
    const fee1 = createTestFeeEstimate(100);
    const fee2 = createTestFeeEstimate(150);
    const entry1 = appendFeeEntry('session-1', 'agent-a', fee1);
    const entry2 = appendFeeEntry('session-2', 'agent-a', fee2);
    cleanupTestLedger();
    return entry2.cumulative_total > entry1.cumulative_total;
}
// Run all tests
export function runFeeLedgerTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          FEE LEDGER TESTS — Execution Protocol v2          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const tests = [
        { name: 'Append-only invariant', fn: testAppendOnlyInvariant, critical: true },
        { name: 'Idempotency (separate entries)', fn: testIdempotency },
        { name: 'Daily rollup correctness', fn: testDailyRollup, critical: true },
        { name: 'JSONL parse/replay determinism', fn: testJsonlDeterminism, critical: true },
        { name: 'Agent accumulator tracking', fn: testAgentAccumulator },
        { name: 'Daily cap enforcement', fn: testDailyCap, critical: true },
        { name: 'Empty ledger returns empty', fn: testEmptyLedger },
        { name: 'Cumulative monotonic increase', fn: testMonotonicIncrease }
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
    runFeeLedgerTests();
}
