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
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { agentAuthMiddleware } from './src/auth/agentAuth.js';
import { validateRoute } from './src/routes/validate.js';
import { statusRoute } from './src/routes/status.js';
import { simulateRoute, proofRoute, sessionRoute } from './src/routes/simulate.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Rate limiter for public endpoints (health, status, schemas) — 200 req/min per IP
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  handler: (req, res) => {
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
  keyGenerator: (req, res) => {
    // Use agent ID if authenticated, otherwise use IP generator
    if (req.agent?.id) {
      return req.agent.id;
    }
    return ipKeyGenerator(req, res);
  },
  handler: (req, res) => {
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

// Core validation endpoint (auth + rate limit required)
app.post('/ep/validate', authRateLimiter, validateRoute);

// Simulation endpoint (auth + rate limit required)
app.post('/ep/simulate', authRateLimiter, simulateRoute);

// Future endpoints (stubs) — Phase 3+ features
// app.get('/ep/proof/:hash', authRateLimiter, proofRoute);
app.get('/ep/session/:id', authRateLimiter, sessionRoute);

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
  
  // Check if it's a rate limit error from express-rate-limit
  if (err.status === 429 || err.name === 'RateLimitError') {
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
  console.log(`  GET  /ep/health     (no auth)`);
  console.log(`  GET  /ep/status     (no auth)`);
  console.log(`  GET  /schemas/*     (no auth)`);
  console.log(`  POST /ep/validate   (auth + rate limit)`);
  console.log(`  POST /ep/simulate   (auth + rate limit)`);
  console.log('='.repeat(60));
});
