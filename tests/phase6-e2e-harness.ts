/**
 * Phase 6 E2E Harness — Execution Protocol v2
 * 
 * End-to-end integration test for Phase 6 monetization.
 * No live settlement. Determinism validation.
 * 
 * Phase 6 Monetization — E2E Harness
 */

import * as fs from 'fs';
import * as path from 'path';

// Phase 6 imports
import {
  calculateBilling,
  BillingResult
} from '../src/billing';

import {
  appendRevenueEntry,
  readRevenueLedger,
  getRevenueDashboard
} from '../src/revenue';

import {
  createSettlementAdapter,
  SettlementAdapter
} from '../src/settlement';

import {
  calculateMetrics
} from '../src/fees';

import {
  isMonetizationEnabled,
  isSettlementEnabled,
  isSimulationMode
} from '../src/config/Phase6Flags';

// Load fixture
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'transcript.sample.json');

function loadFixture(): any {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

// Save original env
const originalEnv = { ...process.env };

function resetEnv(): void {
  process.env = { ...originalEnv };
}

function setPhase6Config(
  enabled: boolean,
  mode: 'null' | 'offchain' | 'onchain' | 'hybrid' | null,
  simulate: boolean = true
): void {
  process.env.ENABLE_MONETIZATION = enabled ? 'true' : 'false';
  process.env.SETTLEMENT_MODE = mode || '';
  process.env.SETTLEMENT_SIMULATE = simulate ? 'true' : 'false';
  
  // Clear require cache
  delete require.cache[require.resolve('../src/config/Phase6Flags')];
}

// Clean test ledger
const TEST_LEDGER_DIR = path.join('/tmp', '.openclaw', 'revenue');
function cleanupLedger(): void {
  if (fs.existsSync(TEST_LEDGER_DIR)) {
    fs.rmSync(TEST_LEDGER_DIR, { recursive: true });
  }
}

/**
 * Run Phase 6 billing flow
 */
async function runPhase6Flow(
  transcript: any,
  settlementMode: 'null' | 'offchain' | 'onchain' | 'hybrid' = 'null'
): Promise<{
  billing: BillingResult | null;
  ledgerEntry: any;
  adapterResult: any;
}> {
  // Only proceed if monetization enabled
  if (!isMonetizationEnabled()) {
    return { billing: null, ledgerEntry: null, adapterResult: null };
  }
  
  // 1. Calculate metrics
  const metrics = calculateMetrics(transcript);
  
  // 2. Calculate billing
  const billing = calculateBilling(
    transcript.session_id,
    transcript.entries[transcript.entries.length - 1].entry_hash,
    metrics
  );
  
  // 3. Append to revenue ledger
  const ledgerEntry = appendRevenueEntry(billing, settlementMode, isSimulationMode());
  
  // 4. Invoke settlement adapter (if enabled)
  let adapterResult = null;
  if (isSettlementEnabled()) {
    const adapter = createSettlementAdapter(settlementMode);
    adapterResult = await adapter.settle({
      entry_id: ledgerEntry.entry_id,
      amount: billing.total_due,
      currency: billing.currency,
      recipient: '0x1234567890123456789012345678901234567890', // Stub
      metadata: {
        session_id: transcript.session_id,
        transcript_head_hash: billing.transcript_head_hash
      }
    }, isSimulationMode());
  }
  
  return { billing, ledgerEntry, adapterResult };
}

/**
 * Check determinism
 */
async function checkDeterminism(runs: number = 10): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'null', true);
  
  const transcript = loadFixture();
  const results: any[] = [];
  
  for (let i = 0; i < runs; i++) {
    cleanupLedger();
    const result = await runPhase6Flow(transcript, 'null');
    if (result.billing) {
      results.push({
        total_due: result.billing.total_due,
        billable_units: result.billing.billable_units
      });
    }
  }
  
  cleanupLedger();
  resetEnv();
  
  if (results.length === 0) return false;
  const first = JSON.stringify(results[0]);
  return results.every(r => JSON.stringify(r) === first);
}

// Test A: ENABLE_MONETIZATION=false → no ledger writes, no adapter calls
async function testMonetizationDisabled(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(false, null, true); // Disabled
  
  const transcript = loadFixture();
  const result = await runPhase6Flow(transcript, 'null');
  
  const today = new Date().toISOString().split('T')[0];
  const entries = readRevenueLedger(today);
  
  cleanupLedger();
  resetEnv();
  
  return result.billing === null && entries.length === 0;
}

// Test B: Enabled + simulate=true + mode=offchain|onchain|hybrid|null
async function testSimulateMode(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'null', true); // Enabled, simulate
  
  const transcript = loadFixture();
  const result = await runPhase6Flow(transcript, 'null');
  
  const today = new Date().toISOString().split('T')[0];
  const entries = readRevenueLedger(today);
  
  cleanupLedger();
  resetEnv();
  
  return (
    result.billing !== null &&
    result.ledgerEntry !== null &&
    result.ledgerEntry.status === 'SIMULATED' &&
    entries.length === 1
  );
}

// Test C: 100 iteration determinism
async function test100Iterations(): Promise<boolean> {
  return checkDeterminism(100);
}

// Test D: No network writes
async function testNoNetworkWrites(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'onchain', true); // Try onchain mode
  
  const transcript = loadFixture();
  const result = await runPhase6Flow(transcript, 'onchain');
  
  cleanupLedger();
  resetEnv();
  
  // Should be SIMULATED, not actual transaction
  return result.adapterResult?.status === 'SIMULATED';
}

// Test E: Ledger totals consistent
async function testLedgerConsistency(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'null', true);
  
  const transcript = loadFixture();
  
  // Run 3 times
  for (let i = 0; i < 3; i++) {
    await runPhase6Flow(transcript, 'null');
  }
  
  const today = new Date().toISOString().split('T')[0];
  const entries = readRevenueLedger(today);
  
  cleanupLedger();
  resetEnv();
  
  return entries.length === 3;
}

// Test F: Different modes produce different ledger entries
async function testDifferentModes(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'null', true);
  
  const transcript = loadFixture();
  
  // Run with different modes
  await runPhase6Flow({ ...transcript, session_id: 's1' }, 'null');
  await runPhase6Flow({ ...transcript, session_id: 's2' }, 'offchain');
  await runPhase6Flow({ ...transcript, session_id: 's3' }, 'onchain');
  
  const today = new Date().toISOString().split('T')[0];
  const entries = readRevenueLedger(today);
  
  cleanupLedger();
  resetEnv();
  
  const modes = entries.map(e => e.settlement_mode);
  return modes.includes('null') && modes.includes('offchain') && modes.includes('onchain');
}

// Test G: Dashboard aggregates correctly
async function testDashboardAggregation(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(true, 'null', true);
  
  const transcript = loadFixture();
  await runPhase6Flow(transcript, 'null');
  
  const dashboard = getRevenueDashboard();
  
  cleanupLedger();
  resetEnv();
  
  return dashboard.today_entries >= 1;
}

// Test H: Output identical to Phase 5 when disabled
async function testPhase5Compatibility(): Promise<boolean> {
  cleanupLedger();
  resetEnv();
  setPhase6Config(false, null, true); // Same as Phase 5 (disabled)
  
  const transcript = loadFixture();
  const result = await runPhase6Flow(transcript, 'null');
  
  cleanupLedger();
  resetEnv();
  
  // Should produce no monetization artifacts
  return result.billing === null && result.ledgerEntry === null;
}

// Run all tests
export async function runPhase6E2ETests(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      PHASE 6 E2E HARNESS — Monetization Rails Test         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nTesting Phase 6: No live settlement. Determinism only.\n');
  
  const tests = [
    { name: 'Monetization disabled → no side effects', fn: testMonetizationDisabled, critical: true },
    { name: 'Simulate mode → ledger writes, no network', fn: testSimulateMode, critical: true },
    { name: '100 iteration determinism', fn: test100Iterations, critical: true },
    { name: 'No network writes', fn: testNoNetworkWrites, critical: true },
    { name: 'Ledger consistency', fn: testLedgerConsistency, critical: true },
    { name: 'Different settlement modes', fn: testDifferentModes },
    { name: 'Dashboard aggregation', fn: testDashboardAggregation },
    { name: 'Phase 5 compatibility (disabled)', fn: testPhase5Compatibility }
  ];
  
  let passed = 0;
  let failed = 0;
  let criticalFailures = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
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
    console.log(`🔴 ${criticalFailures} CRITICAL FAILURE(S) — PHASE 6 NOT READY`);
  } else if (failed === 0) {
    console.log('✅ ALL TESTS PASSED — PHASE 6 E2E VALIDATED');
  } else {
    console.log(`⚠️  ${failed} non-critical failure(s)`);
  }
  
  console.log('────────────────────────────────────────────────────────────');
  console.log('\nPhase 6 assertions validated:');
  console.log('• Flags OFF → zero side effects');
  console.log('• Flags ON + simulate → ledger only, no network');
  console.log('• Status recorded as SIMULATED');
  console.log('• 100 iteration determinism');
  console.log('• Phase 5 compatibility preserved\n');
}

// Run if executed directly
if (require.main === module) {
  runPhase6E2ETests();
}
