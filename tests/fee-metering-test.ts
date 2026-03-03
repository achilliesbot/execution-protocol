/**
 * Fee Metering Tests — Execution Protocol v2
 * 
 * Pure function tests for execution weight metering.
 * Dry-run mode only. No billing logic.
 */

import {
  countExecutionSteps,
  calculateComplexity,
  estimateGas,
  countComputeUnits,
  countIOOperations,
  countPolicyChecks,
  calculateMetrics,
  calculateFee,
  calculateBatchFees,
  compareFees,
  getFeeSummary,
  DEFAULT_FEE_CONFIG,
  VerifierTranscriptSession,
  VerifierTranscriptEntry
} from '../src/fees';

// Test utilities
function createEntry(type: string, content: Record<string, unknown> = {}): VerifierTranscriptEntry {
  return {
    entry_hash: `hash-${type}-${Date.now()}`,
    previous_hash: null,
    session_id: 'test',
    entry_type: type,
    content,
    agent_id: 'test-agent'
  };
}

function createBasicSession(): VerifierTranscriptSession {
  return {
    session_id: 'test-session',
    entries: [
      createEntry('proposal_received'),
      createEntry('validation_complete'),
      createEntry('plan_generated'),
      createEntry('execution_confirmed', { gas_used: 150000 })
    ]
  };
}

function createComplexSession(): VerifierTranscriptSession {
  return {
    session_id: 'complex-session',
    entries: [
      createEntry('proposal_received', { large: 'x'.repeat(5000) }),
      createEntry('validation_complete'),
      createEntry('plan_generated', { steps: Array(10).fill({}) }),
      createEntry('execution_attempted'),
      createEntry('execution_confirmed', { gas_used: 250000 })
    ]
  };
}

// Test 1: Count execution steps
function testCountExecutionSteps(): boolean {
  const session = createBasicSession();
  const steps = countExecutionSteps(session);
  return steps === 4; // All 4 entries are step types
}

// Test 2: Empty session has zero steps
function testEmptySessionSteps(): boolean {
  const session: VerifierTranscriptSession = { session_id: 'empty', entries: [] };
  return countExecutionSteps(session) === 0;
}

// Test 3: Calculate complexity
function testCalculateComplexity(): boolean {
  const basic = createBasicSession();
  const complex = createComplexSession();
  
  const basicComplexity = calculateComplexity(basic);
  const complexComplexity = calculateComplexity(complex);
  
  return basicComplexity > 0 && complexComplexity > basicComplexity;
}

// Test 4: Estimate gas
function testEstimateGas(): boolean {
  const session = createBasicSession();
  const gas = estimateGas(session);
  
  // Base (21000) + validation (5000) + plan (15000) + execution (150000)
  return gas >= 191000;
}

// Test 5: Count compute units
function testCountComputeUnits(): boolean {
  const session = createBasicSession();
  const units = countComputeUnits(session);
  
  // proposal (100) + validation (500) + plan (1000) + execution (300)
  return units === 1900;
}

// Test 6: Count I/O operations
function testCountIOOperations(): boolean {
  const basic = createBasicSession();
  const complex = createComplexSession();
  
  const basicIO = countIOOperations(basic);
  const complexIO = countIOOperations(complex);
  
  return basicIO > 0 && complexIO >= basicIO;
}

// Test 7: Count policy checks
function testCountPolicyChecks(): boolean {
  const session = createBasicSession();
  const checks = countPolicyChecks(session);
  
  // 1 validation entry * 4 checks per validation
  return checks === 4;
}

// Test 8: Calculate metrics
function testCalculateMetrics(): boolean {
  const session = createBasicSession();
  const metrics = calculateMetrics(session);
  
  return (
    metrics.session_id === 'test-session' &&
    metrics.step_count === 4 &&
    metrics.complexity_score > 0 &&
    metrics.estimated_gas > 0 &&
    metrics.compute_units > 0 &&
    metrics.io_operations > 0 &&
    metrics.policy_checks === 4
  );
}

// Test 9: Calculate fee (basic)
function testCalculateFeeBasic(): boolean {
  const session = createBasicSession();
  const fee = calculateFee(session, DEFAULT_FEE_CONFIG, 'EXEC');
  
  return (
    fee.base_fee === 100 &&
    fee.total > fee.base_fee &&
    fee.currency === 'EXEC' &&
    fee.dry_run === true &&
    fee.breakdown.base === 100
  );
}

// Test 10: Calculate fee (complex has higher cost)
function testCalculateFeeComplexHigher(): boolean {
  const basic = createBasicSession();
  const complex = createComplexSession();
  
  const basicFee = calculateFee(basic);
  const complexFee = calculateFee(complex);
  
  return complexFee.total > basicFee.total;
}

// Test 11: Complexity multiplier applied
function testComplexityMultiplier(): boolean {
  const config = { ...DEFAULT_FEE_CONFIG, complexity_threshold: 1 }; // Low threshold
  const session = createBasicSession();
  
  const fee = calculateFee(session, config);
  
  return fee.complexity_multiplier === config.complexity_multiplier;
}

// Test 12: Calculate batch fees
function testCalculateBatchFees(): boolean {
  const sessions = [createBasicSession(), createBasicSession()];
  const batch = calculateBatchFees(sessions);
  
  return (
    batch.estimates.length === 2 &&
    batch.total === batch.estimates[0].total + batch.estimates[1].total
  );
}

// Test 13: Compare fees
function testCompareFees(): boolean {
  const basic = createBasicSession();
  const complex = createComplexSession();
  
  const basicFee = calculateFee(basic);
  const complexFee = calculateFee(complex);
  
  return compareFees(basicFee, complexFee) < 0;
}

// Test 14: Fee summary generation
function testGetFeeSummary(): boolean {
  const session = createBasicSession();
  const fee = calculateFee(session);
  const summary = getFeeSummary(fee);
  
  return (
    summary.includes('Fee Estimate') &&
    summary.includes('DRY RUN') &&
    summary.includes(String(fee.total))
  );
}

// Test 15: Different currencies
function testDifferentCurrencies(): boolean {
  const session = createBasicSession();
  
  const execFee = calculateFee(session, DEFAULT_FEE_CONFIG, 'EXEC');
  const usdcFee = calculateFee(session, DEFAULT_FEE_CONFIG, 'USDC');
  const ethFee = calculateFee(session, DEFAULT_FEE_CONFIG, 'ETH');
  
  return (
    execFee.currency === 'EXEC' &&
    usdcFee.currency === 'USDC' &&
    ethFee.currency === 'ETH'
  );
}

// Test 16: Zero session has zero fee
function testZeroSessionFee(): boolean {
  const session: VerifierTranscriptSession = { session_id: 'empty', entries: [] };
  const fee = calculateFee(session);
  
  return fee.total === fee.base_fee; // Only base fee, no execution costs
}

// Run all tests
export function runFeeTests(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        FEE METERING TESTS — Execution Protocol v2          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const tests = [
    { name: 'Count execution steps', fn: testCountExecutionSteps },
    { name: 'Empty session has zero steps', fn: testEmptySessionSteps },
    { name: 'Calculate complexity', fn: testCalculateComplexity },
    { name: 'Estimate gas', fn: testEstimateGas },
    { name: 'Count compute units', fn: testCountComputeUnits },
    { name: 'Count I/O operations', fn: testCountIOOperations },
    { name: 'Count policy checks', fn: testCountPolicyChecks },
    { name: 'Calculate metrics', fn: testCalculateMetrics },
    { name: 'Calculate fee (basic)', fn: testCalculateFeeBasic },
    { name: 'Calculate fee (complex higher)', fn: testCalculateFeeComplexHigher },
    { name: 'Complexity multiplier applied', fn: testComplexityMultiplier },
    { name: 'Calculate batch fees', fn: testCalculateBatchFees },
    { name: 'Compare fees', fn: testCompareFees },
    { name: 'Fee summary generation', fn: testGetFeeSummary },
    { name: 'Different currencies', fn: testDifferentCurrencies },
    { name: 'Zero session has base fee only', fn: testZeroSessionFee }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = test.fn();
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name} — returned false`);
        failed++;
      }
    } catch (error) {
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
  runFeeTests();
}
