/**
 * Fee Metering Engine — Execution Protocol v2
 * 
 * Execution weight metering for usage-based economics.
 * Dry-run mode only. No billing/settlement logic.
 * 
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */

import { VerifierTranscriptSession, VerifierTranscriptEntry } from '../integrations';

/**
 * Execution metrics for fee calculation
 */
export interface ExecutionMetrics {
  session_id: string;
  step_count: number;
  complexity_score: number;
  estimated_gas: number;
  compute_units: number;
  io_operations: number;
  policy_checks: number;
}

/**
 * Fee estimate (dry-run)
 */
export interface FeeEstimate {
  base_fee: number;
  complexity_multiplier: number;
  execution_weight: number;
  total: number;
  currency: 'EXEC' | 'USDC' | 'ETH';
  breakdown: FeeBreakdown;
  dry_run: true; // Always true in Phase 4
}

/**
 * Fee breakdown
 */
export interface FeeBreakdown {
  base: number;
  per_step: number;
  per_compute_unit: number;
  per_io_operation: number;
  per_policy_check: number;
}

/**
 * Fee configuration
 */
export interface FeeConfig {
  base_fee: number;
  step_rate: number;
  compute_unit_rate: number;
  io_rate: number;
  policy_check_rate: number;
  complexity_threshold: number;
  complexity_multiplier: number;
}

/**
 * Default fee configuration (dry-run rates)
 */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  base_fee: 100,           // Base fee in smallest unit
  step_rate: 10,           // Per execution step
  compute_unit_rate: 1,    // Per compute unit
  io_rate: 5,              // Per I/O operation
  policy_check_rate: 2,    // Per policy validation
  complexity_threshold: 50, // Threshold for complexity multiplier
  complexity_multiplier: 1.5 // Multiplier for complex executions
};

/**
 * Count execution steps in session
 * Pure function — no side effects
 */
export function countExecutionSteps(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  // Count relevant entry types as "steps"
  const stepTypes = new Set([
    'proposal_received',
    'validation_complete',
    'plan_generated',
    'execution_attempted',
    'execution_confirmed',
    'execution_failed'
  ]);
  
  return session.entries.filter(e => stepTypes.has(e.entry_type)).length;
}

/**
 * Calculate complexity score
 * Based on step count, content size, and entry variety
 * Pure function — no side effects
 */
export function calculateComplexity(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  const stepCount = countExecutionSteps(session);
  const entryTypes = new Set(session.entries.map(e => e.entry_type)).size;
  
  // Estimate content complexity
  let contentSize = 0;
  for (const entry of session.entries) {
    contentSize += JSON.stringify(entry.content || {}).length;
  }
  
  // Complexity formula: steps * variety * log(content_size)
  const complexity = stepCount * entryTypes * Math.log(Math.max(10, contentSize));
  
  return Math.round(complexity);
}

/**
 * Estimate gas usage
 * Based on operation types in transcript
 * Pure function — no side effects
 */
export function estimateGas(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  let gas = 21000; // Base transaction gas
  
  for (const entry of session.entries) {
    switch (entry.entry_type) {
      case 'validation_complete':
        gas += 5000; // Policy validation
        break;
      case 'plan_generated':
        gas += 15000; // Plan generation overhead
        break;
      case 'execution_confirmed':
        // Add gas for actual on-chain execution
        gas += (typeof entry.content === 'object' && entry.content && 'gas_used' in entry.content 
          ? (entry.content as any).gas_used 
          : 100000);
        break;
      case 'execution_failed':
        gas += 30000; // Failed execution still costs gas
        break;
    }
  }
  
  return gas;
}

/**
 * Count compute units
 * Based on entry processing complexity
 * Pure function — no side effects
 */
export function countComputeUnits(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  let units = 0;
  
  for (const entry of session.entries) {
    switch (entry.entry_type) {
      case 'proposal_received':
        units += 100;
        break;
      case 'validation_complete':
        units += 500; // Policy checks are compute-heavy
        break;
      case 'plan_generated':
        units += 1000; // Planning is most compute-intensive
        break;
      case 'execution_attempted':
        units += 200;
        break;
      case 'execution_confirmed':
      case 'execution_failed':
        units += 300;
        break;
      case 'rejected':
        units += 200;
        break;
      default:
        units += 50;
    }
  }
  
  return units;
}

/**
 * Count I/O operations
 * Based on data access patterns
 * Pure function — no side effects
 */
export function countIOOperations(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  // Each entry represents at least one I/O (reading/writing state)
  // Plus additional I/O for content-heavy operations
  let ioOps = session.entries.length;
  
  for (const entry of session.entries) {
    // Large content indicates more I/O
    const contentSize = JSON.stringify(entry.content || {}).length;
    if (contentSize > 1000) {
      ioOps += Math.floor(contentSize / 1000);
    }
  }
  
  return ioOps;
}

/**
 * Count policy checks
 * Pure function — no side effects
 */
export function countPolicyChecks(session: VerifierTranscriptSession): number {
  if (!session.entries || session.entries.length === 0) {
    return 0;
  }
  
  // Count validation entries
  const validations = session.entries.filter(
    e => e.entry_type === 'validation_complete'
  ).length;
  
  // Each validation typically checks multiple constraints
  // Estimate 3-5 checks per validation
  return validations * 4;
}

/**
 * Calculate execution metrics
 * Pure function — no side effects
 */
export function calculateMetrics(session: VerifierTranscriptSession): ExecutionMetrics {
  return {
    session_id: session.session_id,
    step_count: countExecutionSteps(session),
    complexity_score: calculateComplexity(session),
    estimated_gas: estimateGas(session),
    compute_units: countComputeUnits(session),
    io_operations: countIOOperations(session),
    policy_checks: countPolicyChecks(session)
  };
}

/**
 * Calculate fee estimate (dry-run)
 * Pure function — no side effects
 */
export function calculateFee(
  session: VerifierTranscriptSession,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
  currency: 'EXEC' | 'USDC' | 'ETH' = 'EXEC'
): FeeEstimate {
  const metrics = calculateMetrics(session);
  
  // Calculate base components
  const baseFee = config.base_fee;
  const stepFee = metrics.step_count * config.step_rate;
  const computeFee = metrics.compute_units * config.compute_unit_rate;
  const ioFee = metrics.io_operations * config.io_rate;
  const policyFee = metrics.policy_checks * config.policy_check_rate;
  
  // Calculate complexity multiplier
  const isComplex = metrics.complexity_score > config.complexity_threshold;
  const complexityMultiplier = isComplex ? config.complexity_multiplier : 1.0;
  
  // Calculate total
  const subtotal = baseFee + stepFee + computeFee + ioFee + policyFee;
  const total = Math.round(subtotal * complexityMultiplier);
  
  return {
    base_fee: baseFee,
    complexity_multiplier: complexityMultiplier,
    execution_weight: metrics.complexity_score,
    total,
    currency,
    breakdown: {
      base: baseFee,
      per_step: stepFee,
      per_compute_unit: computeFee,
      per_io_operation: ioFee,
      per_policy_check: policyFee
    },
    dry_run: true // Always true in Phase 4
  };
}

/**
 * Calculate fees for multiple sessions
 * Pure function — no side effects
 */
export function calculateBatchFees(
  sessions: VerifierTranscriptSession[],
  config: FeeConfig = DEFAULT_FEE_CONFIG,
  currency: 'EXEC' | 'USDC' | 'ETH' = 'EXEC'
): { total: number; estimates: FeeEstimate[] } {
  const estimates = sessions.map(s => calculateFee(s, config, currency));
  const total = estimates.reduce((sum, e) => sum + e.total, 0);
  
  return { total, estimates };
}

/**
 * Compare fee estimates
 * Pure function — no side effects
 */
export function compareFees(a: FeeEstimate, b: FeeEstimate): number {
  return a.total - b.total;
}

/**
 * Get fee summary for display
 * Pure function — no side effects
 */
export function getFeeSummary(estimate: FeeEstimate): string {
  return `
Fee Estimate (${estimate.currency}) — DRY RUN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Fee:           ${estimate.breakdown.base}
Execution Steps:    ${estimate.breakdown.per_step}
Compute Units:      ${estimate.breakdown.per_compute_unit}
I/O Operations:     ${estimate.breakdown.per_io_operation}
Policy Checks:      ${estimate.breakdown.per_policy_check}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Complexity Multiplier: ${estimate.complexity_multiplier}x
Execution Weight:      ${estimate.execution_weight}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ${estimate.total} ${estimate.currency}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  DRY RUN — No actual charges
  `.trim();
}
