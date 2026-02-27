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

import { computeHash } from '../canonicalization';

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

export type PolicyType = 
  | 'capital_allocation'    // Max position sizes, max drawdown
  | 'risk_management'       // Stop losses, take profits required
  | 'execution_window'      // Time-based constraints
  | 'asset_eligibility'     // Allowed/blocked assets
  | 'slippage_tolerance'    // Max slippage per trade
  | 'daily_limits'          // Max trades per day
  | 'autonomy_bounds';      // Human veto thresholds

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
  target: string;              // Field in OpportunityProposal
  operator: Operator;
  value: number | string | string[] | null;
  action: ViolationAction;
  message: string;             // Human-readable explanation
}

export type ConstraintType =
  | 'max_position_size'       // USD value limit
  | 'max_drawdown'           // Percentage from entry
  | 'min_confidence'         // Signal confidence threshold
  | 'max_slippage'           // Percentage
  | 'allowed_assets'         // Whitelist
  | 'blocked_assets'         // Blacklist
  | 'time_window'            // Start/end hours
  | 'max_daily_trades'       // Count limit
  | 'requires_stop_loss'     // Boolean
  | 'requires_take_profit'   // Boolean
  | 'autonomy_threshold';    // When to require human approval

export type Operator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq' | 'in' | 'nin';

export type ViolationAction = 'block' | 'warn' | 'escalate' | 'log';

/**
 * Policy Set
 * 
 * A collection of policies that together define
 * the constraint environment for an execution domain.
 */
export interface PolicySet {
  id: string;                  // policy_set_id
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
export function createPhase1PolicySet(): PolicySet {
  const now = new Date().toISOString();

  // Build policy content first, then derive deterministic ID from content hash.
  // This removes Date.now() from the policy_set_id generation.
  const version = '1.0.0';
  const name = 'Phase 1: Simulated Capital Constraints';
  const description = 'Conservative policy set for $200 simulated capital deployment';

  const policies: Policy[] = [
      {
        id: 'capital_allocation_policy',
        version: '1.0.0',
        type: 'capital_allocation',
        description: 'Limits on position sizes and total allocation',
        constraints: [
          {
            id: 'max_position_usd',
            type: 'max_position_size',
            target: 'intent.amount.value',
            operator: 'lte',
            value: 50,  // Max $50 per position (usd unit expected in proposal.intent.amount.unit)
            action: 'block',
            message: 'Position size exceeds maximum $50 for Phase 1'
          },
          {
            id: 'max_total_allocated',
            type: 'max_position_size',
            target: 'portfolio.allocated_capital_usd',
            operator: 'lte',
            value: 200,  // Total $200 capital (from StateSnapshot.portfolio.allocated_capital_usd)
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
            value: 10,  // Max 10% drawdown
            action: 'block',
            message: 'Proposed drawdown exceeds 10% maximum'
          },
          {
            id: 'min_risk_reward',
            type: 'min_confidence',
            target: 'risk_budget.risk_reward_ratio',
            operator: 'gte',
            value: 2.0,  // 2:1 minimum
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
            value: ['09:00', '17:00'],  // EST trading hours
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
            target: 'intent.asset_out.symbol',
            operator: 'in',
            value: ['ETH', 'BTC', 'USDC', 'SOL'],  // Major assets only
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
            value: 25,  // Over $25 requires approval per D_OLYMPUS_001
            action: 'escalate',
            message: 'Position >= $25 requires Commander approval (90/10 autonomy)'
          },
          {
            id: 'unusual_activity',
            type: 'autonomy_threshold',
            target: 'confidence',
            operator: 'lt',
            value: 0.7,  // Low confidence signals
            action: 'escalate',
            message: 'Low confidence signal - human review recommended'
          }
        ],
        createdAt: now,
        updatedAt: now,
        active: true
      }
    ];

  // Deterministic policy_set_id derived from immutable policy content.
  // This ensures identical policy content yields identical ids/hashes across runs.
  const contentHash = computeHash({
    version,
    name,
    description,
    policies: policies.map(p => ({
      id: p.id,
      version: p.version,
      type: p.type,
      constraints: p.constraints.map(c => ({
        id: c.id,
        type: c.type,
        target: c.target,
        operator: c.operator,
        value: c.value,
        action: c.action
      }))
    }))
  });

  const policySetId = `policy_set_phase1_${contentHash.substring(0, 16)}`;

  return {
    id: policySetId,
    version,
    name,
    description,
    policies,
    createdAt: now,
    updatedAt: now,
    active: true
  };
}

/**
 * Phase 2 Policy Set — Real Capital ($200)
 * 
 * Commander-approved constraints for LIVE capital deployment.
 */
export function createPhase2PolicySet(): PolicySet {
  const now = new Date().toISOString();

  const version = '2.0.0';
  const name = 'Phase 2: Real Capital Constraints ($200)';
  const description = 'Commander-approved safety constraints for $200 real capital deployment';

  const policies: Policy[] = [
    {
      id: 'capital_allocation_policy',
      version: '2.0.0',
      type: 'capital_allocation',
      description: 'Caps on position size, open positions, and daily loss',
      constraints: [
        {
          id: 'max_position_usd',
          type: 'max_position_size',
          target: 'intent.amount.value',
          operator: 'lte',
          value: 40,
          action: 'block',
          message: 'Max single position is $40 (20% of $200)'
        },
        {
          id: 'max_total_capital_usd',
          type: 'max_position_size',
          target: 'portfolio.allocated_capital_usd',
          operator: 'lte',
          value: 200,
          action: 'block',
          message: 'Total capital cap is $200'
        },
        {
          id: 'max_daily_loss_usd',
          type: 'max_position_size',
          target: 'portfolio.daily_loss_usd',
          operator: 'lte',
          value: 20,
          action: 'block',
          message: 'Max daily loss is $20 (10% of $200)'
        },
        {
          id: 'max_open_positions',
          type: 'max_daily_trades',
          target: 'portfolio.open_positions_count',
          operator: 'lte',
          value: 3,
          action: 'block',
          message: 'Max open positions is 3'
        }
      ],
      createdAt: now,
      updatedAt: now,
      active: true
    },
    {
      id: 'asset_eligibility_policy',
      version: '2.0.0',
      type: 'asset_eligibility',
      description: 'Allowed assets whitelist (Phase 2)',
      constraints: [
        {
          id: 'allowed_assets_only',
          type: 'allowed_assets',
          target: 'intent.asset_out.symbol',
          operator: 'in',
          value: ['BNKR', 'CLAWD', 'BNKRW', '$BNKR', '$CLAWD', '$BNKRW'],
          action: 'block',
          message: 'Asset not allowed for Phase 2 (BNKR/CLAWD/BNKRW only)'
        }
      ],
      createdAt: now,
      updatedAt: now,
      active: true
    },
    {
      id: 'risk_management_policy',
      version: '2.0.0',
      type: 'risk_management',
      description: 'Stop-loss and take-profit required; leverage and slippage caps',
      constraints: [
        {
          id: 'requires_stop_loss',
          type: 'requires_stop_loss',
          target: 'constraints.stop_loss',
          operator: 'neq',
          value: null,
          action: 'block',
          message: 'Stop loss is required on every trade (no exceptions)'
        },
        {
          id: 'requires_take_profit',
          type: 'requires_take_profit',
          target: 'constraints.take_profit',
          operator: 'neq',
          value: null,
          action: 'block',
          message: 'Take profit is required on every trade (no exceptions)'
        },
        {
          id: 'max_leverage',
          type: 'max_drawdown',
          target: 'constraints.leverage',
          operator: 'lte',
          value: 2,
          action: 'block',
          message: 'Max leverage is 2x'
        },
        {
          id: 'max_slippage_percent',
          type: 'max_slippage',
          target: 'constraints.slippage_percent',
          operator: 'lte',
          value: 1,
          action: 'block',
          message: 'Slippage cap is 1%'
        }
      ],
      createdAt: now,
      updatedAt: now,
      active: true
    },
    {
      id: 'autonomy_bounds_policy',
      version: '2.0.0',
      type: 'autonomy_bounds',
      description: 'Autonomy threshold for auto-execution vs Commander approval',
      constraints: [
        {
          id: 'commander_approval_threshold',
          type: 'autonomy_threshold',
          target: 'intent.amount.value',
          // PolicyEngine raises violations when a constraint FAILS.
          // To require approval for amounts >= 20, we assert amount must be < 20.
          // When amount is 20 or higher, this constraint fails → action=escalate.
          operator: 'lt',
          value: 20,
          action: 'escalate',
          message: 'Trades >= $20 require Commander APPROVE; trades < $20 may auto-execute'
        }
      ],
      createdAt: now,
      updatedAt: now,
      active: true
    }
  ];

  const contentHash = computeHash({
    version,
    name,
    description,
    policies: policies.map(p => ({
      id: p.id,
      version: p.version,
      type: p.type,
      constraints: p.constraints.map(c => ({
        id: c.id,
        type: c.type,
        target: c.target,
        operator: c.operator,
        value: c.value,
        action: c.action
      }))
    }))
  });

  const policySetId = `policy_set_phase2_${contentHash.substring(0, 16)}`;

  return {
    id: policySetId,
    version,
    name,
    description,
    policies,
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
export function computePolicySetHash(policySet: PolicySet): string {
  // Only hash the immutable parts of the policy set
  const hashInput = {
    id: policySet.id,
    version: policySet.version,
    policies: policySet.policies.map(p => ({
      id: p.id,
      version: p.version,
      type: p.type,
      constraints: p.constraints.map(c => ({
        id: c.id,
        type: c.type,
        target: c.target,
        operator: c.operator,
        value: c.value,
        action: c.action
      }))
    }))
  };
  
  return computeHash(hashInput);
}

/**
 * Validate OpportunityProposal against PolicySet
 * 
 * GOVERNANCE.md §2.3: Execution must not occur unless constraints pass
 */
export function validateAgainstPolicySet(
  proposal: Record<string, any>,
  policySet: PolicySet,
  stateSnapshot: Record<string, any>
): ValidationResult {
  const violations: ConstraintViolation[] = [];
  
  for (const policy of policySet.policies) {
    if (!policy.active) continue;
    
    for (const constraint of policy.constraints) {
      // Important: treat `null` as an explicit value (do NOT fall back to stateSnapshot).
      // Only fall back when the proposal field is truly missing (undefined).
      let value = getNestedValue(proposal, constraint.target);
      if (value === undefined) {
        value = getNestedValue(stateSnapshot, constraint.target);
      }
      
      const passes = evaluateConstraint(value, constraint.operator, constraint.value);
      
      if (!passes) {
        violations.push({
          constraintId: constraint.id,
          policyId: policy.id,
          field: constraint.target,
          expected: `${constraint.operator} ${constraint.value}`,
          actual: String(value),
          action: constraint.action,
          message: constraint.message
        });
      }
    }
  }
  
  // Deterministic timestamp: bind to stateSnapshot timestamp (not wall-clock)
  const deterministicTimestamp = String(stateSnapshot?.timestamp ?? proposal?.timestamp ?? '');

  return {
    valid: violations.length === 0,
    violations,
    policySetId: policySet.id,
    policySetHash: computePolicySetHash(policySet),
    timestamp: deterministicTimestamp
  };
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, p) => o?.[p], obj);
}

/**
 * Evaluate a single constraint
 */
function evaluateConstraint(
  value: any,
  operator: Operator,
  constraintValue: any
): boolean {
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