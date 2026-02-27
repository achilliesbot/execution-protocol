/**
 * Reputation Engine Tests — Execution Protocol v2
 *
 * Pure function tests for reputation scoring.
 * Off-chain only. No external dependencies.
 */
import { extractSessionOutcome, calculateBaseReputation, calculateExecutionQuality, calculateConsistency, calculateVolume, calculatePolicyCompliance, computeReputation, compareReputation } from '../src/reputation/index.js';
// Test utilities
function createEntry(type, sessionId = 'test') {
    return {
        entry_hash: `hash-${type}-${Date.now()}`,
        previous_hash: null,
        session_id: sessionId,
        entry_type: type,
        content: {},
        agent_id: 'test-agent'
    };
}
function createSession(outcomeType, sessionId = 'test') {
    let entries = [];
    entries.push(createEntry('proposal_received', sessionId));
    entries.push(createEntry('validation_complete', sessionId));
    switch (outcomeType) {
        case 'success':
            entries.push(createEntry('plan_generated', sessionId));
            entries.push(createEntry('execution_confirmed', sessionId));
            break;
        case 'rejected':
            entries.push(createEntry('rejected', sessionId));
            break;
        case 'failed':
            entries.push(createEntry('plan_generated', sessionId));
            entries.push(createEntry('execution_failed', sessionId));
            break;
        case 'pending':
            entries.push(createEntry('plan_generated', sessionId));
            // No final outcome
            break;
    }
    return { session_id: sessionId, entries };
}
// Test 1: Extract success outcome
function testExtractSuccessOutcome() {
    const session = createSession('success');
    return extractSessionOutcome(session) === 'success';
}
// Test 2: Extract rejection outcome
function testExtractRejectionOutcome() {
    const session = createSession('rejected');
    return extractSessionOutcome(session) === 'rejected';
}
// Test 3: Extract failure outcome
function testExtractFailureOutcome() {
    const session = createSession('failed');
    return extractSessionOutcome(session) === 'failed';
}
// Test 4: Extract pending outcome
function testExtractPendingOutcome() {
    const session = createSession('pending');
    return extractSessionOutcome(session) === 'pending';
}
// Test 5: Base reputation values
function testBaseReputationValues() {
    return (calculateBaseReputation('success') === 100 &&
        calculateBaseReputation('rejected') === 50 &&
        calculateBaseReputation('failed') === 25 &&
        calculateBaseReputation('pending') === 75);
}
// Test 6: Execution quality with all successes
function testExecutionQualityAllSuccess() {
    const sessions = [
        createSession('success'),
        createSession('success'),
        createSession('success')
    ];
    const quality = calculateExecutionQuality(sessions);
    return quality.value === 100 && quality.raw_count === 3;
}
// Test 7: Execution quality with mixed outcomes
function testExecutionQualityMixed() {
    const sessions = [
        createSession('success'),
        createSession('rejected'),
        createSession('failed')
    ];
    const quality = calculateExecutionQuality(sessions);
    const expected = Math.round((100 + 50 + 25) / 3); // 58
    return quality.value === expected && quality.raw_count === 3;
}
// Test 8: Consistency with high success rate
function testConsistencyHighSuccess() {
    const sessions = Array(8).fill(null).map(() => createSession('success'))
        .concat(Array(2).fill(null).map(() => createSession('rejected')));
    const consistency = calculateConsistency(sessions);
    return consistency.value >= 90 && consistency.raw_count === 10;
}
// Test 9: Consistency with high failure rate
function testConsistencyHighFailure() {
    const sessions = Array(5).fill(null).map(() => createSession('failed'));
    const consistency = calculateConsistency(sessions);
    return consistency.value === 30 && consistency.raw_count === 5;
}
// Test 10: Volume score increases with more sessions
function testVolumeIncreases() {
    const fewSessions = Array(2).fill(null).map((_, i) => createSession('success', `s${i}`));
    const manySessions = Array(20).fill(null).map((_, i) => createSession('success', `s${i}`));
    const fewVolume = calculateVolume(fewSessions);
    const manyVolume = calculateVolume(manySessions);
    return fewVolume.value < manyVolume.value;
}
// Test 11: Policy compliance with only rejections
function testPolicyComplianceGood() {
    const sessions = Array(5).fill(null).map((_, i) => createSession('rejected', `s${i}`));
    const compliance = calculatePolicyCompliance(sessions);
    return compliance.value === 100; // All non-success are policy rejections (good)
}
// Test 12: Policy compliance with only failures
function testPolicyComplianceBad() {
    const sessions = Array(5).fill(null).map((_, i) => createSession('failed', `s${i}`));
    const compliance = calculatePolicyCompliance(sessions);
    return compliance.value === 50; // All non-success are failures (bad)
}
// Test 13: Full reputation computation
function testComputeReputation() {
    const sessions = [
        createSession('success', 's1'),
        createSession('success', 's2'),
        createSession('rejected', 's3')
    ];
    const reputation = computeReputation('test-agent', sessions);
    return (reputation.agent_id === 'test-agent' &&
        reputation.score >= 0 && reputation.score <= 100 &&
        reputation.confidence > 0 &&
        reputation.factors.length === 5 &&
        reputation.session_count === 3);
}
// Test 14: Reputation score bounds
function testReputationBounds() {
    const badSessions = Array(10).fill(null).map((_, i) => createSession('failed', `s${i}`));
    const goodSessions = Array(10).fill(null).map((_, i) => createSession('success', `s${i}`));
    const badRep = computeReputation('bad', badSessions);
    const goodRep = computeReputation('good', goodSessions);
    return badRep.score < goodRep.score && badRep.score >= 0 && goodRep.score <= 100;
}
// Test 15: Compare reputation scores
function testCompareReputation() {
    const scoreA = {
        agent_id: 'A',
        score: 80,
        confidence: 0.9,
        factors: [],
        computed_at: new Date().toISOString(),
        session_count: 10
    };
    const scoreB = {
        agent_id: 'B',
        score: 70,
        confidence: 0.8,
        factors: [],
        computed_at: new Date().toISOString(),
        session_count: 10
    };
    return compareReputation(scoreA, scoreB) > 0;
}
// Test 16: Empty sessions handling
function testEmptySessions() {
    const reputation = computeReputation('empty-agent', []);
    return (reputation.score === 50 && // Default neutral score
        reputation.confidence === 0 &&
        reputation.session_count === 0);
}
// Run all tests
export function runReputationTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       REPUTATION ENGINE TESTS — Execution Protocol v2      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const tests = [
        { name: 'Extract success outcome', fn: testExtractSuccessOutcome },
        { name: 'Extract rejection outcome', fn: testExtractRejectionOutcome },
        { name: 'Extract failure outcome', fn: testExtractFailureOutcome },
        { name: 'Extract pending outcome', fn: testExtractPendingOutcome },
        { name: 'Base reputation values', fn: testBaseReputationValues },
        { name: 'Execution quality all success', fn: testExecutionQualityAllSuccess },
        { name: 'Execution quality mixed', fn: testExecutionQualityMixed },
        { name: 'Consistency high success', fn: testConsistencyHighSuccess },
        { name: 'Consistency high failure', fn: testConsistencyHighFailure },
        { name: 'Volume increases with sessions', fn: testVolumeIncreases },
        { name: 'Policy compliance (only rejections)', fn: testPolicyComplianceGood },
        { name: 'Policy compliance (only failures)', fn: testPolicyComplianceBad },
        { name: 'Full reputation computation', fn: testComputeReputation },
        { name: 'Reputation score bounds', fn: testReputationBounds },
        { name: 'Compare reputation scores', fn: testCompareReputation },
        { name: 'Empty sessions handling', fn: testEmptySessions }
    ];
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        try {
            const result = test.fn();
            if (result) {
                console.log(`✅ ${test.name}`);
                passed++;
            }
            else {
                console.log(`❌ ${test.name} — returned false`);
                failed++;
            }
        }
        catch (error) {
            console.log(`❌ ${test.name} — threw: ${error}`);
            failed++;
        }
    }
    console.log('\n────────────────────────────────────────────────────────────');
    console.log(`Total: ${passed}/${tests.length} passed`);
    console.log(failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST(S) FAILED`);
    console.log('────────────────────────────────────────────────────────────\n');
}
// Run if executed directly
if (require.main === module) {
    runReputationTests();
}
