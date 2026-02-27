/**
 * Execution Module — Execution Protocol v2
 *
 * ExecutionPlan generation and transaction execution
 * GOVERNANCE.md §1.2: ExecutionPlan is deterministic output
 */
export { ExecutionPlan, StateSnapshot, Position, ExecutionStep, ExecutionStepType, ExecutionRiskAssessment, RiskFlag, PreExecutionCheck, RollbackStep, generateExecutionPlan } from './ExecutionPlanGenerator.js';
// Transaction executor and on-chain interaction will be added here
// Requires Bankr integration for Base chain execution
