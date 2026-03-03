/**
 * ERC-8004 Attestation Adapter Tests — Execution Protocol v2
 * 
 * Pure function tests for attestation interface.
 * No on-chain calls. No network dependencies.
 */

import {
  createAttestationRequest,
  computeTranscriptHash,
  generateAttestation,
  generateMockProof,
  checkAttestationStatus,
  verifyAttestationFormat,
  AttestationRequest,
  AttestationProof
} from '../src/attestation';
import { VerifierTranscriptEntry, VerifierTranscriptSession } from '../src/integrations';

// Test utilities
function createTestSession(entryCount: number = 2): VerifierTranscriptSession {
  const entries: VerifierTranscriptEntry[] = [];
  let previousHash: string | null = null;
  
  for (let i = 0; i < entryCount; i++) {
    const entryHash = `hash-${i}-${Date.now()}`;
    entries.push({
      entry_hash: entryHash,
      previous_hash: previousHash,
      session_id: 'test-session',
      entry_type: 'test',
      content: { index: i },
      agent_id: 'test-agent'
    });
    previousHash = entryHash;
  }
  
  return { session_id: 'test-session', entries };
}

// Test 1: Create attestation request
function testCreateAttestationRequest(): boolean {
  const session = createTestSession(3);
  const request = createAttestationRequest(session, 8453);
  
  return (
    request.transcript_hash.startsWith('0x') &&
    request.session_id === 'test-session' &&
    request.chain_id === 8453 &&
    typeof request.timestamp === 'string'
  );
}

// Test 2: Compute transcript hash
function testComputeTranscriptHash(): boolean {
  const session = createTestSession(2);
  const hash = computeTranscriptHash(session);
  
  // Should return hash of last entry prefixed with 0x
  const lastEntry = session.entries[1];
  return hash === '0x' + lastEntry.entry_hash;
}

// Test 3: Empty session returns zero hash
function testEmptySessionHash(): boolean {
  const session: VerifierTranscriptSession = {
    session_id: 'empty',
    entries: []
  };
  const hash = computeTranscriptHash(session);
  
  return hash === '0x' + '0'.repeat(64);
}

// Test 4: Generate attestation (stub)
function testGenerateAttestation(): boolean {
  const request: AttestationRequest = {
    transcript_hash: '0xabc123',
    session_id: 'test',
    chain_id: 8453,
    timestamp: new Date().toISOString()
  };
  
  const attestation = generateAttestation(request);
  
  return (
    attestation.attestation_id.startsWith('attest-') &&
    attestation.transcript_hash === request.transcript_hash &&
    attestation.status === 'pending' &&
    attestation.proof_data === null &&
    typeof attestation.created_at === 'string'
  );
}

// Test 5: Generate mock proof
function testGenerateMockProof(): boolean {
  const request: AttestationRequest = {
    transcript_hash: '0xabc123',
    session_id: 'test',
    chain_id: 8453,
    timestamp: new Date().toISOString()
  };
  
  const proof = generateMockProof(request);
  
  return (
    proof.format === 'erc8004-v1' &&
    proof.transcript_hash === request.transcript_hash &&
    proof.signatures.length > 0 &&
    proof.signatures[0].signer_type === 'validator' &&
    proof.metadata.stub === true
  );
}

// Test 6: Check attestation status (stub)
function testCheckAttestationStatus(): boolean {
  const status = checkAttestationStatus('any-id');
  return status === 'pending';
}

// Test 7: Verify valid attestation format
function testVerifyValidFormat(): boolean {
  const proof: AttestationProof = {
    format: 'erc8004-v1',
    transcript_hash: '0xabc123',
    merkle_root: null,
    signatures: [{
      signer_type: 'validator',
      public_key: '0x' + 'a'.repeat(40),
      signature: '0x' + 'b'.repeat(128),
      timestamp: new Date().toISOString()
    }],
    metadata: {}
  };
  
  return verifyAttestationFormat(proof) === true;
}

// Test 8: Verify invalid format (wrong format version)
function testVerifyInvalidFormatVersion(): boolean {
  const proof: AttestationProof = {
    format: 'wrong-format' as any,
    transcript_hash: '0xabc123',
    merkle_root: null,
    signatures: [{
      signer_type: 'validator',
      public_key: '0x' + 'a'.repeat(40),
      signature: '0x' + 'b'.repeat(128),
      timestamp: new Date().toISOString()
    }],
    metadata: {}
  };
  
  return verifyAttestationFormat(proof) === false;
}

// Test 9: Verify invalid format (missing signatures)
function testVerifyMissingSignatures(): boolean {
  const proof: AttestationProof = {
    format: 'erc8004-v1',
    transcript_hash: '0xabc123',
    merkle_root: null,
    signatures: [],
    metadata: {}
  };
  
  return verifyAttestationFormat(proof) === false;
}

// Test 10: Verify invalid format (bad transcript hash)
function testVerifyBadTranscriptHash(): boolean {
  const proof: AttestationProof = {
    format: 'erc8004-v1',
    transcript_hash: 'not-starting-with-0x',
    merkle_root: null,
    signatures: [{
      signer_type: 'validator',
      public_key: '0x' + 'a'.repeat(40),
      signature: '0x' + 'b'.repeat(128),
      timestamp: new Date().toISOString()
    }],
    metadata: {}
  };
  
  return verifyAttestationFormat(proof) === false;
}

// Test 11: Attestation ID determinism
function testAttestationIdDeterminism(): boolean {
  const session = createTestSession(2);
  const request1 = createAttestationRequest(session, 8453);
  
  // Create identical request
  const request2: AttestationRequest = {
    transcript_hash: request1.transcript_hash,
    session_id: request1.session_id,
    chain_id: request1.chain_id,
    timestamp: request1.timestamp
  };
  
  const attestation1 = generateAttestation(request1);
  const attestation2 = generateAttestation(request2);
  
  // Same input should produce same ID (deterministic)
  return attestation1.attestation_id === attestation2.attestation_id;
}

// Run all tests
export function runAttestationTests(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      ERC-8004 ATTESTATION TESTS — Execution Protocol v2    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const tests = [
    { name: 'Create attestation request', fn: testCreateAttestationRequest },
    { name: 'Compute transcript hash', fn: testComputeTranscriptHash },
    { name: 'Empty session returns zero hash', fn: testEmptySessionHash },
    { name: 'Generate attestation (stub)', fn: testGenerateAttestation },
    { name: 'Generate mock proof', fn: testGenerateMockProof },
    { name: 'Check attestation status (stub)', fn: testCheckAttestationStatus },
    { name: 'Verify valid attestation format', fn: testVerifyValidFormat },
    { name: 'Verify invalid format (wrong version)', fn: testVerifyInvalidFormatVersion },
    { name: 'Verify invalid format (missing signatures)', fn: testVerifyMissingSignatures },
    { name: 'Verify invalid format (bad hash)', fn: testVerifyBadTranscriptHash },
    { name: 'Attestation ID determinism', fn: testAttestationIdDeterminism }
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
  runAttestationTests();
}
