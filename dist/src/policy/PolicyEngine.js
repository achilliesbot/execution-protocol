"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPhase1PolicySet = createPhase1PolicySet;
exports.computePolicySetHash = computePolicySetHash;
exports.validateAgainstPolicySet = validateAgainstPolicySet;
var canonicalization_1 = require("../canonicalization");
/**
 * Default Phase 1 Policy Set
 *
 * Conservative constraints for initial $200 deployment
 */
function createPhase1PolicySet() {
    var now = new Date().toISOString();
    return {
        id: "policy_set_phase1_".concat(Date.now()),
        version: '1.0.0',
        name: 'Phase 1: Simulated Capital Constraints',
        description: 'Conservative policy set for $200 simulated capital deployment',
        policies: [
            {
                id: 'capital_allocation_policy',
                version: '1.0.0',
                type: 'capital_allocation',
                description: 'Limits on position sizes and total allocation',
                constraints: [
                    {
                        id: 'max_position_usd',
                        type: 'max_position_size',
                        target: 'intent.amount_usd',
                        operator: 'lte',
                        value: 50, // Max $50 per position
                        action: 'block',
                        message: 'Position size exceeds maximum $50 for Phase 1'
                    },
                    {
                        id: 'max_total_allocated',
                        type: 'max_position_size',
                        target: 'state.total_allocated_usd',
                        operator: 'lte',
                        value: 200, // Total $200 capital
                        action: 'block',
                        message: 'Total allocated capital would exceed $200 limit'
                    }
                ],
                createdAt: now,
                updatedAt: now,
                active: true
            },
            {
                id: 'risk_management_policy',
                version: '1.0.0',
                type: 'risk_management',
                description: 'Required stop losses and risk parameters',
                constraints: [
                    {
                        id: 'requires_stop_loss',
                        type: 'requires_stop_loss',
                        target: 'constraints.stop_loss',
                        operator: 'neq',
                        value: null,
                        action: 'block',
                        message: 'Stop loss is required for all positions'
                    },
                    {
                        id: 'max_drawdown_percent',
                        type: 'max_drawdown',
                        target: 'risk_budget.max_drawdown_percent',
                        operator: 'lte',
                        value: 10, // Max 10% drawdown
                        action: 'block',
                        message: 'Proposed drawdown exceeds 10% maximum'
                    },
                    {
                        id: 'min_risk_reward',
                        type: 'min_confidence',
                        target: 'risk_budget.risk_reward_ratio',
                        operator: 'gte',
                        value: 2.0, // 2:1 minimum
                        action: 'warn',
                        message: 'Risk:Reward below 2:1 - consider better setup'
                    }
                ],
                createdAt: now,
                updatedAt: now,
                active: true
            },
            {
                id: 'execution_window_policy',
                version: '1.0.0',
                type: 'execution_window',
                description: 'Time-based execution constraints',
                constraints: [
                    {
                        id: 'trading_hours',
                        type: 'time_window',
                        target: 'timestamp',
                        operator: 'in',
                        value: ['09:00', '17:00'], // EST trading hours
                        action: 'escalate',
                        message: 'Execution outside standard hours requires approval'
                    }
                ],
                createdAt: now,
                updatedAt: now,
                active: true
            },
            {
                id: 'asset_eligibility_policy',
                version: '1.0.0',
                type: 'asset_eligibility',
                description: 'Allowed and blocked assets',
                constraints: [
                    {
                        id: 'allowed_assets_only',
                        type: 'allowed_assets',
                        target: 'intent.asset',
                        operator: 'in',
                        value: ['ETH', 'BTC', 'USDC', 'SOL'], // Major assets only
                        action: 'block',
                        message: 'Asset not in allowed list for Phase 1'
                    }
                ],
                createdAt: now,
                updatedAt: now,
                active: true
            },
            {
                id: 'autonomy_bounds_policy',
                version: '1.0.0',
                type: 'autonomy_bounds',
                description: 'When human approval is required',
                constraints: [
                    {
                        id: 'high_value_approval',
                        type: 'autonomy_threshold',
                        target: 'intent.amount_usd',
                        operator: 'gte',
                        value: 25, // Over $25 requires approval per D_OLYMPUS_001
                        action: 'escalate',
                        message: 'Position >= $25 requires Commander approval (90/10 autonomy)'
                    },
                    {
                        id: 'unusual_activity',
                        type: 'autonomy_threshold',
                        target: 'confidence',
                        operator: 'lt',
                        value: 0.7, // Low confidence signals
                        action: 'escalate',
                        message: 'Low confidence signal - human review recommended'
                    }
                ],
                createdAt: now,
                updatedAt: now,
                active: true
            }
        ],
        createdAt: now,
        updatedAt: now,
        active: true
    };
}
/**
 * Compute Policy Set Hash
 *
 * GOVERNANCE.md §2.2: Execution without explicit policy binding is invalid
 */
function computePolicySetHash(policySet) {
    // Only hash the immutable parts of the policy set
    var hashInput = {
        id: policySet.id,
        version: policySet.version,
        policies: policySet.policies.map(function (p) { return ({
            id: p.id,
            version: p.version,
            type: p.type,
            constraints: p.constraints.map(function (c) { return ({
                id: c.id,
                type: c.type,
                target: c.target,
                operator: c.operator,
                value: c.value,
                action: c.action
            }); })
        }); })
    };
    return (0, canonicalization_1.computeHash)(hashInput);
}
/**
 * Validate OpportunityProposal against PolicySet
 *
 * GOVERNANCE.md §2.3: Execution must not occur unless constraints pass
 */
function validateAgainstPolicySet(proposal, policySet, stateSnapshot) {
    var _a;
    var violations = [];
    for (var _i = 0, _b = policySet.policies; _i < _b.length; _i++) {
        var policy = _b[_i];
        if (!policy.active)
            continue;
        for (var _c = 0, _d = policy.constraints; _c < _d.length; _c++) {
            var constraint = _d[_c];
            var value = (_a = getNestedValue(proposal, constraint.target)) !== null && _a !== void 0 ? _a : getNestedValue(stateSnapshot, constraint.target);
            var passes = evaluateConstraint(value, constraint.operator, constraint.value);
            if (!passes) {
                violations.push({
                    constraintId: constraint.id,
                    policyId: policy.id,
                    field: constraint.target,
                    expected: "".concat(constraint.operator, " ").concat(constraint.value),
                    actual: String(value),
                    action: constraint.action,
                    message: constraint.message
                });
            }
        }
    }
    return {
        valid: violations.length === 0,
        violations: violations,
        policySetId: policySet.id,
        policySetHash: computePolicySetHash(policySet),
        timestamp: new Date().toISOString()
    };
}
/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce(function (o, p) { return o === null || o === void 0 ? void 0 : o[p]; }, obj);
}
/**
 * Evaluate a single constraint
 */
function evaluateConstraint(value, operator, constraintValue) {
    switch (operator) {
        case 'lt': return value < constraintValue;
        case 'lte': return value <= constraintValue;
        case 'gt': return value > constraintValue;
        case 'gte': return value >= constraintValue;
        case 'eq': return value === constraintValue;
        case 'neq': return value !== constraintValue;
        case 'in':
            if (Array.isArray(constraintValue)) {
                return constraintValue.includes(value);
            }
            return String(value).includes(String(constraintValue));
        case 'nin':
            if (Array.isArray(constraintValue)) {
                return !constraintValue.includes(value);
            }
            return !String(value).includes(String(constraintValue));
        default:
            return false;
    }
}
