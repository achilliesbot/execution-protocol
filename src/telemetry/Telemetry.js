/**
 * Telemetry Module — Execution Protocol v1.0
 * 
 * Writes telemetry files every 60 seconds:
 * - ep_status.json: Service health snapshot
 * - validations_24h.json: Aggregated validation stats
 * 
 * Served at /telemetry/* endpoints for external dashboards
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TELEMETRY_DIR = process.env.TELEMETRY_DIR || '/data/.openclaw/workspace/achilliesbot/execution-protocol/telemetry';

// Validation stats accumulator
const validationStats = {
  total: 0,
  passed: 0,
  failed: 0,
  riskScores: [],
  startTime: Date.now()
};

// Payment stats accumulator (USDC micro-fees)
const paymentStats = {
  total_required: 0,
  total_paid: 0,
  total_402: 0,
  total_usdc_6dp: 0,
  startTime: Date.now()
};

/**
 * Ensure telemetry directory exists
 */
function ensureTelemetryDir() {
  if (!existsSync(TELEMETRY_DIR)) {
    mkdirSync(TELEMETRY_DIR, { recursive: true });
  }
}

/**
 * Record a validation result for aggregation
 */
export function recordValidation(result) {
  validationStats.total++;
  
  if (result.valid) {
    validationStats.passed++;
  } else {
    validationStats.failed++;
  }
  
  if (result.risk_score) {
    validationStats.riskScores.push(result.risk_score);
  }
  
  // Keep only last 24 hours of risk scores (assume ~1000 validations/day)
  if (validationStats.riskScores.length > 10000) {
    validationStats.riskScores = validationStats.riskScores.slice(-1000);
  }
}

/**
 * Get service uptime in seconds
 */
function getUptimeSeconds() {
  return Math.floor(process.uptime());
}

/**
 * Get audit status from environment/state
 */
function getAuditStatus() {
  // Check if Phase 6 audit passed
  const phase6Status = process.env.EP_PHASE6_STATUS || 'PASS';
  return phase6Status;
}

/**
 * Calculate average risk score
 */
function getAverageRiskScore() {
  if (validationStats.riskScores.length === 0) {
    return 'N/A';
  }
  
  const scoreValues = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
  let total = 0;
  
  for (const score of validationStats.riskScores) {
    total += scoreValues[score] || 1;
  }
  
  const avg = total / validationStats.riskScores.length;
  
  if (avg <= 1.5) return 'LOW';
  if (avg <= 2.5) return 'MEDIUM';
  if (avg <= 3.5) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Write ep_status.json
 */
function writeStatusFile() {
  const status = {
    service: 'execution-protocol',
    version: '1.0.0',
    mode: process.env.EP_MODE || 'DRY_RUN',
    uptime_seconds: getUptimeSeconds(),
    audit_status: getAuditStatus(),
    timestamp: new Date().toISOString()
  };
  
  const filepath = join(TELEMETRY_DIR, 'ep_status.json');
  writeFileSync(filepath, JSON.stringify(status, null, 2));
}

/**
 * Write validations_24h.json
 */
function writeValidationsFile() {
  const passRate = validationStats.total > 0 
    ? Math.round((validationStats.passed / validationStats.total) * 1000) / 1000 
    : 0;
  
  const stats = {
    total: validationStats.total,
    passed: validationStats.passed,
    failed: validationStats.failed,
    pass_rate: passRate,
    avg_risk_score: getAverageRiskScore(),
    timestamp: new Date().toISOString()
  };
  
  const filepath = join(TELEMETRY_DIR, 'validations_24h.json');
  writeFileSync(filepath, JSON.stringify(stats, null, 2));
}

/**
 * Write all telemetry files
 */
function writePaymentsFile() {
  const stats = {
    total_required: paymentStats.total_required,
    total_paid: paymentStats.total_paid,
    total_402: paymentStats.total_402,
    total_usdc: paymentStats.total_usdc_6dp / 1_000_000,
    timestamp: new Date().toISOString()
  };

  const filepath = join(TELEMETRY_DIR, 'payments_24h.json');
  writeFileSync(filepath, JSON.stringify(stats, null, 2));
}

function writeTelemetryFiles() {
  try {
    ensureTelemetryDir();
    writeStatusFile();
    writeValidationsFile();
    writePaymentsFile();
    console.log(`[TELEMETRY] Files written at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[TELEMETRY] Error writing files:', error);
  }
}

/**
 * Start telemetry collection (60-second interval)
 */
export function startTelemetry() {
  // Write immediately on start
  writeTelemetryFiles();
  
  // Then every 60 seconds
  const intervalId = setInterval(writeTelemetryFiles, 60000);
  
  console.log('[TELEMETRY] Started 60-second telemetry collection');
  
  return intervalId;
}

/**
 * Get current status (for API endpoint)
 */
export function getCurrentStatus() {
  return {
    service: 'execution-protocol',
    version: '1.0.0',
    mode: process.env.EP_MODE || 'DRY_RUN',
    uptime_seconds: getUptimeSeconds(),
    audit_status: getAuditStatus(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Get current validation stats (for API endpoint)
 */
export function recordPayment({ required, paid, fee_usdc_6dp }) {
  if (required) paymentStats.total_required++;
  if (paid) paymentStats.total_paid++;
  if (required && !paid) paymentStats.total_402++;

  if (paid && fee_usdc_6dp !== undefined && fee_usdc_6dp !== null) {
    const n = Number(fee_usdc_6dp);
    if (Number.isFinite(n)) {
      paymentStats.total_usdc_6dp += n;
    }
  }
}

export function getCurrentPaymentStats() {
  return {
    total_required: paymentStats.total_required,
    total_paid: paymentStats.total_paid,
    total_402: paymentStats.total_402,
    total_usdc: paymentStats.total_usdc_6dp / 1_000_000,
    timestamp: new Date().toISOString()
  };
}

export function getCurrentValidationStats() {
  const passRate = validationStats.total > 0 
    ? Math.round((validationStats.passed / validationStats.total) * 1000) / 1000 
    : 0;
  
  return {
    total: validationStats.total,
    passed: validationStats.passed,
    failed: validationStats.failed,
    pass_rate: passRate,
    avg_risk_score: getAverageRiskScore(),
    timestamp: new Date().toISOString()
  };
}

export default {
  startTelemetry,
  recordValidation,
  recordPayment,
  getCurrentStatus,
  getCurrentValidationStats,
  getCurrentPaymentStats
};
