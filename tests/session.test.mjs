/**
 * Session Tests
 * Run: node tests/session.test.mjs
 */

import SessionManager from '../src/session/SessionManager.ts';
import TranscriptLogger from '../src/session/TranscriptLogger.ts';
import assert from 'assert';

console.log('Testing Session Layer...\n');

// Test 1: Create session
console.log('Test 1: Create session');
const session = SessionManager.createSession('achilles');
assert.ok(session.id, 'Session should have ID');
assert.strictEqual(session.agent_id, 'achilles', 'Agent ID should match');
assert.strictEqual(session.status, 'active', 'Status should be active');
console.log(`✅ Created session: ${session.id}\n`);

// Test 2: Get session (scoped to agent)
console.log('Test 2: Get session (agent-scoped)');
const retrieved = SessionManager.getSession(session.id, 'achilles');
assert.ok(retrieved, 'Should retrieve session');
assert.strictEqual(retrieved.id, session.id, 'Session ID should match');
console.log('✅ PASS\n');

// Test 3: Agent B cannot read Agent A's session
console.log('Test 3: Session isolation (agent B cannot read agent A)');
const wrongAgent = SessionManager.getSession(session.id, 'argus');
assert.strictEqual(wrongAgent, null, 'Wrong agent should not access session');
console.log('✅ PASS\n');

// Test 4: Log transcript entries
console.log('Test 4: Transcript logging with hash chain');
const entry1 = TranscriptLogger.logEntry('achilles', session.id, 'prop-1', { valid: true });
const entry2 = TranscriptLogger.logEntry('achilles', session.id, 'prop-2', { valid: true });

assert.ok(entry1.entry_hash, 'Entry 1 should have hash');
assert.ok(entry2.entry_hash, 'Entry 2 should have hash');
assert.strictEqual(entry2.prev_entry_hash, entry1.entry_hash, 'Entry 2 should reference Entry 1');
console.log(`✅ Hash chain verified: ${entry1.entry_hash.slice(0, 16)}... → ${entry2.entry_hash.slice(0, 16)}...\n`);

// Test 5: Verify hash chain integrity
console.log('Test 5: Hash chain integrity');
const valid = TranscriptLogger.verifyChain('achilles');
assert.strictEqual(valid, true, 'Hash chain should be valid');
console.log('✅ PASS\n');

// Test 6: Agent isolation in transcript
console.log('Test 6: Transcript agent isolation');
TranscriptLogger.logEntry('argus', 'different-session', 'prop-3', { valid: true });
const achillesTranscript = TranscriptLogger.getTranscript('achilles');
const argusTranscript = TranscriptLogger.getTranscript('argus');

assert.strictEqual(achillesTranscript.length, 2, 'Achilles should have 2 entries');
assert.strictEqual(argusTranscript.length, 1, 'Argus should have 1 entry');
console.log('✅ PASS\n');

console.log('All session tests passed ✅');
