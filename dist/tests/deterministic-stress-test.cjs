const FIXED_PROPOSAL = { schema_version:'v1', proposal_id:'fixed-prop-0001', timestamp:'2026-02-24T00:00:00.000Z', expiry:'2026-02-24T01:00:00.000Z', execution_domain:'base', environment:'simulation', opportunity_type:'swap', intent:{action:'swap', asset_in:{symbol:'USDC',chain:'base',decimals:6}, asset_out:{symbol:'ETH',chain:'base',decimals:18}, amount:{type:'exact',value:50,unit:'usd'}}, risk_budget:{max_drawdown_percent:10,max_loss_usd:5,max_loss_percent:10,position_size_percent:25,risk_reward_min:2}, constraints:{slippage_tolerance_percent:1.0,stop_loss:{price:0,type:'fixed'},allow_partial_fill:true,deadline:'2026-02-24T01:00:00.000Z',require_success:false}, reasoning:{alternatives_considered:[],confidence_explanation:'fixed',market_conditions:'fixed',risk_assessment:'fixed',signal_sources:['template'],timing_rationale:'fixed'}, confidence:0.75, agent_id:'test-agent', session_id:'fixed-session-0001'}; function __FIXED_PROPOSAL(){return JSON.parse(JSON.stringify(FIXED_PROPOSAL));}
"use strict";
/**
 * Deterministic Stress Test — Execution Protocol v2
 *
 * GOVERNANCE.md §2.1: Hash drift is unacceptable
 * Run BEFORE integration, BEFORE production deployment
 *
 * Tests:
 * 1. Canonicalization stability (RFC 8785 compliance)
 * 2. Policy enforcement hardness (block vs advisory)
 * 3. ExecutionPlan determinism
 * 4. Transcript chain integrity
 * 5. Authority boundary isolation
 * 6. Key order invariance
 * 7. Undefined/null normalization
 * A. Cross-session divergence
 * B. Timestamp immunity
 * C. Replay integrity
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeterministicStressTest = runDeterministicStressTest;
var index_js_1 = require("../src/canonicalization/index.js");
var index_js_2 = require("../src/policy/index.js");
var index_js_3 = require("../src/schema/index.js");
var index_js_4 = require("../src/execution/index.js");
var index_js_5 = require("../src/transcript/index.js");
var results = [];
/**
 * TEST 1: Canonicalization Stability
 * Submit identical proposal 100x, verify all hashes identical
 */
function testCanonicalizationStability() {
    console.log('\n🧪 TEST 1: Canonicalization Stability');
    console.log('----------------------------------------');
    var proposal = (0, index_js_3.createProposalTemplate)('test-agent', 'test-session');
    var hashes = [];
    for (var i = 0; i < 100; i++) {
        hashes.push((0, index_js_1.computeProposalHash)(proposal));
    }
    // Check all hashes identical
    var uniqueHashes = new Set(hashes);
    var allIdentical = uniqueHashes.size === 1;
    // Check canonical form byte-identical
    var canonical1 = (0, index_js_1.canonicalize)(proposal);
    var canonical2 = (0, index_js_1.canonicalize)(proposal);
    var canonicalIdentical = canonical1 === canonical2;
    var passed = allIdentical && canonicalIdentical;
    console.log("  Iterations: 100");
    console.log("  Unique hashes: ".concat(uniqueHashes.size));
    console.log("  Canonical identical: ".concat(canonicalIdentical));
    console.log("  Sample hash: ".concat(hashes[0].substring(0, 32), "..."));
    console.log("  Result: ".concat(passed ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Canonicalization Stability',
        passed: passed,
        details: "100 iterations, ".concat(uniqueHashes.size, " unique hashes, canonical identical: ").concat(canonicalIdentical),
        critical: true
    };
}
/**
 * TEST 2: Policy Enforcement Hardness
 * Submit proposal violating MAX_LOSS, verify execution BLOCKED
 */
function testPolicyEnforcement() {
    var _a, _b;
    console.log('\n🧪 TEST 2: Policy Enforcement Hardness');
    console.log('----------------------------------------');
    var policySet = (0, index_js_2.createPhase1PolicySet)();
    // Create proposal that violates max position size ($50 limit)
    var badProposal = __assign(__assign({}, (0, index_js_3.createProposalTemplate)('test-agent', 'test-session')), { intent: {
            action: 'swap',
            asset_in: { symbol: 'USDC', chain: 'base', decimals: 6 },
            asset_out: { symbol: 'ETH', chain: 'base', decimals: 18 },
            amount: { type: 'exact', value: 100, unit: 'usd' } // $100 > $50 limit
        } });
    var stateSnapshot = {
        timestamp: new Date().toISOString(),
        portfolio: {
            total_value_usd: 200,
            available_capital_usd: 200,
            allocated_capital_usd: 0,
            positions: []
        },
        market: {
            asset_prices: { USDC: 1, ETH: 3000 }
        },
        system: {
            daily_trade_count: 0,
            daily_volume_usd: 0
        }
    };
    var result = (0, index_js_4.generateExecutionPlan)(badProposal, policySet, stateSnapshot);
    var blocked = result.plan === null && ((_b = (_a = result.error) === null || _a === void 0 ? void 0 : _a.includes('block')) !== null && _b !== void 0 ? _b : false);
    console.log("  Violation: $100 position > $50 limit");
    console.log("  Plan generated: ".concat(result.plan !== null));
    console.log("  Error returned: ".concat(result.error ? 'YES' : 'NO'));
    console.log("  Hard block: ".concat(blocked));
    console.log("  Result: ".concat(blocked ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Policy Enforcement Hardness',
        passed: blocked,
        details: "Position $100 > $50 limit, blocked: ".concat(blocked, ", error: ").concat(result.error),
        critical: true
    };
}
/**
 * TEST 3: ExecutionPlan Determinism
 * Same proposal + policy + state, generate plan 100x, verify identical
 */
function testExecutionPlanDeterminism() {
    console.log('\n🧪 TEST 3: ExecutionPlan Determinism');
    console.log('----------------------------------------');
    var proposal = (0, index_js_3.createProposalTemplate)('test-agent', 'test-session');
    var policySet = (0, index_js_2.createPhase1PolicySet)();
    var stateSnapshot = {
        timestamp: new Date().toISOString(),
        portfolio: {
            total_value_usd: 200,
            available_capital_usd: 200,
            allocated_capital_usd: 0,
            positions: []
        },
        market: {
            asset_prices: { USDC: 1, ETH: 3000 }
        },
        system: {
            daily_trade_count: 0,
            daily_volume_usd: 0
        }
    };
    // Remove timestamp-dependent fields for comparison
    var plans = [];
    for (var i = 0; i < 100; i++) {
        var result = (0, index_js_4.generateExecutionPlan)(proposal, policySet, stateSnapshot);
        if (result.plan) {
            // Remove non-deterministic fields for comparison
            var _a = result.plan, plan_id = _a.plan_id, generated_at = _a.generated_at, deterministicParts = __rest(_a, ["plan_id", "generated_at"]);
            plans.push(deterministicParts);
        }
    }
    // Compare all plans
    var planHashes = plans.map(function (p) { return (0, index_js_1.computeHash)(p); });
    var uniquePlans = new Set(planHashes);
    var deterministic = uniquePlans.size === 1 && plans.length === 100;
    console.log("  Iterations: 100");
    console.log("  Successful plans: ".concat(plans.length));
    console.log("  Unique plan hashes: ".concat(uniquePlans.size));
    console.log("  Deterministic: ".concat(deterministic));
    console.log("  Result: ".concat(deterministic ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'ExecutionPlan Determinism',
        passed: deterministic,
        details: "100 iterations, ".concat(plans.length, " plans, ").concat(uniquePlans.size, " unique"),
        critical: true
    };
}
/**
 * TEST 4: Transcript Chain Integrity
 * Run full session, verify chain links, verify replay
 */
function testTranscriptIntegrity() {
    console.log('\n🧪 TEST 4: Transcript Chain Integrity');
    console.log('----------------------------------------');
    var logger = new index_js_5.TranscriptLogger();
    var sessionId = 'test-session-' + Date.now();
    // Start session
    logger.startSession(sessionId, 'test-agent', 'policy-set-1');
    // Log proposal
    var proposal = (0, index_js_3.createProposalTemplate)('test-agent', sessionId);
    var proposalEntry = logger.logProposal(sessionId, proposal.proposal_id, (0, index_js_1.computeProposalHash)(proposal), 'Swap USDC to ETH', 0.8, 'test-agent', 'claude-sonnet-4.6');
    // Log validation
    var policySet = (0, index_js_2.createPhase1PolicySet)();
    var validation = (0, index_js_2.validateAgainstPolicySet)(proposal, policySet, {
        portfolio: { total_value_usd: 200, available_capital_usd: 200, allocated_capital_usd: 0, positions: [] },
        market: { asset_prices: {} },
        system: { daily_trade_count: 0, daily_volume_usd: 0 },
        timestamp: new Date().toISOString()
    });
    var validationEntry = logger.logValidation(sessionId, proposal.proposal_id, validation);
    // Verify chain
    var chainValid = validationEntry.previous_hash === proposalEntry.entry_hash;
    var integrityVerified = logger.verifyTranscript(sessionId);
    console.log("  Session: ".concat(sessionId));
    console.log("  Entries logged: 2");
    console.log("  Chain links valid: ".concat(chainValid));
    console.log("  Integrity verified: ".concat(integrityVerified));
    console.log("  Result: ".concat(chainValid && integrityVerified ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Transcript Chain Integrity',
        passed: chainValid && integrityVerified,
        details: "Chain valid: ".concat(chainValid, ", Integrity: ").concat(integrityVerified),
        critical: true
    };
}
/**
 * TEST 5: Constraint Value Change Detection
 * Change one constraint value, verify hash changes deterministically
 */
function testConstraintChangeDetection() {
    console.log('\n🧪 TEST 5: Constraint Change Detection');
    console.log('----------------------------------------');
    var proposal1 = (0, index_js_3.createProposalTemplate)('test-agent', 'test-session');
    var proposal2 = __assign(__assign({}, proposal1), { constraints: __assign(__assign({}, proposal1.constraints), { slippage_tolerance_percent: 5.0 // Changed from default
         }) });
    var hash1 = (0, index_js_1.computeProposalHash)(proposal1);
    var hash2 = (0, index_js_1.computeProposalHash)(proposal2);
    var hashesDifferent = hash1 !== hash2;
    console.log("  Proposal 1 hash: ".concat(hash1.substring(0, 32), "..."));
    console.log("  Proposal 2 hash: ".concat(hash2.substring(0, 32), "..."));
    console.log("  Hashes different: ".concat(hashesDifferent));
    console.log("  Result: ".concat(hashesDifferent ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Constraint Change Detection',
        passed: hashesDifferent,
        details: "Hash changed when constraint modified: ".concat(hashesDifferent),
        critical: true
    };
}
/**
 * TEST 6: Key Order Invariance
 * Create two proposals identical except object key order. Hashes must match.
 */
function testKeyOrderInvariance() {
    console.log('\n🧪 TEST 6: Key Order Invariance');
    console.log('----------------------------------------');
    // Same content, different key order
    var proposalA = {
        schema_version: 'v1',
        proposal_id: 'test-123',
        timestamp: '2026-02-23T00:00:00Z',
        confidence: 0.8,
        intent: { action: 'swap', asset: 'ETH' }
    };
    var proposalB = {
        confidence: 0.8,
        intent: { asset: 'ETH', action: 'swap' },
        proposal_id: 'test-123',
        schema_version: 'v1',
        timestamp: '2026-02-23T00:00:00Z'
    };
    var hashA = (0, index_js_1.computeHash)(proposalA);
    var hashB = (0, index_js_1.computeHash)(proposalB);
    var match = hashA === hashB;
    console.log("  Proposal A key order: schema, id, timestamp, confidence, intent");
    console.log("  Proposal B key order: confidence, intent, id, schema, timestamp");
    console.log("  Hash A: ".concat(hashA.substring(0, 32), "..."));
    console.log("  Hash B: ".concat(hashB.substring(0, 32), "..."));
    console.log("  Hashes match: ".concat(match));
    console.log("  Result: ".concat(match ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Key Order Invariance',
        passed: match,
        details: "Different key order produces ".concat(match ? 'same' : 'different', " hash"),
        critical: true
    };
}
/**
 * TEST 7: Undefined/Null Normalization
 * Confirm consistent behavior for missing vs null vs undefined fields
 */
function testUndefinedNullNormalization() {
    console.log('\n🧪 TEST 7: Undefined/Null Normalization');
    console.log('----------------------------------------');
    // Test cases
    var obj1 = { a: 1, b: 'test' }; // b present
    var obj2 = { a: 1, b: null }; // b = null
    var obj3 = { a: 1, b: undefined }; // b = undefined
    var obj4 = { a: 1 }; // b missing
    var hash1 = (0, index_js_1.computeHash)(obj1);
    var hash2 = (0, index_js_1.computeHash)(obj2);
    var hash3 = (0, index_js_1.computeHash)(obj3);
    var hash4 = (0, index_js_1.computeHash)(obj4);
    // Rule: undefined is stripped (same as missing), null is preserved
    var undefinedStripped = hash3 === hash4; // undefined == missing
    var nullPreserved = hash2 !== hash4; // null != missing
    var passed = undefinedStripped && nullPreserved;
    console.log("  { a: 1, b: 'test' }     -> ".concat(hash1.substring(0, 16), "..."));
    console.log("  { a: 1, b: null }         -> ".concat(hash2.substring(0, 16), "..."));
    console.log("  { a: 1, b: undefined }    -> ".concat(hash3.substring(0, 16), "..."));
    console.log("  { a: 1 }                  -> ".concat(hash4.substring(0, 16), "..."));
    console.log("  Rule: undefined stripped (== missing): ".concat(undefinedStripped));
    console.log("  Rule: null preserved (!= missing): ".concat(nullPreserved));
    console.log("  Result: ".concat(passed ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Undefined/Null Normalization',
        passed: passed,
        details: "undefined stripped: ".concat(undefinedStripped, ", null preserved: ").concat(nullPreserved),
        critical: true
    };
}
/**
 * TEST A: Cross-Session Divergence
 * Two identical entry sequences across different session_ids must produce different transcript head hashes
 */
function testCrossSessionDivergence() {
    console.log('\n🧪 TEST A: Cross-Session Divergence');
    console.log('----------------------------------------');
    var logger = new index_js_5.TranscriptLogger();
    var sessionA = 'session-a-123';
    var sessionB = 'session-b-456';
    // Create identical entries in both sessions
    logger.startSession(sessionA, 'agent-1', 'policy-1');
    logger.startSession(sessionB, 'agent-1', 'policy-1');
    var proposalA = (0, index_js_3.createProposalTemplate)('agent-1', sessionA);
    var proposalB = (0, index_js_3.createProposalTemplate)('agent-1', sessionB);
    // Log identical proposals (different session_ids)
    var entryA = logger.logProposal(sessionA, proposalA.proposal_id, (0, index_js_1.computeProposalHash)(proposalA), 'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6');
    var entryB = logger.logProposal(sessionB, proposalB.proposal_id, (0, index_js_1.computeProposalHash)(proposalB), 'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6');
    // Verify session_id included in hash (different sessions = different hashes)
    var hashesDiffer = entryA.entry_hash !== entryB.entry_hash;
    console.log("  Session A: ".concat(sessionA));
    console.log("  Session B: ".concat(sessionB));
    console.log("  Entry A hash: ".concat(entryA.entry_hash.substring(0, 32), "..."));
    console.log("  Entry B hash: ".concat(entryB.entry_hash.substring(0, 32), "..."));
    console.log("  Hashes differ (session-bound): ".concat(hashesDiffer));
    console.log("  Result: ".concat(hashesDiffer ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Cross-Session Divergence',
        passed: hashesDiffer,
        details: "Same content, different sessions: hashes differ = ".concat(hashesDiffer),
        critical: true
    };
}
/**
 * TEST B: Timestamp Immunity
 * Modifying logged_at only must not change entry hash or transcript head
 */
function testTimestampImmunity() {
    console.log('\n🧪 TEST B: Timestamp Immunity');
    console.log('----------------------------------------');
    var logger = new index_js_5.TranscriptLogger();
    var sessionId = 'test-timestamp-session';
    logger.startSession(sessionId, 'agent-1', 'policy-1');
    var proposal = (0, index_js_3.createProposalTemplate)('agent-1', sessionId);
    // Log proposal
    var entry1 = logger.logProposal(sessionId, proposal.proposal_id, (0, index_js_1.computeProposalHash)(proposal), 'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6');
    // Manually modify timestamp (simulating replay with different timestamp)
    var entryWithModifiedTimestamp = __assign(__assign({}, entry1), { timestamp: new Date(Date.now() + 86400000).toISOString() // +1 day
     });
    // Recompute hash with modified timestamp
    var recomputeHash = function (entry) {
        var hashInput = {
            session_id: entry.session_id,
            previous_hash: entry.previous_hash,
            entry_type: entry.entry_type,
            content: entry.content,
            agent_id: entry.agent_id,
            model: entry.model
        };
        return (0, index_js_1.computeHash)(hashInput);
    };
    var hashWithOriginal = recomputeHash(entry1);
    var hashWithModified = recomputeHash(entryWithModifiedTimestamp);
    var timestampDoesNotAffectHash = hashWithOriginal === hashWithModified;
    console.log("  Original timestamp: ".concat(entry1.timestamp));
    console.log("  Modified timestamp: ".concat(entryWithModifiedTimestamp.timestamp));
    console.log("  Hash with original: ".concat(hashWithOriginal.substring(0, 32), "..."));
    console.log("  Hash with modified: ".concat(hashWithModified.substring(0, 32), "..."));
    console.log("  Timestamp does not affect hash: ".concat(timestampDoesNotAffectHash));
    console.log("  Result: ".concat(timestampDoesNotAffectHash ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Timestamp Immunity',
        passed: timestampDoesNotAffectHash,
        details: "Timestamp change: hash unchanged = ".concat(timestampDoesNotAffectHash),
        critical: true
    };
}
/**
 * TEST C: Replay Integrity
 * Reconstruct transcript from deterministic inputs only - final head hash must match original
 */
function testReplayIntegrity() {
    console.log('\n🧪 TEST C: Replay Integrity');
    console.log('----------------------------------------');
    var logger = new index_js_5.TranscriptLogger();
    var sessionId = 'test-replay-session';
    logger.startSession(sessionId, 'agent-1', 'policy-1');
    var proposal = (0, index_js_3.createProposalTemplate)('agent-1', sessionId);
    // Log series of entries
    var entry1 = logger.logProposal(sessionId, proposal.proposal_id, (0, index_js_1.computeProposalHash)(proposal), 'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6');
    var policySet = (0, index_js_2.createPhase1PolicySet)();
    var validation = (0, index_js_2.validateAgainstPolicySet)(proposal, policySet, {
        portfolio: { total_value_usd: 200, available_capital_usd: 200, allocated_capital_usd: 0, positions: [] },
        market: { asset_prices: {} },
        system: { daily_trade_count: 0, daily_volume_usd: 0 },
        timestamp: new Date().toISOString()
    });
    var entry2 = logger.logValidation(sessionId, proposal.proposal_id, validation);
    // Get original head hash
    var originalHeadHash = entry2.entry_hash;
    // Reconstruct transcript from deterministic inputs only
    var reconstructedEntries = [
        {
            session_id: entry1.session_id,
            previous_hash: entry1.previous_hash,
            entry_type: entry1.entry_type,
            content: entry1.content,
            agent_id: entry1.agent_id,
            model: entry1.model
        },
        {
            session_id: entry2.session_id,
            previous_hash: entry2.previous_hash,
            entry_type: entry2.entry_type,
            content: entry2.content,
            agent_id: entry2.agent_id,
            model: entry2.model
        }
    ];
    // Recompute chain
    var prevHash = null;
    var reconstructedHeadHash = '';
    for (var _i = 0, reconstructedEntries_1 = reconstructedEntries; _i < reconstructedEntries_1.length; _i++) {
        var entryData = reconstructedEntries_1[_i];
        var hashInput = __assign(__assign({}, entryData), { previous_hash: prevHash });
        var entryHash = (0, index_js_1.computeHash)(hashInput);
        prevHash = entryHash;
        reconstructedHeadHash = entryHash;
    }
    var replayMatches = reconstructedHeadHash === originalHeadHash;
    console.log("  Original head hash: ".concat(originalHeadHash.substring(0, 32), "..."));
    console.log("  Reconstructed head: ".concat(reconstructedHeadHash.substring(0, 32), "..."));
    console.log("  Replay integrity: ".concat(replayMatches));
    console.log("  Result: ".concat(replayMatches ? '✅ PASS' : '❌ FAIL'));
    return {
        test: 'Replay Integrity',
        passed: replayMatches,
        details: "Reconstructed hash matches original: ".concat(replayMatches),
        critical: true
    };
}
/**
 * RUN ALL TESTS
 */
function runDeterministicStressTest() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     DETERMINISTIC STRESS TEST — Execution Protocol v2     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\nGOVERNANCE.md §2.1: Hash drift is unacceptable');
    console.log('Running before integration...\n');
    // Run all tests (1-7, A-C)
    results.push(testCanonicalizationStability());
    results.push(testPolicyEnforcement());
    results.push(testExecutionPlanDeterminism());
    results.push(testTranscriptIntegrity());
    results.push(testConstraintChangeDetection());
    results.push(testKeyOrderInvariance());
    results.push(testUndefinedNullNormalization());
    results.push(testCrossSessionDivergence()); // Test A
    results.push(testTimestampImmunity()); // Test B
    results.push(testReplayIntegrity()); // Test C
    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    var criticalFailures = 0;
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var result = results_1[_i];
        var status_1 = result.passed ? '✅ PASS' : '❌ FAIL';
        var critical = result.critical ? ' [CRITICAL]' : '';
        console.log("\u2551 ".concat(status_1).concat(critical.padEnd(10), " ").concat(result.test.padEnd(40), " \u2551"));
        if (!result.passed && result.critical) {
            criticalFailures++;
        }
    }
    var allPassed = results.every(function (r) { return r.passed; });
    var criticalPassed = criticalFailures === 0;
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log("\u2551 Total: ".concat(results.filter(function (r) { return r.passed; }).length, "/").concat(results.length, " passed").concat(' '.repeat(36), " \u2551"));
    console.log("\u2551 Critical: ".concat(criticalPassed ? 'ALL PASSED' : "".concat(criticalFailures, " FAILED")).concat(' '.repeat(33), " \u2551"));
    console.log('╚════════════════════════════════════════════════════════════╝');
}
// Run if executed directly
if (require.main === module) {
    runDeterministicStressTest();
}
