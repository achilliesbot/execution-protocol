/**
 * Policy Engine Module — Execution Protocol v2
 * 
 * GOVERNANCE.md §2: Policy binding anchors the stack
 * All executions must validate against active policy set
 */

export type {
  Policy,
  PolicyType,
  PolicySet,
  Constraint,
  ConstraintType,
  Operator,
  ViolationAction,
  ValidationResult,
  ConstraintViolation
} from './PolicyEngine';

export {
  createPhase1PolicySet,
  createPhase2PolicySet,
  computePolicySetHash,
  validateAgainstPolicySet
} from './PolicyEngine';

// Policy versioning and migration utilities will be added here
// as the protocol evolves through phases