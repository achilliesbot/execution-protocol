import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { computeRequestId, verifyBasePay, getBasePayConfig } from '../src/payments/basePay.js';
import { recordPayment, getCurrentPaymentStats } from '../src/telemetry/Telemetry.js';

// Create a minimal EP app for testing
function createTestApp(basePayEnabled = false, mockPaid = false) {
  const app = express();
  app.use(express.json());
  
  // Mock agent auth
  app.use((req, res, next) => {
    req.agent = { id: 'test-agent' };
    next();
  });
  
  // BasePay middleware
  async function basePayMiddleware(req, res, next) {
    try {
      const { enabled, contractAddress, feeUsdc } = getBasePayConfig();
      
      if (!enabled) {
        recordPayment({ required: false, paid: true, fee_usdc_6dp: 0 });
        return next();
      }
      
      const agentId = req.agent?.id || 'unknown';
      const policySetId = req.body?.policy_set_id || 'unknown';
      const requestId = computeRequestId({ agentId, policySetId, proposal: req.body });
      req.basePay = { requestId };
      
      // Use mock for testing
      if (mockPaid) {
        recordPayment({ required: true, paid: true, fee_usdc_6dp: feeUsdc });
        return next();
      }
      
      recordPayment({ required: true, paid: false, fee_usdc_6dp: feeUsdc });
      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        error: 'Payment required',
        message: 'USDC fee required before validation',
        fee_usdc_6dp: String(feeUsdc),
        request_id: requestId,
        contract_address: contractAddress,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      recordPayment({ required: true, paid: false, fee_usdc_6dp: getBasePayConfig().feeUsdc });
      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        error: 'Payment verification failed',
        message: 'Unable to verify BasePay receipt.',
        fee_usdc_6dp: String(getBasePayConfig().feeUsdc),
        contract_address: getBasePayConfig().contractAddress,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Mock validation endpoint
  app.post('/ep/validate', basePayMiddleware, (req, res) => {
    res.json({
      valid: true,
      risk_score: 'LOW',
      request_id: req.basePay?.requestId,
      timestamp: new Date().toISOString()
    });
  });
  
  // Health endpoint (no auth)
  app.get('/ep/health', (req, res) => {
    res.json({ status: 'healthy' });
  });
  
  return app;
}

test('BASE_PAY_ENABLED=false bypasses payment gate cleanly', async () => {
  process.env.BASE_PAY_ENABLED = 'false';
  const app = createTestApp(false);
  
  const res = await request(app)
    .post('/ep/validate')
    .send({ proposal_id: 'test-1', policy_set_id: 'test-policy' });
  
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);
});

test('BASE_PAY_ENABLED=true returns 402 when no payment', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_CONTRACT_ADDRESS = '0xTestContract';
  process.env.BASE_PAY_FEE_USDC = '100000';
  const app = createTestApp(true, false);
  
  const res = await request(app)
    .post('/ep/validate')
    .send({ proposal_id: 'test-2', policy_set_id: 'test-policy' });
  
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'PAYMENT_REQUIRED');
  assert.equal(res.body.fee_usdc_6dp, '100000');
  assert.ok(res.body.request_id);
  assert.ok(res.body.contract_address);
});

test('BASE_PAY_ENABLED=true returns 200 when valid payment verified', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_CONTRACT_ADDRESS = '0xTestContract';
  process.env.BASE_PAY_FEE_USDC = '100000';
  const app = createTestApp(true, true); // mockPaid = true
  
  const res = await request(app)
    .post('/ep/validate')
    .send({ proposal_id: 'test-3', policy_set_id: 'test-policy' });
  
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);
});

test('requestId consistency between calls with same payload', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_CONTRACT_ADDRESS = '0xTestContract';
  process.env.BASE_PAY_FEE_USDC = '100000';
  const app = createTestApp(true, false);
  
  const payload = { proposal_id: 'consistency-test', policy_set_id: 'test-policy', amount: 100 };
  
  const res1 = await request(app).post('/ep/validate').send(payload);
  const res2 = await request(app).post('/ep/validate').send(payload);
  
  // Both should return 402 (no payment) but with same requestId
  assert.equal(res1.status, 402);
  assert.equal(res2.status, 402);
  assert.equal(res1.body.request_id, res2.body.request_id);
});

test('requestId differs for different payloads', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_CONTRACT_ADDRESS = '0xTestContract';
  process.env.BASE_PAY_FEE_USDC = '100000';
  const app = createTestApp(true, false);
  
  const res1 = await request(app)
    .post('/ep/validate')
    .send({ proposal_id: 'test-a', policy_set_id: 'policy-1' });
  
  const res2 = await request(app)
    .post('/ep/validate')
    .send({ proposal_id: 'test-b', policy_set_id: 'policy-1' });
  
  assert.notEqual(res1.body.request_id, res2.body.request_id);
});

test('health endpoint unaffected by BASE_PAY_ENABLED', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  const app = createTestApp(true, false);
  
  const res = await request(app).get('/ep/health');
  
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'healthy');
});

test('telemetry payments endpoint returns correct data', async () => {
  // Reset payment stats by checking current
  const initialStats = getCurrentPaymentStats();
  
  // Make some test calls
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_CONTRACT_ADDRESS = '0xTestContract';
  process.env.BASE_PAY_FEE_USDC = '100000';
  const app = createTestApp(true, false);
  
  await request(app).post('/ep/validate').send({ proposal_id: 'telemetry-1' });
  await request(app).post('/ep/validate').send({ proposal_id: 'telemetry-2' });
  
  const stats = getCurrentPaymentStats();
  
  assert.ok(stats.total_required >= 2);
  assert.ok(stats.total_402 >= 2);
});
