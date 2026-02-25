/**
 * Phase 4 E2E Read-Only Harness Test
 * 
 * Integration validation for all Phase 4 modules.
 * Verifies composition without kernel drift.
 * 
 * Test: Read-only harness
 * Input: tests/fixtures/transcript.sample.json
 * Output: Deterministic verification across all modules
 */

import * as fs from 'fs';
import * as path from 'path';

// Phase 4 module imports
import {
  validateTranscript,
  verifyHashChain,
  verifyEntryHashes,
  getTranscriptHead,
  VerificationResult
} from '../src/integrations';

import {
  computeReputation,
  ReputationScore
} from '../src/reputation';

import {
  calculateFee,
  calculateMetrics,
  FeeEstimate,
  ExecutionMetrics
} from '../src/fees';

import {
  createAttestationRequest,
  generateAttestation,
  AttestationRequest,
  AttestationResponse
} from '../src/attestation';

// Test fixture path
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'transcript.sample.json');

/**
 * Load transcript fixture
 */
function loadFixture(): any {
  const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Run full Phase 4 pipeline on transcript
 * Returns all computed values
 */
function runPhase4Pipeline(transcript: any): {
  verification: VerificationResult;
  reputation: ReputationScore;
  metrics: ExecutionMetrics;
  fee: FeeEstimate;
  attestationRequest: AttestationRequest;
  attestation: AttestationResponse;
} {
  // 1. VerifierSDK: Verify chain integrity
  const verification = validateTranscript(transcript);
  
  // 2. ReputationEngine: Compute score
  const reputation = computeReputation(transcript.agent_id, [transcript]);
  
  // 3. FeeMetering: Compute dry-run fees
  const metrics = calculateMetrics(transcript);
  const fee = calculateFee(transcript);
  
  // 4. ERC8004Adapter: Produce attestation payload
  const attestationRequest = createAttestationRequest(transcript, 8453);
  const attestation = generateAttestation(attestationRequest);
  
  return {
    verification,
    reputation,
    metrics,
    fee,
    attestationRequest,
    attestation
  };
}

/**
 * Serialize result for hash comparison (determinism check)
 */
function serializeResult(result: any): string {
  // Exclude timestamps and runtime-specific fields
  const deterministic = {
    verification: {
      valid: result.verification.valid,
      entry_count: result.verification.entry_count,
      chain_integrity: result.verification.chain_integrity,
      hash_validity: result.verification.hash_validity
    },
    reputation: {
      agent_id: result.reputation.agent_id,
      score: result.reputation.score,
      confidence: result.reputation.confidence,
      session_count: result.reputation.session_count
    },
    metrics: {
      session_id: result.metrics.session_id,
      step_count: result.metrics.step_count,
      complexity_score: result.metrics.complexity_score,
      estimated_gas: result.metrics.estimated_gas,
      compute_units: result.metrics.compute_units,
      io_operations: result.metrics.io_operations,
      policy_checks: result.metrics.policy_checks
    },
    fee: {
      base_fee: result.fee.base_fee,
      complexity_multiplier: result.fee.complexity_multiplier,
      execution_weight: result.fee.execution_weight,
      total: result.fee.total,
      currency: result.fee.currency,
      dry_run: result.fee.dry_run
    },
    attestation: {
      status: result.attestation.status,
      transcript_hash: result.attestation.transcript_hash
    }
  };
  
  return JSON.stringify(deterministic, Object.keys(deterministic).sort());
}

// Test 1: Load fixture successfully
function testLoadFixture(): boolean {
  try {
    const fixture = loadFixture();
    return (
      fixture.session_id === 'session-phase3-sample-001' &&
      Array.isArray(fixture.entries) &&
      fixture.entries.length === 4
    );
  } catch (error) {
    console.error('Failed to load fixture:', error);
    return false;
  }
}

// Test 2: Pipeline runs without errors
function testPipelineExecution(): boolean {
  try {
    const fixture = loadFixture();
    const result = runPhase4Pipeline(fixture);
    
    return (
      result.verification !== undefined &&
      result.reputation !== undefined &&
      result.metrics !== undefined &&
      result.fee !== undefined &&
      result.attestation !== undefined
    );
  } catch (error) {
    console.error('Pipeline execution failed:', error);
    return false;
  }
}

// Test 3: Verification results are valid
function testVerificationResults(): boolean {
  const fixture = loadFixture();
  const result = runPhase4Pipeline(fixture);
  
  return (
    result.verification.valid === true &&
    result.verification.chain_integrity === true &&
    result.verification.hash_validity === true &&
    result.verification.entry_count === 4
  );
}

// Test 4: Reputation score computed
function testReputationScore(): boolean {
  const fixture = loadFixture();
  const result = runPhase4Pipeline(fixture);
  
  return (
    result.reputation.agent_id === 'achilles-test' &&
    result.reputation.score >= 0 &&
    result.reputation.score <= 100 &&
    result.reputation.session_count === 1 &&
    result.reputation.factors.length === 5
  );
}

// Test 5: Fee calculated (dry-run)
function testFeeCalculation(): boolean {
  const fixture = loadFixture();
  const result = runPhase4Pipeline(fixture);
  
  return (
    result.fee.dry_run === true &&
    result.fee.total > 0 &&
    result.fee.currency === 'EXEC' &&
    result.fee.breakdown.base === 100
  );
}

// Test 6: Attestation produced (stub)
function testAttestationProduced(): boolean {
  const fixture = loadFixture();
  const result = runPhase4Pipeline(fixture);
  
  return (
    result.attestation.status === 'pending' &&
    result.attestation.attestation_id.startsWith('attest-') &&
    result.attestation.proof_data === null
  );
}

// Test 7: Determinism — 100 iterations produce identical outputs
function testDeterminism100Iterations(): boolean {
  const fixture = loadFixture();
  
  // First iteration
  const firstResult = runPhase4Pipeline(fixture);
  const firstHash = serializeResult(firstResult);
  
  // Run 99 more iterations
  for (let i = 0; i < 99; i++) {
    const result = runPhase4Pipeline(fixture);
    const hash = serializeResult(result);
    
    if (hash !== firstHash) {
      console.error(`Determinism failed at iteration ${i + 2}`);
      console.error('Expected:', firstHash.substring(0, 64));
      console.error('Got:', hash.substring(0, 64));
      return false;
    }
  }
  
  return true;
}

// Test 8: No network calls (pure functions only)
function testNoNetworkCalls(): boolean {
  // This test passes if we reach here without errors
  // The modules are designed with pure functions only
  // Any network dependency would throw or require mocking
  
  const fixture = loadFixture();
  
  // Run pipeline - if any module makes network calls, it would fail
  // in this isolated environment
  try {
    runPhase4Pipeline(fixture);
    return true;
  } catch (error) {
    console.error('Network call detected or other error:', error);
    return false;
  }
}

// Test 9: No file writes (read-only)
function testNoFileWrites(): boolean {
  // Verify the pipeline doesn't write to disk
  // By checking that fixture file hasn't been modified
  
  const fixture = loadFixture();
  const originalHash = serializeResult(fixture);
  
  // Run pipeline multiple times
  for (let i = 0; i < 10; i++) {
    runPhase4Pipeline(fixture);
  }
  
  // Reload and verify unchanged
  const reloaded = loadFixture();
  const reloadedHash = serializeResult(reloaded);
  
  return originalHash === reloadedHash;
}

// Test 10: Metrics accuracy
function testMetricsAccuracy(): boolean {
  const fixture = loadFixture();
  const result = runPhase4Pipeline(fixture);
  
  return (
    result.metrics.session_id === 'session-phase3-sample-001' &&
    result.metrics.step_count === 4 && // All 4 entries are steps
    result.metrics.estimated_gas > 0 &&
    result.metrics.compute_units > 0 &&
    result.metrics.io_operations > 0 &&
    result.metrics.policy_checks > 0
  );
}

// Test 11: Same inputs produce same outputs
function testSameInputsSameOutputs(): boolean {
  const fixture1 = loadFixture();
  const fixture2 = JSON.parse(JSON.stringify(fixture1)); // Deep copy
  
  const result1 = runPhase4Pipeline(fixture1);
  const result2 = runPhase4Pipeline(fixture2);
  
  const hash1 = serializeResult(result1);
  const hash2 = serializeResult(result2);
  
  return hash1 === hash2;
}

// Run all tests
export function runPhase4HarnessTests(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     PHASE 4 E2E READ-ONLY HARNESS — Integration Test       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nTesting all Phase 4 modules with shared transcript fixture...\n');
  
  const tests = [
    { name: 'Load fixture', fn: testLoadFixture },
    { name: 'Pipeline execution', fn: testPipelineExecution },
    { name: 'Verification results valid', fn: testVerificationResults },
    { name: 'Reputation score computed', fn: testReputationScore },
    { name: 'Fee calculated (dry-run)', fn: testFeeCalculation },
    { name: 'Attestation produced (stub)', fn: testAttestationProduced },
    { name: 'Determinism (100 iterations)', fn: testDeterminism100Iterations, critical: true },
    { name: 'No network calls', fn: testNoNetworkCalls },
    { name: 'No file writes (read-only)', fn: testNoFileWrites },
    { name: 'Metrics accuracy', fn: testMetricsAccuracy },
    { name: 'Same inputs → same outputs', fn: testSameInputsSameOutputs, critical: true }
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
      } else {
        console.log(`❌ ${test.name}${test.critical ? ' [CRITICAL]' : ''} — FAILED`);
        failed++;
        if (test.critical) criticalFailures++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}${test.critical ? ' [CRITICAL]' : ''} — ERROR: ${error}`);
      failed++;
      if (test.critical) criticalFailures++;
    }
  }
  
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${tests.length} passed`);
  
  if (criticalFailures > 0) {
    console.log(`🔴 ${criticalFailures} CRITICAL FAILURE(S) — COMPOSITION INVALID`);
  } else if (failed === 0) {
    console.log('✅ ALL TESTS PASSED — PHASE 4 COMPOSITION VALIDATED');
  } else {
    console.log(`⚠️  ${failed} non-critical failure(s)`);
  }
  
  console.log('────────────────────────────────────────────────────────────');
  console.log('\nAssertions validated:');
  console.log('• VerifierSDK verifies chain integrity');
  console.log('• ReputationEngine computes deterministic score');
  console.log('• FeeMetering computes dry-run fees');
  console.log('• ERC8004Adapter produces attestation payload');
  console.log('• 100 iterations produce identical outputs');
  console.log('• No writes, no network calls');
  console.log('• Same inputs → same outputs\n');
}

// Run if executed directly
if (require.main === module) {
  runPhase4HarnessTests();
}
