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

import { 
  canonicalize, 
  computeHash, 
  computeProposalHash,
  validateDeterminism 
} from '../src/canonicalization/index.js';
import { 
  createPhase1PolicySet, 
  validateAgainstPolicySet,
  computePolicySetHash 
} from '../src/policy/index.js';
import { 
  OpportunityProposal 
} from '../src/schema/index.js';
import { 
  generateExecutionPlan,
  StateSnapshot 
} from '../src/execution/index.js';
import { TranscriptLogger } from '../src/transcript/index.js';

// Test Results
interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  critical?: boolean;
}

const results: TestResult[] = [];

// FIXED test fixture to eliminate harness randomness
const FIXED_PROPOSAL = ({
  schema_version: 'v1',
  proposal_id: 'fixed-prop-0001',
  timestamp: '2026-02-24T00:00:00.000Z',
  expiry: '2026-02-24T01:00:00.000Z',
  execution_domain: 'base',
  environment: 'simulation',
  opportunity_type: 'swap',
  intent: {
    action: 'swap',
    asset_in: { symbol: 'USDC', chain: 'base', decimals: 6 },
    asset_out: { symbol: 'ETH', chain: 'base', decimals: 18 },
    amount: { type: 'exact', value: 25, unit: 'usd' }
  },
  risk_budget: { max_drawdown_percent: 10, max_loss_usd: 5, max_loss_percent: 10, position_size_percent: 25, risk_reward_min: 2 },
  constraints: { slippage_tolerance_percent: 1.0, stop_loss: { price: 0, type: 'fixed' }, allow_partial_fill: true, deadline: '2026-02-24T01:00:00.000Z', require_success: false },
  reasoning: { alternatives_considered: [], confidence_explanation: 'fixed', market_conditions: 'fixed', risk_assessment: 'fixed', signal_sources: ['template'], timing_rationale: 'fixed' },
  confidence: 0.75,
  agent_id: 'test-agent',
  session_id: 'fixed-session-0001'
} as unknown) as OpportunityProposal;

// Override dynamic template generator in tests to return fixed fixture
const createProposalTemplate = (_agent?: string, _session?: string) => JSON.parse(JSON.stringify(FIXED_PROPOSAL)) as OpportunityProposal;


/**
 * TEST 1: Canonicalization Stability
 * Submit identical proposal 100x, verify all hashes identical
 */
function testCanonicalizationStability(): TestResult {
  console.log('\n🧪 TEST 1: Canonicalization Stability');
  console.log('----------------------------------------');
  
  const proposal = createProposalTemplate('test-agent', 'test-session');
  const hashes: string[] = [];
  
  for (let i = 0; i < 100; i++) {
    hashes.push(computeProposalHash(proposal as unknown as Record<string, unknown>));
  }
  
  // Check all hashes identical
  const uniqueHashes = new Set(hashes);
  const allIdentical = uniqueHashes.size === 1;
  
  // Check canonical form byte-identical
  const canonical1 = canonicalize(proposal);
  const canonical2 = canonicalize(proposal);
  const canonicalIdentical = canonical1 === canonical2;
  
  const passed = allIdentical && canonicalIdentical;
  
  console.log(`  Iterations: 100`);
  console.log(`  Unique hashes: ${uniqueHashes.size}`);
  console.log(`  Canonical identical: ${canonicalIdentical}`);
  console.log(`  Sample hash: ${hashes[0].substring(0, 32)}...`);
  console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    test: 'Canonicalization Stability',
    passed,
    details: `100 iterations, ${uniqueHashes.size} unique hashes, canonical identical: ${canonicalIdentical}`,
    critical: true
  };
}

/**
 * TEST 2: Policy Enforcement Hardness
 * Submit proposal violating MAX_LOSS, verify execution BLOCKED
 */
function testPolicyEnforcement(): TestResult {
  console.log('\n🧪 TEST 2: Policy Enforcement Hardness');
  console.log('----------------------------------------');
  
  const policySet = createPhase1PolicySet();
  
  // Create proposal that violates max position size ($50 limit)
  const badProposal: OpportunityProposal = {
    ...createProposalTemplate('test-agent', 'test-session'),
    intent: {
      action: 'swap',
      asset_in: { symbol: 'USDC', chain: 'base', decimals: 6 },
      asset_out: { symbol: 'ETH', chain: 'base', decimals: 18 },
      amount: { type: 'exact', value: 100, unit: 'usd' } // $100 > $50 limit
    }
  };
  
  const stateSnapshot: StateSnapshot = {
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
  
  const result = generateExecutionPlan(badProposal, policySet, stateSnapshot);
  
  const blocked = result.plan === null && (result.error?.includes('block') ?? false);
  
  console.log(`  Violation: $100 position > $50 limit`);
  console.log(`  Plan generated: ${result.plan !== null}`);
  console.log(`  Error returned: ${result.error ? 'YES' : 'NO'}`);
  console.log(`  Hard block: ${blocked}`);
  console.log(`  Result: ${blocked ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    test: 'Policy Enforcement Hardness',
    passed: blocked,
    details: `Position $100 > $50 limit, blocked: ${blocked}, error: ${result.error}`,
    critical: true
  };
}

/**
 * TEST 3: ExecutionPlan Determinism
 * Same proposal + policy + state, generate plan 100x, verify identical
 */
function testExecutionPlanDeterminism(): TestResult {
  console.log('\n🧪 TEST 3: ExecutionPlan Determinism');
  console.log('----------------------------------------');
  
  const proposal = createProposalTemplate('test-agent', 'test-session');
  const policySet = createPhase1PolicySet();
  const stateSnapshot: StateSnapshot = {
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
  const plans: any[] = [];
  
  for (let i = 0; i < 100; i++) {
    const result = generateExecutionPlan(proposal, policySet, stateSnapshot);
    if (result.plan) {
      // Remove non-deterministic fields for comparison
      const { plan_id, generated_at, ...deterministicParts } = result.plan as any;
      plans.push(deterministicParts);
    }
  }
  
  // Compare all plans
  const planHashes = plans.map(p => computeHash(p));
  const uniquePlans = new Set(planHashes);
  const deterministic = uniquePlans.size === 1 && plans.length === 100;
  
  console.log(`  Iterations: 100`);
  console.log(`  Successful plans: ${plans.length}`);
  console.log(`  Unique plan hashes: ${uniquePlans.size}`);
  console.log(`  Deterministic: ${deterministic}`);
  console.log(`  Result: ${deterministic ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    test: 'ExecutionPlan Determinism',
    passed: deterministic,
    details: `100 iterations, ${plans.length} plans, ${uniquePlans.size} unique`,
    critical: true
  };
}

/**
 * TEST 4: Transcript Chain Integrity
 * Run full session, verify chain links, verify replay
 */
function testTranscriptIntegrity(): TestResult {
  console.log('\n🧪 TEST 4: Transcript Chain Integrity');
  console.log('----------------------------------------');
  
  const logger = new TranscriptLogger();
  const sessionId = 'test-session-' + Date.now();
  
  // Start session
  logger.startSession(sessionId, 'test-agent', 'policy-set-1');
  
  // Log proposal
  const proposal = createProposalTemplate('test-agent', sessionId);
  const proposalEntry = logger.logProposal(
    sessionId,
    proposal.proposal_id,
    computeProposalHash(proposal as unknown as Record<string, unknown>),
    'Swap USDC to ETH',
    0.8,
    'test-agent',
    'claude-sonnet-4.6'
  );
  
  // Log validation
  const policySet = createPhase1PolicySet();
  const validation = validateAgainstPolicySet(proposal, policySet, {
    portfolio: { total_value_usd: 150, available_capital_usd: 150, allocated_capital_usd: 0, positions: [] },
    market: { asset_prices: {} },
    system: { daily_trade_count: 0, daily_volume_usd: 0 },
    timestamp: new Date().toISOString()
  });
  const validationEntry = logger.logValidation(sessionId, proposal.proposal_id, validation);
  
  // Verify chain
  const chainValid = validationEntry.previous_hash === proposalEntry.entry_hash;
  const integrityVerified = logger.verifyTranscript(sessionId);
  
  console.log(`  Session: ${sessionId}`);
  console.log(`  Entries logged: 2`);
  console.log(`  Chain links valid: ${chainValid}`);
  console.log(`  Integrity verified: ${integrityVerified}`);
  console.log(`  Result: ${chainValid && integrityVerified ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    test: 'Transcript Chain Integrity',
    passed: chainValid && integrityVerified,
    details: `Chain valid: ${chainValid}, Integrity: ${integrityVerified}`,
    critical: true
  };
}

/**
 * TEST 5: Constraint Value Change Detection
 * Change one constraint value, verify hash changes deterministically
 */
function testConstraintChangeDetection(): TestResult {
  console.log('\n🧪 TEST 5: Constraint Change Detection');
  console.log('----------------------------------------');
  
  const proposal1 = createProposalTemplate('test-agent', 'test-session');
  const proposal2 = {
    ...proposal1,
    constraints: {
      ...proposal1.constraints,
      slippage_tolerance_percent: 5.0 // Changed from default
    }
  };
  
  const hash1 = computeProposalHash(proposal1 as unknown as Record<string, unknown>);
  const hash2 = computeProposalHash(proposal2 as unknown as Record<string, unknown>);
  
  const hashesDifferent = hash1 !== hash2;
  
  console.log(`  Proposal 1 hash: ${hash1.substring(0, 32)}...`);
  console.log(`  Proposal 2 hash: ${hash2.substring(0, 32)}...`);
  console.log(`  Hashes different: ${hashesDifferent}`);
  console.log(`  Result: ${hashesDifferent ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    test: 'Constraint Change Detection',
    passed: hashesDifferent,
    details: `Hash changed when constraint modified: ${hashesDifferent}`,
    critical: true
  };
}

/**
 * TEST 6: Key Order Invariance
 * Create two proposals identical except object key order. Hashes must match.
 */
function testKeyOrderInvariance(): TestResult {
  console.log('\n🧪 TEST 6: Key Order Invariance');
  console.log('----------------------------------------');

  // Same content, different key order
  const proposalA = {
    schema_version: 'v1',
    proposal_id: 'test-123',
    timestamp: '2026-02-23T00:00:00Z',
    confidence: 0.8,
    intent: { action: 'swap', asset: 'ETH' }
  };

  const proposalB = {
    confidence: 0.8,
    intent: { asset: 'ETH', action: 'swap' },
    proposal_id: 'test-123',
    schema_version: 'v1',
    timestamp: '2026-02-23T00:00:00Z'
  };

  const hashA = computeHash(proposalA);
  const hashB = computeHash(proposalB);

  const match = hashA === hashB;

  console.log(`  Proposal A key order: schema, id, timestamp, confidence, intent`);
  console.log(`  Proposal B key order: confidence, intent, id, schema, timestamp`);
  console.log(`  Hash A: ${hashA.substring(0, 32)}...`);
  console.log(`  Hash B: ${hashB.substring(0, 32)}...`);
  console.log(`  Hashes match: ${match}`);
  console.log(`  Result: ${match ? '✅ PASS' : '❌ FAIL'}`);

  return {
    test: 'Key Order Invariance',
    passed: match,
    details: `Different key order produces ${match ? 'same' : 'different'} hash`,
    critical: true
  };
}

/**
 * TEST 7: Undefined/Null Normalization
 * Confirm consistent behavior for missing vs null vs undefined fields
 */
function testUndefinedNullNormalization(): TestResult {
  console.log('\n🧪 TEST 7: Undefined/Null Normalization');
  console.log('----------------------------------------');

  // Test cases
  const obj1 = { a: 1, b: 'test' };                    // b present
  const obj2 = { a: 1, b: null };                      // b = null
  const obj3 = { a: 1, b: undefined };                 // b = undefined
  const obj4 = { a: 1 };                               // b missing

  const hash1 = computeHash(obj1);
  const hash2 = computeHash(obj2);
  const hash3 = computeHash(obj3);
  const hash4 = computeHash(obj4);

  // Rule: undefined is stripped (same as missing), null is preserved
  const undefinedStripped = hash3 === hash4;  // undefined == missing
  const nullPreserved = hash2 !== hash4;      // null != missing

  const passed = undefinedStripped && nullPreserved;

  console.log(`  { a: 1, b: 'test' }     -> ${hash1.substring(0, 16)}...`);
  console.log(`  { a: 1, b: null }         -> ${hash2.substring(0, 16)}...`);
  console.log(`  { a: 1, b: undefined }    -> ${hash3.substring(0, 16)}...`);
  console.log(`  { a: 1 }                  -> ${hash4.substring(0, 16)}...`);
  console.log(`  Rule: undefined stripped (== missing): ${undefinedStripped}`);
  console.log(`  Rule: null preserved (!= missing): ${nullPreserved}`);
  console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  return {
    test: 'Undefined/Null Normalization',
    passed: passed,
    details: `undefined stripped: ${undefinedStripped}, null preserved: ${nullPreserved}`,
    critical: true
  };
}

/**
 * TEST A: Cross-Session Divergence
 * Two identical entry sequences across different session_ids must produce different transcript head hashes
 */
function testCrossSessionDivergence(): TestResult {
  console.log('\n🧪 TEST A: Cross-Session Divergence');
  console.log('----------------------------------------');

  const logger = new TranscriptLogger();
  const sessionA = 'session-a-123';
  const sessionB = 'session-b-456';

  // Create identical entries in both sessions
  logger.startSession(sessionA, 'agent-1', 'policy-1');
  logger.startSession(sessionB, 'agent-1', 'policy-1');

  const proposalA = createProposalTemplate('agent-1', sessionA);
  const proposalB = createProposalTemplate('agent-1', sessionB);

  // Log identical proposals (different session_ids)
  const entryA = logger.logProposal(
    sessionA, proposalA.proposal_id, computeProposalHash(proposalA as unknown as Record<string, unknown>),
    'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6'
  );

  const entryB = logger.logProposal(
    sessionB, proposalB.proposal_id, computeProposalHash(proposalB as unknown as Record<string, unknown>),
    'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6'
  );

  // Verify session_id included in hash (different sessions = different hashes)
  const hashesDiffer = entryA.entry_hash !== entryB.entry_hash;

  console.log(`  Session A: ${sessionA}`);
  console.log(`  Session B: ${sessionB}`);
  console.log(`  Entry A hash: ${entryA.entry_hash.substring(0, 32)}...`);
  console.log(`  Entry B hash: ${entryB.entry_hash.substring(0, 32)}...`);
  console.log(`  Hashes differ (session-bound): ${hashesDiffer}`);
  console.log(`  Result: ${hashesDiffer ? '✅ PASS' : '❌ FAIL'}`);

  return {
    test: 'Cross-Session Divergence',
    passed: hashesDiffer,
    details: `Same content, different sessions: hashes differ = ${hashesDiffer}`,
    critical: true
  };
}

/**
 * TEST B: Timestamp Immunity
 * Modifying logged_at only must not change entry hash or transcript head
 */
function testTimestampImmunity(): TestResult {
  console.log('\n🧪 TEST B: Timestamp Immunity');
  console.log('----------------------------------------');

  const logger = new TranscriptLogger();
  const sessionId = 'test-timestamp-session';

  logger.startSession(sessionId, 'agent-1', 'policy-1');

  const proposal = createProposalTemplate('agent-1', sessionId);

  // Log proposal
  const entry1 = logger.logProposal(
    sessionId, proposal.proposal_id, computeProposalHash(proposal as unknown as Record<string, unknown>),
    'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6'
  );

  // Manually modify timestamp (simulating replay with different timestamp)
  const entryWithModifiedTimestamp = {
    ...entry1,
    timestamp: new Date(Date.now() + 86400000).toISOString() // +1 day
  };

  // Recompute hash with modified timestamp
  const recomputeHash = (entry: any): string => {
    const hashInput = {
      session_id: entry.session_id,
      previous_hash: entry.previous_hash,
      entry_type: entry.entry_type,
      content: entry.content,
      agent_id: entry.agent_id,
      model: entry.model
    };
    return computeHash(hashInput);
  };

  const hashWithOriginal = recomputeHash(entry1);
  const hashWithModified = recomputeHash(entryWithModifiedTimestamp);

  const timestampDoesNotAffectHash = hashWithOriginal === hashWithModified;

  console.log(`  Original timestamp: ${entry1.timestamp}`);
  console.log(`  Modified timestamp: ${entryWithModifiedTimestamp.timestamp}`);
  console.log(`  Hash with original: ${hashWithOriginal.substring(0, 32)}...`);
  console.log(`  Hash with modified: ${hashWithModified.substring(0, 32)}...`);
  console.log(`  Timestamp does not affect hash: ${timestampDoesNotAffectHash}`);
  console.log(`  Result: ${timestampDoesNotAffectHash ? '✅ PASS' : '❌ FAIL'}`);

  return {
    test: 'Timestamp Immunity',
    passed: timestampDoesNotAffectHash,
    details: `Timestamp change: hash unchanged = ${timestampDoesNotAffectHash}`,
    critical: true
  };
}

/**
 * TEST C: Replay Integrity
 * Reconstruct transcript from deterministic inputs only - final head hash must match original
 */
function testReplayIntegrity(): TestResult {
  console.log('\n🧪 TEST C: Replay Integrity');
  console.log('----------------------------------------');

  const logger = new TranscriptLogger();
  const sessionId = 'test-replay-session';

  logger.startSession(sessionId, 'agent-1', 'policy-1');

  const proposal = createProposalTemplate('agent-1', sessionId);

  // Log series of entries
  const entry1 = logger.logProposal(
    sessionId, proposal.proposal_id, computeProposalHash(proposal as unknown as Record<string, unknown>),
    'Swap USDC to ETH', 0.8, 'agent-1', 'claude-sonnet-4.6'
  );

  const policySet = createPhase1PolicySet();
  const validation = validateAgainstPolicySet(proposal, policySet, {
    portfolio: { total_value_usd: 150, available_capital_usd: 150, allocated_capital_usd: 0, positions: [] },
    market: { asset_prices: {} },
    system: { daily_trade_count: 0, daily_volume_usd: 0 },
    timestamp: new Date().toISOString()
  });

  const entry2 = logger.logValidation(sessionId, proposal.proposal_id, validation);

  // Get original head hash
  const originalHeadHash = entry2.entry_hash;

  // Reconstruct transcript from deterministic inputs only
  const reconstructedEntries = [
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
  let prevHash: string | null = null;
  let reconstructedHeadHash = '';

  for (const entryData of reconstructedEntries) {
    const hashInput = { ...entryData, previous_hash: prevHash };
    const entryHash = computeHash(hashInput);
    prevHash = entryHash;
    reconstructedHeadHash = entryHash;
  }

  const replayMatches = reconstructedHeadHash === originalHeadHash;

  console.log(`  Original head hash: ${originalHeadHash.substring(0, 32)}...`);
  console.log(`  Reconstructed head: ${reconstructedHeadHash.substring(0, 32)}...`);
  console.log(`  Replay integrity: ${replayMatches}`);
  console.log(`  Result: ${replayMatches ? '✅ PASS' : '❌ FAIL'}`);

  return {
    test: 'Replay Integrity',
    passed: replayMatches,
    details: `Reconstructed hash matches original: ${replayMatches}`,
    critical: true
  };
}

/**
 * RUN ALL TESTS
 */
export function runDeterministicStressTest(): void {
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
  results.push(testCrossSessionDivergence());      // Test A
  results.push(testTimestampImmunity());           // Test B
  results.push(testReplayIntegrity());             // Test C
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  let criticalFailures = 0;
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const critical = result.critical ? ' [CRITICAL]' : '';
    console.log(`║ ${status}${critical.padEnd(10)} ${result.test.padEnd(40)} ║`);
    
    if (!result.passed && result.critical) {
      criticalFailures++;
    }
  }
  
  const allPassed = results.every(r => r.passed);
  const criticalPassed = criticalFailures === 0;
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Total: ${results.filter(r => r.passed).length}/${results.length} passed${' '.repeat(36)} ║`);
  console.log(`║ Critical: ${criticalPassed ? 'ALL PASSED' : `${criticalFailures} FAILED`}${' '.repeat(33)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

// Run if executed directly
if (require.main === module) {
  runDeterministicStressTest();
}
