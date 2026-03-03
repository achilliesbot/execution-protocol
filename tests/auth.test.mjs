/**
 * Auth Tests
 * Run: node tests/auth.test.mjs
 */

import { validateAgentKey } from '../src/auth/agentAuth.ts';
import assert from 'assert';

// Mock env
process.env.EP_KEY_ACHILLES = 'test_key_achilles_12345';
process.env.EP_KEY_ARGUS = 'test_key_argus_12345';
process.env.EP_KEY_ATLAS = 'test_key_atlas_12345';

console.log('Testing Auth Layer...\n');

// Test 1: Valid key passes
console.log('Test 1: Valid key passes');
const valid = validateAgentKey('test_key_achilles_12345');
assert.strictEqual(valid.valid, true, 'Valid key should pass');
assert.strictEqual(valid.agent_id, 'achilles', 'Should return correct agent_id');
console.log('✅ PASS\n');

// Test 2: Invalid key returns 401 (simulated)
console.log('Test 2: Invalid key returns error');
const invalid = validateAgentKey('wrong_key');
assert.strictEqual(invalid.valid, false, 'Invalid key should fail');
assert.strictEqual(invalid.error, 'Invalid X-Agent-Key', 'Should return correct error');
console.log('✅ PASS\n');

// Test 3: Missing key returns 401 (simulated)
console.log('Test 3: Missing key returns error');
const missing = validateAgentKey(undefined);
assert.strictEqual(missing.valid, false, 'Missing key should fail');
assert.strictEqual(missing.error, 'Missing X-Agent-Key header', 'Should return correct error');
console.log('✅ PASS\n');

console.log('All auth tests passed ✅');
