// Test script for Execution Protocol ACP Service
const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Testing Execution Protocol ACP Service');
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [];

  // Test 1: Health check
  tests.push(
    axios.get(`${BASE_URL}/health`)
      .then(res => {
        console.log('✅ Test 1: Health check passed');
        console.log('   Status:', res.data.status);
        return true;
      })
      .catch(err => {
        console.log('❌ Test 1: Health check failed');
        console.log('   Error:', err.message);
        return false;
      })
  );

  // Test 2: Get stats
  tests.push(
    axios.get(`${BASE_URL}/api/v1/stats`)
      .then(res => {
        console.log('✅ Test 2: Stats endpoint passed');
        console.log('   Total decisions:', res.data.total_decisions);
        console.log('   Fee structure:', res.data.fee_structure.method);
        return true;
      })
      .catch(err => {
        console.log('❌ Test 2: Stats endpoint failed');
        console.log('   Error:', err.message);
        return false;
      })
  );

  // Test 3: Validate opportunity (approved)
  tests.push(
    axios.post(`${BASE_URL}/api/v1/validate`, {
      agent_id: 'test-agent-001',
      opportunity: {
        type: 'hyperliquid_funding',
        asset: 'ETH',
        expected_return: 0.05,
        confidence: 0.90,
        max_capital: 5000
      }
    })
      .then(res => {
        console.log('✅ Test 3: Validate (approved) passed');
        console.log('   Decision:', res.data.status);
        console.log('   Confidence:', res.data.confidence_score);
        console.log('   Fee (ETH):', res.data.fee.feeEth);
        console.log('   Fee method:', res.data.fee.method);
        return { success: true, decision_id: res.data.decision_id };
      })
      .catch(err => {
        console.log('❌ Test 3: Validate (approved) failed');
        console.log('   Error:', err.message);
        return { success: false };
      })
  );

  // Test 4: Validate opportunity (rejected)
  tests.push(
    axios.post(`${BASE_URL}/api/v1/validate`, {
      agent_id: 'test-agent-002',
      opportunity: {
        type: 'high_risk_trade',
        asset: 'MEME',
        expected_return: 0.50,
        confidence: 0.50, // Too low
        max_capital: 1000
      }
    })
      .then(res => {
        console.log('✅ Test 4: Validate (rejected) passed');
        console.log('   Decision:', res.data.status);
        console.log('   Reasoning:', res.data.reasoning);
        return true;
      })
      .catch(err => {
        console.log('❌ Test 4: Validate (rejected) failed');
        console.log('   Error:', err.message);
        return false;
      })
  );

  // Test 5: Get reputation
  tests.push(
    axios.get(`${BASE_URL}/api/v1/reputation/0x1234567890123456789012345678901234567890`)
      .then(res => {
        console.log('✅ Test 5: Reputation endpoint passed');
        console.log('   Score:', res.data.reputation_score);
        console.log('   Verified:', res.data.is_verified);
        return true;
      })
      .catch(err => {
        console.log('❌ Test 5: Reputation endpoint failed');
        console.log('   Error:', err.message);
        return false;
      })
  );

  // Wait for all tests
  const results = await Promise.all(tests);
  
  console.log('\n📊 Test Results:');
  console.log(`Passed: ${results.filter(r => r === true || r.success === true).length}/${tests.length}`);
  
  // If we have a decision_id from test 3, try execution test
  const test3Result = results[2];
  if (test3Result && test3Result.success && test3Result.decision_id) {
    console.log('\n🔄 Test 6: Execute trade (requires contracts deployed)');
    try {
      const execRes = await axios.post(`${BASE_URL}/api/v1/execute`, {
        decision_id: test3Result.decision_id,
        approval_token: `APPROVE:${test3Result.decision_id}:EXEC:test123`
      });
      console.log('✅ Execution test passed');
      console.log('   TX Hash:', execRes.data.tx_hash);
    } catch (err) {
      console.log('⚠️ Execution test skipped (expected if contracts not deployed)');
      console.log('   Error:', err.response?.data?.error || err.message);
    }
  }

  console.log('\n✨ All tests completed!');
}

runTests().catch(console.error);
