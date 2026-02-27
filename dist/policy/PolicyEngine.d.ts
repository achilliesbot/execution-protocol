/**
 * Policy Engine — Execution Protocol v2
 *
 * GOVERNANCE.md §2.2: Policy Binding
 * Every execution must bind to:
 * - policy_set_id
 * - policy_set_hash
 * - state_snapshot_reference
 *
 * Build: Sonnet 4.6
 * Review: Codex 5.3
 */
/**
 * Policy Schema Definition
 *
 * A policy defines constraints that must be satisfied
 * before an OpportunityProposal can become an ExecutionPlan.
 */
export interface Policy {
    id: string;
    version: string;
    type: PolicyType;
    description: string;
    constraints: Constraint[];
    createdAt: string;
    updatedAt: string;
    active: boolean;
}
export type PolicyType = 'capital_allocation' | 'risk_management' | 'execution_window' | 'asset_eligibility' | 'slippage_tolerance' | 'daily_limits' | 'autonomy_bounds';
/**
 * Constraint Definition
 *
 * Each constraint has:
 * - type: What kind of check to perform
 * - parameter: What value to check against
 * - operator: How to compare (lt, gt, eq, in, etc.)
 * - value: The threshold/limit
 * - action: What to do if violated (block, warn, escalate)
 */
export interface Constraint {
    id: string;
    type: ConstraintType;
    target: string;
    operator: Operator;
    value: number | string | string[] | null;
    action: ViolationAction;
    message: string;
}
export type ConstraintType = 'max_position_size' | 'max_drawdown' | 'min_confidence' | 'max_slippage' | 'allowed_assets' | 'blocked_assets' | 'time_window' | 'max_daily_trades' | 'requires_stop_loss' | 'requires_take_profit' | 'autonomy_threshold';
export type Operator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq' | 'in' | 'nin';
export type ViolationAction = 'block' | 'warn' | 'escalate' | 'log';
/**
 * Policy Set
 *
 * A collection of policies that together define
 * the constraint environment for an execution domain.
 */
export interface PolicySet {
    id: string;
    version: string;
    name: string;
    description: string;
    policies: Policy[];
    createdAt: string;
    updatedAt: string;
    active: boolean;
}
/**
 * Policy Validation Result
 */
export interface ValidationResult {
    valid: boolean;
    violations: ConstraintViolation[];
    policySetId: string;
    policySetHash: string;
    timestamp: string;
}
export interface ConstraintViolation {
    constraintId: string;
    policyId: string;
    field: string;
    expected: string;
    actual: string;
    action: ViolationAction;
    message: string;
}
/**
 * Default Phase 1 Policy Set
 *
 * Conservative constraints for initial $200 deployment (SIMULATED)
 */
export declare function createPhase1PolicySet(): PolicySet;
/**
 * Phase 2 Policy Set — Real Capital ($200)
 *
 * Commander-approved constraints for LIVE capital deployment.
 */
export declare function createPhase2PolicySet(): PolicySet;
/**
 * Compute Policy Set Hash
 *
 * GOVERNANCE.md §2.2: Execution without explicit policy binding is invalid
 */
export declare function computePolicySetHash(policySet: PolicySet): string;
/**
 * Validate OpportunityProposal against PolicySet
 *
 * GOVERNANCE.md §2.3: Execution must not occur unless constraints pass
 */
export declare function validateAgainstPolicySet(proposal: Record<string, any>, policySet: PolicySet, stateSnapshot: Record<string, any>): ValidationResult;
//# sourceMappingURL=PolicyEngine.d.ts.map