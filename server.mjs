#!/usr/bin/env node
/**
 * Execution Protocol v1.0 — Multi-Tenant API Server
 * 
 * Core endpoint: POST /ep/validate
 * Authentication: X-Agent-Key header required (except /ep/health, /ep/status, /schemas/*)
 * Rate Limiting: 100 req/min per agent (auth), 200 req/min per IP (public)
 * Idempotency: 10-minute cache for POST /ep/validate
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { agentAuthMiddleware } from './src/auth/agentAuth.js';
import { validateRoute } from './src/routes/validate.js';
import { statusRoute } from './src/routes/status.js';
import { simulateRoute, proofRoute, sessionRoute } from './src/routes/simulate.js';
import { startTelemetry, getCurrentStatus, getCurrentValidationStats, getCurrentPaymentStats, recordPayment } from './src/telemetry/Telemetry.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeRequestId, getBasePayConfig, verifyBasePay } from './src/payments/basePay.js';
import pantheonRoutes from './src/routes/pantheon-live.js';
import gtmRoutes from './src/routes/gtm.js';
import spawnerRoutes from './src/routes/spawner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Trust proxy must be explicitly enabled to avoid X-Forwarded-For spoofing.
// Set TRUST_PROXY=1 in production if you are behind a single reverse proxy.
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
app.set('trust proxy', TRUST_PROXY ? 1 : false);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// PUBLIC PAGE ROUTES (before auth middleware)
// Redirect root to Pantheon UI
app.get('/', (req, res) => {
  res.redirect('/pantheon.html');
});

// Page routes for each tab
app.get('/overview', (req, res) => {
  res.redirect('/pantheon.html#overview');
});

app.get('/trades', (req, res) => {
  res.redirect('/pantheon.html#trades');
});

app.get('/streams', (req, res) => {
  res.redirect('/pantheon.html#streams');
});

app.get('/income', (req, res) => {
  res.redirect('/pantheon.html#income');
});

app.get('/integrate', (req, res) => {
  res.redirect('/pantheon.html#integrate');
});

app.get('/vault', (req, res) => {
  res.redirect('/pantheon.html#vault');
});

// Rate limiter for public endpoints (health, status, schemas) — 200 req/min per IP
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.set('Retry-After', '60');
    res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP. Please try again later.',
      retry_after: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// Rate limiter for authenticated endpoints — 100 req/min per agent
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.agent?.id ? req.agent.id : req.ip),
  handler: (req, res) => {
    res.set('Retry-After', '60');
    res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Rate limit exceeded',
      message: 'Too many requests for this agent. Please try again later.',
      retry_after: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// Auth middleware (excludes /ep/health, /ep/status, /schemas/* internally)
app.use(agentAuthMiddleware);

// Health check (no auth required, public rate limit)
app.get('/ep/health', publicRateLimiter, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'execution-protocol',
    version: '1.0.0',
    mode: process.env.EP_MODE || 'DRY_RUN',
    timestamp: new Date().toISOString()
  });
});

// Status (no auth required, public rate limit)
app.get('/ep/status', publicRateLimiter, statusRoute);

// Schema endpoints (no auth required, public rate limit)
app.get('/schemas/opportunity-proposal.v1.json', publicRateLimiter, (req, res) => {
  res.sendFile(join(__dirname, 'src', 'schemas', 'opportunity_proposal.v1.schema.json'));
});

app.get('/schemas/verification-result.v1.json', publicRateLimiter, (req, res) => {
  res.sendFile(join(__dirname, 'src', 'schemas', 'verification_result.v1.schema.json'));
});

// Telemetry endpoints (no auth required, public rate limit)
app.get('/telemetry/status', publicRateLimiter, (req, res) => {
  res.json(getCurrentStatus());
});

app.get('/telemetry/validations', publicRateLimiter, (req, res) => {
  res.json(getCurrentValidationStats());
});

app.get('/telemetry/payments', publicRateLimiter, (req, res) => {
  res.json(getCurrentPaymentStats());
});

// BasePay middleware for /ep/validate
async function basePayMiddleware(req, res, next) {
  try {
    const { enabled, contractAddress, feeUsdc } = getBasePayConfig();

    // Only enforced for /ep/validate
    if (!enabled) {
      recordPayment({ required: false, paid: true, fee_usdc_6dp: 0 });
      return next();
    }

    const agentId = req.agent?.id || 'unknown';
    const agentTier = req.agent?.tier || 'external';
    const policySetId = req.body?.policy_set_id || 'unknown';

    // INTERNAL AGENT WHITELIST: Skip BasePay for internal agents
    if (agentTier === 'internal') {
      console.log(`[BASE_PAY] Internal agent ${agentId} bypassed payment`);
      recordPayment({ required: false, paid: true, fee_usdc_6dp: 0, bypass_reason: 'internal_agent' });
      return next();
    }

    const requestId = computeRequestId({ agentId, policySetId, proposal: req.body });
    req.basePay = { requestId };

    const v = await verifyBasePay({ requestId });

    const requiredFee = v.feeAmount || feeUsdc;

    if (!v.paid) {
      recordPayment({ required: true, paid: false, fee_usdc_6dp: requiredFee });
      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        error: 'Payment required',
        message: 'USDC fee required before validation',
        fee_usdc_6dp: String(requiredFee),
        request_id: requestId,
        contract_address: contractAddress,
        timestamp: new Date().toISOString()
      });
    }

    recordPayment({ required: true, paid: true, fee_usdc_6dp: requiredFee });
    return next();
  } catch (err) {
    // Fail closed if BasePay enabled but verification errors
    console.error('[BASE_PAY] Verification error:', err);
    recordPayment({ required: true, paid: false, fee_usdc_6dp: getBasePayConfig().feeUsdc });
    return res.status(402).json({
      code: 'PAYMENT_REQUIRED',
      error: 'Payment verification failed',
      message: 'Unable to verify BasePay receipt. Try again shortly.',
      fee_usdc_6dp: String(getBasePayConfig().feeUsdc),
      contract_address: getBasePayConfig().contractAddress,
      timestamp: new Date().toISOString()
    });
  }
}

// Core validation endpoint (auth + rate limit required)
app.post('/ep/validate', authRateLimiter, basePayMiddleware, validateRoute);

// Simulation endpoint (auth + rate limit required)
app.post('/ep/simulate', authRateLimiter, simulateRoute);

// Future endpoints (stubs) — Phase 3+ features
// app.get('/ep/proof/:hash', authRateLimiter, proofRoute);
app.get('/ep/session/:id', authRateLimiter, sessionRoute);

// Pantheon UI Routes (public dashboard + admin)
app.use('/pantheon', pantheonRoutes);

// Achilles GTM Agent Routes
app.use('/gtm', gtmRoutes);

// Agent Spawner Routes
app.use('/spawner', spawnerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  
  // JSON parse / body errors
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      code: 'INVALID_SCHEMA',
      error: 'Invalid JSON body',
      message: 'Request body must be valid JSON',
      timestamp: new Date().toISOString()
    });
  }

  // Rate limit errors
  if (err.status === 429 || err.name === 'RateLimitError') {
    res.set('Retry-After', '60');
    return res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Rate limit exceeded',
      message: err.message || 'Too many requests. Please try again later.',
      retry_after: 60,
      timestamp: new Date().toISOString()
    });
  }

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    error: 'Internal server error',
    message: err instanceof Error ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start telemetry collection
startTelemetry();

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Execution Protocol v1.0');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Mode: ${process.env.EP_MODE || 'DRY_RUN'}`);
  console.log(`Auth: X-Agent-Key required`);
  console.log(`Rate Limits: 100 req/min (auth), 200 req/min (public)`);
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log(`  GET  /ep/health              (no auth)`);
  console.log(`  GET  /ep/status              (no auth)`);
  console.log(`  GET  /schemas/*              (no auth)`);
  console.log(`  GET  /telemetry/status       (no auth)`);
  console.log(`  GET  /telemetry/validations  (no auth)`);
  console.log(`  POST /ep/validate            (auth + rate limit)`);
  console.log(`  POST /ep/simulate            (auth + rate limit)`);
  console.log('Pantheon UI:');
  console.log(`  GET  /                       → /pantheon.html`);
  console.log(`  GET  /pantheon/overview      (no auth)`);
  console.log(`  GET  /pantheon/streams       (no auth)`);
  console.log(`  GET  /pantheon/income        (no auth)`);
  console.log(`  GET  /pantheon/integrate     (no auth)`);
  console.log(`  GET  /pantheon/vault         (no auth)`);
  console.log(`  GET  /admin/ledger           (admin auth)`);
  console.log(`  GET  /admin/proofs/:hash     (admin auth)`);
  console.log(`  GET  /admin/integrity        (admin auth)`);
  console.log('='.repeat(60));
});
