import test from 'node:test';
import assert from 'node:assert/strict';

// Import the middleware indirectly by hitting the exported verify function + mimicking server behavior.
import { computeRequestId, verifyBasePay, getBasePayConfig } from '../src/payments/basePay.js';


test('verifyBasePay mock unpaid returns paid=false with fee', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_FEE_USDC = '100000';
  process.env.BASE_PAY_MOCK = 'unpaid';

  const requestId = '0x' + '11'.repeat(32);
  const v = await verifyBasePay({ requestId });

  assert.equal(v.required, true);
  assert.equal(v.paid, false);
  assert.equal(v.feeAmount, '100000');
});


test('verifyBasePay mock paid returns paid=true', async () => {
  process.env.BASE_PAY_ENABLED = 'true';
  process.env.BASE_PAY_FEE_USDC = '100000';
  process.env.BASE_PAY_MOCK = 'paid';

  const requestId = '0x' + '22'.repeat(32);
  const v = await verifyBasePay({ requestId });

  assert.equal(v.required, true);
  assert.equal(v.paid, true);
  assert.equal(v.feeAmount, '100000');
});
