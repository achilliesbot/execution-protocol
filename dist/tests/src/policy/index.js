/**
 * Policy Engine Module — Execution Protocol v2
 *
 * GOVERNANCE.md §2: Policy binding anchors the stack
 * All executions must validate against active policy set
 */
export { Policy, PolicyType, PolicySet, Constraint, ConstraintType, Operator, ViolationAction, ValidationResult, ConstraintViolation, createPhase1PolicySet, computePolicySetHash, validateAgainstPolicySet } from './PolicyEngine.js';
// Policy versioning and migration utilities will be added here
// as the protocol evolves through phases
