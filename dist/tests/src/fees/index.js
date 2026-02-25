/**
 * Fee Metering — Execution Protocol v2
 *
 * Execution weight metering for usage-based economics.
 * Dry-run mode only during Phase 4 development.
 *
 * READ-ONLY: Consumes transcript outputs from kernel.
 * Does NOT modify canonicalization, transcript, or hash logic.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
export { countExecutionSteps, calculateComplexity, estimateGas, countComputeUnits, countIOOperations, countPolicyChecks, calculateMetrics, calculateFee, calculateBatchFees, compareFees, getFeeSummary, DEFAULT_FEE_CONFIG, ExecutionMetrics, FeeEstimate, FeeBreakdown, FeeConfig } from './FeeMetering.js';
export { appendFeeEntry, getAgentCumulativeTotal, getAgentAccumulator, getAllAccumulators, readLedger, getFeeSummary as getLedgerSummary, checkDailyCap, FeeLedgerEntry, AgentFeeAccumulator } from './FeeLedger.js';
