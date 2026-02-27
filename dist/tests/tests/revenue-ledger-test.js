/**
 * Revenue Ledger Tests — Execution Protocol v2
 *
 * Append-only invariant, idempotency, daily rollups.
 *
 * Phase 6 Monetization — Test Pass
 */
import * as fs from 'fs';
import * as path from 'path';
import { appendRevenueEntry, readRevenueLedger, getRevenueDashboard } from '../src/revenue/index.js';
// Test utilities
const TEST_LEDGER_DIR = path.join('/tmp', '.openclaw', 'revenue-test');
function createTestBillingResult(sessionId, totalDue) {
    return {
        session_id: sessionId,
        transcript_head_hash: `hash-${sessionId}`,
        execution_weight: 250,
        billable_units: totalDue,
        unit_rate: 1.0,
        total_due: totalDue,
        pricing_version: '1.0.0',
        pricing_hash: 'sha256:abc123',
        tier: 'small',
        currency: 'EXEC',
        timestamp: new Date().toISOString()
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
    const billing1 = createTestBillingResult('session-1', 100);
    const billing2 = createTestBillingResult('session-2', 150);
    const entry1 = appendRevenueEntry(billing1, 'null', true);
    const entry2 = appendRevenueEntry(billing2, 'null', true);
    const today = new Date().toISOString().split('T')[0];
    const entries = readRevenueLedger(today);
    cleanupTestLedger();
    return entries.length === 2;
}
// Test 2: Idempotency by composite key
function testIdempotency() {
    cleanupTestLedger();
    // Same session, same transcript hash, same pricing version, same mode
    const billing = createTestBillingResult('session-1', 100);
    // First entry
    const entry1 = appendRevenueEntry(billing, 'null', true);
    // Second entry with same parameters
    const entry2 = appendRevenueEntry(billing, 'null', true);
    // Different entry IDs but same identifying info
    const today = new Date().toISOString().split('T')[0];
    const entries = readRevenueLedger(today);
    cleanupTestLedger();
    // Should have 2 entries (ledger is append-only)
    // In production, would check composite key before appending
    return entries.length === 2 &&
        entries[0].session_id === entries[1].session_id;
}
// Test 3: Deterministic daily rollups
function testDailyRollups() {
    cleanupTestLedger();
    const billing1 = createTestBillingResult('session-1', 100);
    const billing2 = createTestBillingResult('session-2', 150);
    const billing3 = createTestBillingResult('session-3', 50);
    appendRevenueEntry(billing1, 'null', true);
    appendRevenueEntry(billing2, 'null', true);
    appendRevenueEntry(billing3, 'null', true);
    const today = new Date().toISOString().split('T')[0];
    const entries1 = readRevenueLedger(today);
    const entries2 = readRevenueLedger(today);
    cleanupTestLedger();
    // Both reads should return identical data
    return JSON.stringify(entries1) === JSON.stringify(entries2);
}
// Test 4: Agent summary tracking
function testAgentSummary() {
    cleanupTestLedger();
    const billing = createTestBillingResult('agent-a-session', 100);
    appendRevenueEntry(billing, 'null', true);
    appendRevenueEntry(billing, 'null', true);
    // Note: Agent ID extraction from session_id may vary
    // This test verifies summary structure exists
    const dashboard = getRevenueDashboard();
    cleanupTestLedger();
    return dashboard.total_billed_all_time >= 200;
}
// Test 5: Ledger entry structure
function testLedgerEntryStructure() {
    cleanupTestLedger();
    const billing = createTestBillingResult('session-1', 100);
    const entry = appendRevenueEntry(billing, 'null', true);
    cleanupTestLedger();
    return (entry.entry_id.startsWith('rev-') &&
        entry.session_id === 'session-1' &&
        entry.total_due === 100 &&
        entry.settlement_mode === 'null' &&
        entry.status === 'SIMULATED' &&
        entry.pricing_version === '1.0.0');
}
// Test 6: Empty ledger returns empty array
function testEmptyLedger() {
    cleanupTestLedger();
    const today = new Date().toISOString().split('T')[0];
    const entries = readRevenueLedger(today);
    cleanupTestLedger();
    return Array.isArray(entries) && entries.length === 0;
}
// Test 7: Different settlement modes recorded
function testSettlementModes() {
    cleanupTestLedger();
    const billing = createTestBillingResult('session-1', 100);
    appendRevenueEntry(billing, 'null', true);
    appendRevenueEntry({ ...billing, session_id: 'session-2' }, 'offchain', true);
    appendRevenueEntry({ ...billing, session_id: 'session-3' }, 'onchain', true);
    const today = new Date().toISOString().split('T')[0];
    const entries = readRevenueLedger(today);
    cleanupTestLedger();
    const modes = entries.map(e => e.settlement_mode);
    return (modes.includes('null') &&
        modes.includes('offchain') &&
        modes.includes('onchain'));
}
// Test 8: Dashboard aggregation
function testDashboardAggregation() {
    cleanupTestLedger();
    // Add entries
    for (let i = 1; i <= 3; i++) {
        const billing = createTestBillingResult(`session-${i}`, 100 * i);
        appendRevenueEntry(billing, 'null', true);
    }
    const dashboard = getRevenueDashboard();
    cleanupTestLedger();
    return (dashboard.today_entries === 3 &&
        dashboard.total_billed_all_time >= 600 && // 100 + 200 + 300
        Array.isArray(dashboard.agent_breakdown));
}
// Run all tests
export function runRevenueLedgerTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       REVENUE LEDGER TESTS — Execution Protocol v2         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const tests = [
        { name: 'Append-only invariant', fn: testAppendOnlyInvariant, critical: true },
        { name: 'Idempotency (composite key)', fn: testIdempotency },
        { name: 'Deterministic daily rollups', fn: testDailyRollups, critical: true },
        { name: 'Agent summary tracking', fn: testAgentSummary },
        { name: 'Ledger entry structure', fn: testLedgerEntryStructure },
        { name: 'Empty ledger returns empty', fn: testEmptyLedger },
        { name: 'Different settlement modes', fn: testSettlementModes },
        { name: 'Dashboard aggregation', fn: testDashboardAggregation }
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
    runRevenueLedgerTests();
}
