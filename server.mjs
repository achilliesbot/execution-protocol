#!/usr/bin/env node
/**
 * Execution Protocol v1.0 — Multi-Tenant API Server
 * 
 * Core endpoint: POST /ep/validate
 * Authentication: X-Agent-Key header required (except /ep/health, /ep/status)
 */

import express from 'express';
import cors from 'cors';
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

// Auth middleware (excludes /ep/health and /ep/status internally)
app.use(agentAuthMiddleware);

// Health check (no auth required)
app.get('/ep/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'execution-protocol',
    version: '1.0.0',
    mode: process.env.EP_MODE || 'DRY_RUN',
    timestamp: new Date().toISOString()
  });
});

// Status (no auth required)
app.get('/ep/status', statusRoute);

// Core validation endpoint (auth required)
app.post('/ep/validate', validateRoute);

// Future endpoints (stubs) — Phase 3+ features
app.post('/ep/simulate', simulateRoute);
// app.get('/ep/proof/:hash', proofRoute); // Phase 3: Guardian attestation
app.get('/ep/session/:id', sessionRoute);

// Schema endpoints — Phase 8: Public schemas (no auth required)
app.get('/schemas/opportunity-proposal.v1.json', (req, res) => {
  res.sendFile(join(__dirname, 'src', 'schemas', 'opportunity_proposal.v1.schema.json'));
});

app.get('/schemas/verification-result.v1.json', (req, res) => {
  res.sendFile(join(__dirname, 'src', 'schemas', 'verification_result.v1.schema.json'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
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
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log(`  GET  /ep/health     (no auth)`);
  console.log(`  GET  /ep/status     (no auth)`);
  console.log(`  POST /ep/validate   (X-Agent-Key required)`);
  console.log('='.repeat(60));
});
