/**
 * Verifier SDK Tests — Execution Protocol v2
 * 
 * Pure function tests for transcript validation.
 * No network calls. No external dependencies.
 */

import {
  validateTranscript,
  verifyHashChain,
  verifyEntryHashes,
  computeEntryHash,
  getTranscriptHead,
  verifyTranscriptHead,
  VerifierTranscriptEntry,
  VerifierTranscriptSession
} from '../src/integrations';

// Test utilities
function createTestEntry(
  index: number,
  previousHash: string | null,
  sessionId: string = 'test-session'
): VerifierTranscriptEntry {
  return {
    entry_hash: '', // Computed below
    previous_hash: previousHash,
    session_id: sessionId,
    entry_type: 'test_entry',
    content: { index, data: `entry-${index}` },
    agent_id: 'test-agent',
    model: 'test-model'
  };
}

function computeAndSetHash(entry: VerifierTranscriptEntry): void {
  entry.entry_hash = computeEntryHash(entry);
}

function createValidSession(entryCount: number = 3): VerifierTranscriptSession {
  const entries: VerifierTranscriptEntry[] = [];
  let previousHash: string | null = null;
  
  for (let i = 0; i < entryCount; i++) {
    const entry = createTestEntry(i, previousHash);
    computeAndSetHash(entry);
    entries.push(entry);
    previousHash = entry.entry_hash;
  }
  
  return { session_id: 'test-session', entries };
}

// Test 1: Empty transcript validation
function testEmptyTranscript(): boolean {
  const session: VerifierTranscriptSession = {
    session_id: 'empty-session',
    entries: []
  };
  
  const result = validateTranscript(session);
  
  return (
    result.valid === false &&
    result.errors.length > 0 &&
    result.errors[0].includes('Empty transcript') &&
    result.entry_count === 0
  );
}

// Test 2: Valid transcript passes
function testValidTranscript(): boolean {
  const session = createValidSession(3);
  const result = validateTranscript(session);
  
  return (
    result.valid === true &&
    result.errors.length === 0 &&
    result.chain_integrity === true &&
    result.hash_validity === true &&
    result.entry_count === 3
  );
}

// Test 3: Broken chain detection
function testBrokenChain(): boolean {
  const session = createValidSession(3);
  // Corrupt the chain by changing previous_hash of second entry
  session.entries[1].previous_hash = 'corrupted-hash';
  
  const result = validateTranscript(session);
  
  return (
    result.valid === false &&
    result.chain_integrity === false &&
    result.errors.some(e => e.includes('Chain break'))
  );
}

// Test 4: Invalid hash detection
function testInvalidHash(): boolean {
  const session = createValidSession(3);
  // Corrupt an entry hash
  session.entries[1].entry_hash = 'tampered-hash-value';
  
  const result = validateTranscript(session);
  
  return (
    result.valid === false &&
    result.hash_validity === false &&
    result.errors.some(e => e.includes('Hash mismatch'))
  );
}

// Test 5: First entry must have null previous_hash
function testFirstEntryNullPrevious(): boolean {
  const session = createValidSession(2);
  // Make first entry point to something
  session.entries[0].previous_hash = 'not-null';
  
  const errors: string[] = [];
  const valid = verifyHashChain(session, errors);
  
  return valid === false && errors.some(e => e.includes('previous_hash=null'));
}

// Test 6: Get transcript head
function testGetTranscriptHead(): boolean {
  const session = createValidSession(5);
  const head = getTranscriptHead(session);
  const lastEntry = session.entries[4];
  
  return head === lastEntry.entry_hash;
}

// Test 7: Verify transcript head matches expected
function testVerifyTranscriptHead(): boolean {
  const session = createValidSession(3);
  const head = getTranscriptHead(session)!;
  
  const matches = verifyTranscriptHead(session, head);
  const noMatch = verifyTranscriptHead(session, 'wrong-hash');
  
  return matches === true && noMatch === false;
}

// Test 8: Cross-session isolation
function testCrossSessionIsolation(): boolean {
  const sessionA = createValidSession(2);
  sessionA.session_id = 'session-a';
  
  const sessionB = createValidSession(2);
  sessionB.session_id = 'session-b';
  
  // Entries should have different hashes due to different session_ids
  const hashA = sessionA.entries[0].entry_hash;
  const hashB = sessionB.entries[0].entry_hash;
  
  return hashA !== hashB;
}

// Run all tests
export function runVerifierTests(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           VERIFIER SDK TESTS — Execution Protocol v2       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const tests = [
    { name: 'Empty transcript validation', fn: testEmptyTranscript },
    { name: 'Valid transcript passes', fn: testValidTranscript },
    { name: 'Broken chain detection', fn: testBrokenChain },
    { name: 'Invalid hash detection', fn: testInvalidHash },
    { name: 'First entry null previous_hash', fn: testFirstEntryNullPrevious },
    { name: 'Get transcript head', fn: testGetTranscriptHead },
    { name: 'Verify transcript head', fn: testVerifyTranscriptHead },
    { name: 'Cross-session isolation', fn: testCrossSessionIsolation }
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
  runVerifierTests();
}
