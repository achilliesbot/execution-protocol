/**
 * ExecutionPlan.v1 Generator — Execution Protocol v2
 * 
 * GOVERNANCE.md §1.2: ExecutionPlan is generated ONLY by deterministic layer
 * GOVERNANCE.md §3: LLM prohibited from creating/modifying ExecutionPlan
 * 
 * Derives executable artifacts from:
 * - OpportunityProposal (LLM output)
 * - PolicySet (constraints)
 * - StateSnapshot (current system state)
 * 
 * Build: Sonnet 4.6
 * Review: Codex 5.3
 */

import { OpportunityProposal, ExecutionConstraints } from '../schema';
import { PolicySet, ValidationResult, validateAgainstPolicySet } from '../policy';
import { computeHash, computeProposalHash } from '../canonicalization';

/**
 * ExecutionPlan.v1
 * 
 * The ONLY object that can be executed by the system.
 * Generated deterministically by Execution Protocol core.
 * Never created or modified by LLM layer.
 */
export interface ExecutionPlan {
  schema_version: 'v1';
  plan_id: string;               // UUID v4
  
  // Traceability to source proposal
  proposal_id: string;
  proposal_hash: string;         // Canonical hash of original proposal
  
  // Policy binding
  policy_set_id: string;
  policy_set_hash: string;
  validation_result: ValidationResult;
  
  // Execution context
  state_snapshot: StateSnapshot;
  
  // Generated execution steps
  steps: ExecutionStep[];
  
  // Final constraints (policy + proposal merged)
  constraints: ExecutionConstraints;
  
  // Risk assessment at execution time
  execution_risk: ExecutionRiskAssessment;
  
  // Metadata
  generated_at: string;          // ISO 8601
  generated_by: string;          // Agent ID
  expiry: string;                // Must execute before
  
  // Pre-execution validation
  pre_checks: PreExecutionCheck[];
  
  // Rollback plan
  rollback_steps: RollbackStep[];
}

export interface StateSnapshot {
  timestamp: string;
  block_height?: number;         // For blockchain state
  
  // Portfolio state
  portfolio: {
    total_value_usd: number;
    available_capital_usd: number;
    allocated_capital_usd: number;
    positions: Position[];
  };
  
  // Market state
  market: {
    asset_prices: Record<string, number>;
    gas_prices?: Record<string, number>;
    network_congestion?: 'low' | 'medium' | 'high';
  };
  
  // System state
  system: {
    daily_trade_count: number;
    daily_volume_usd: number;
    last_execution_at?: string;
  };
}

export interface Position {
  asset: string;
  amount: number;
  value_usd: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
}

export interface ExecutionStep {
  step_number: number;
  type: ExecutionStepType;
  
  // What to execute
  description: string;
  
  // Transaction details (for blockchain)
  transaction?: {
    to: string;
    data?: string;
    value?: string;            // In wei/minimal units
    gas_limit: number;
    max_fee_per_gas?: string;
    max_priority_fee_per_gas?: string;
  };
  
  // Expected outcomes
  expected_result: {
    asset_in?: string;
    asset_out?: string;
    amount_in?: number;
    amount_out?: number;
    price?: number;
  };
  
  // Validation after step
  validation: {
    required: boolean;
    condition: string;          // e.g., "balance_increased"
    timeout_seconds: number;
  };
  
  // Error handling
  on_failure: 'abort' | 'retry' | 'rollback';
  max_retries: number;
}

export type ExecutionStepType = 
  | 'approve_token'      // ERC20 approval
  | 'swap'               // DEX swap
  | 'bridge'             // Cross-chain bridge
  | 'stake'              // Staking contract call
  | 'unstake'            // Unstaking
  | 'claim'              // Claim rewards
  | 'deploy'             // Contract deployment
  | 'validate_balance'   // Balance check
  | 'validate_price';    // Price check

export interface ExecutionRiskAssessment {
  // At execution time
  slippage_expected: number;
  slippage_max: number;
  
  // Worst case scenarios
  worst_case_loss_usd: number;
  worst_case_loss_percent: number;
  
  // Success probability
  execution_probability: number;
  
  // Risk flags
  flags: RiskFlag[];
}

export type RiskFlag = 
  | 'high_volatility'
  | 'low_liquidity'
  | 'network_congestion'
  | 'price_stale'
  | 'high_gas_cost';

export interface PreExecutionCheck {
  check_id: string;
  description: string;
  condition: string;
  required: boolean;
  
  // How to verify
  verification: {
    type: 'balance' | 'price' | 'allowance' | 'network';
    target: string;
    operator: 'gte' | 'lte' | 'eq';
    value: number | string;
  };
}

export interface RollbackStep {
  step_number: number;
  trigger: string;               // Condition that triggers rollback
  action: string;
  transaction?: ExecutionStep['transaction'];
}

/**
 * Generate ExecutionPlan from Proposal + Policy + State
 * 
 * This is the core deterministic transformation.
 * GOVERNANCE.md §1.2: Only deterministic layer creates ExecutionPlan.
 */
export function generateExecutionPlan(
  proposal: OpportunityProposal,
  policySet: PolicySet,
  stateSnapshot: StateSnapshot
): { plan: ExecutionPlan | null; error?: string } {
  
  // Step 1: Validate proposal against policy set
  const validation = validateAgainstPolicySet(proposal, policySet, stateSnapshot);
  
  if (!validation.valid) {
    // Check if any violations are blockers
    const blockers = validation.violations.filter(v => v.action === 'block');
    if (blockers.length > 0) {
      return {
        plan: null,
        error: `Policy violations block execution: ${blockers.map(v => v.message).join(', ')}`
      };
    }
    
    // If only warnings/escalations, we can proceed but log them
    console.warn('Policy warnings:', validation.violations);
  }
  
  // Step 2: Generate execution steps based on intent
  const steps = generateSteps(proposal, stateSnapshot);
  
  if (steps.length === 0) {
    return {
      plan: null,
      error: 'Could not generate execution steps for intent'
    };
  }
  
  // Step 3: Calculate execution risk
  const executionRisk = assessExecutionRisk(proposal, stateSnapshot, steps);
  
  // Step 4: Generate pre-execution checks
  const preChecks = generatePreChecks(proposal, steps);
  
  // Step 5: Generate rollback plan
  const rollbackSteps = generateRollbackSteps(steps);
  
  // Step 6: Compute plan expiry deterministically.
  // Use stateSnapshot.timestamp (not wall-clock) as the reference clock.
  const proposalExpiryMs = new Date(proposal.expiry).getTime();
  const snapshotMs = new Date(stateSnapshot.timestamp).getTime();
  const oneHourFromSnapshot = snapshotMs + 60 * 60 * 1000;
  const planExpiry = new Date(Math.min(proposalExpiryMs, oneHourFromSnapshot));

  // Step 7: Assemble ExecutionPlan
  // Deterministic plan_id derived from stable inputs.
  const planId = `plan_${computeHash({
    proposal_id: proposal.proposal_id,
    proposal_hash: computeProposalHash(proposal),
    policy_set_hash: validation.policySetHash,
    // Bind to snapshot timestamp to prevent cross-snapshot collisions
    snapshot_timestamp: stateSnapshot.timestamp
  }).substring(0, 24)}`;

  const plan: ExecutionPlan = {
    schema_version: 'v1',
    plan_id: planId,
    
    proposal_id: proposal.proposal_id,
    proposal_hash: computeProposalHash(proposal),
    
    policy_set_id: policySet.id,
    policy_set_hash: validation.policySetHash,
    validation_result: validation,
    
    state_snapshot: stateSnapshot,
    steps,
    constraints: proposal.constraints,
    execution_risk: executionRisk,
    // Deterministic metadata: bind to snapshot timestamp
    generated_at: stateSnapshot.timestamp,
    generated_by: proposal.agent_id,
    expiry: planExpiry.toISOString(),
    pre_checks: preChecks,
    rollback_steps: rollbackSteps
  };
  
  return { plan };
}

/**
 * Generate execution steps from intent
 */
function generateSteps(
  proposal: OpportunityProposal,
  state: StateSnapshot
): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  const intent = proposal.intent;
  
  if (!intent) return steps;
  
  switch (intent.action) {
    case 'swap':
      // Step 1: Validate balances
      steps.push({
        step_number: 1,
        type: 'validate_balance',
        description: `Verify ${intent.asset_in?.symbol} balance`,
        expected_result: {
          asset_in: intent.asset_in?.symbol,
          amount_in: intent.amount?.value
        },
        validation: {
          required: true,
          condition: 'sufficient_balance',
          timeout_seconds: 30
        },
        on_failure: 'abort',
        max_retries: 0
      });
      
      // Step 2: Approve token (if ERC20)
      if (intent.asset_in?.symbol !== 'ETH') {
        steps.push({
          step_number: 2,
          type: 'approve_token',
          description: `Approve ${intent.asset_in?.symbol} for swap`,
          transaction: {
            to: intent.asset_in?.address || '',
            data: '0xapprove', // Would be actual encoded data
            gas_limit: 50000
          },
          expected_result: {
            asset_in: intent.asset_in?.symbol
          },
          validation: {
            required: true,
            condition: 'allowance_sufficient',
            timeout_seconds: 60
          },
          on_failure: 'abort',
          max_retries: 1
        });
      }
      
      // Step 3: Execute swap
      steps.push({
        step_number: intent.asset_in?.symbol === 'ETH' ? 2 : 3,
        type: 'swap',
        description: `Swap ${intent.amount?.value} USD of ${intent.asset_in?.symbol} to ${intent.asset_out?.symbol}`,
        transaction: {
          to: '0xrouter', // Would be actual DEX router
          value: intent.asset_in?.symbol === 'ETH' ? String(intent.amount?.value) : '0',
          data: '0xswap', // Would be actual encoded data
          gas_limit: 200000
        },
        expected_result: {
          asset_in: intent.asset_in?.symbol,
          asset_out: intent.asset_out?.symbol,
          amount_in: intent.amount?.value ?? 0,
          amount_out: (intent.amount?.value ?? 0) * 0.99 // Estimate with 1% slippage
        },
        validation: {
          required: true,
          condition: 'balance_increased',
          timeout_seconds: 180
        },
        on_failure: 'rollback',
        max_retries: 0
      });
      break;
      
    case 'buy':
    case 'sell':
      // Similar pattern for direct buys/sells
      steps.push({
        step_number: 1,
        type: 'validate_price',
        description: `Validate ${intent.asset_out?.symbol || intent.asset_in?.symbol} price`,
        expected_result: {
          price: state.market.asset_prices[intent.asset_out?.symbol || intent.asset_in?.symbol || '']
        },
        validation: {
          required: true,
          condition: 'price_fresh',
          timeout_seconds: 30
        },
        on_failure: 'abort',
        max_retries: 2
      });
      break;
      
    default:
      // Other action types would be implemented here
      break;
  }
  
  return steps;
}

/**
 * Assess execution-time risks
 */
function assessExecutionRisk(
  proposal: OpportunityProposal,
  state: StateSnapshot,
  steps: ExecutionStep[]
): ExecutionRiskAssessment {
  const flags: RiskFlag[] = [];
  
  // Check volatility
  if (proposal.confidence < 0.6) {
    flags.push('high_volatility');
  }
  
  // Check network congestion
  if (state.market.network_congestion === 'high') {
    flags.push('network_congestion');
    flags.push('high_gas_cost');
  }
  
  // Calculate expected slippage
  const expectedSlippage = proposal.constraints.slippage_tolerance_percent * 0.5;
  
  // Worst case: full slippage tolerance
  const amount = proposal.intent?.amount?.value || 0;
  const worstCaseLoss = amount * (proposal.constraints.slippage_tolerance_percent / 100);
  
  return {
    slippage_expected: expectedSlippage,
    slippage_max: proposal.constraints.slippage_tolerance_percent,
    worst_case_loss_usd: worstCaseLoss,
    worst_case_loss_percent: proposal.constraints.slippage_tolerance_percent,
    execution_probability: proposal.confidence * (flags.length > 0 ? 0.8 : 1.0),
    flags
  };
}

/**
 * Generate pre-execution validation checks
 */
function generatePreChecks(
  proposal: OpportunityProposal,
  steps: ExecutionStep[]
): PreExecutionCheck[] {
  const checks: PreExecutionCheck[] = [];
  
  // Balance check
  if (proposal.intent?.asset_in) {
    checks.push({
      check_id: 'sufficient_balance',
      description: `Sufficient ${proposal.intent.asset_in.symbol} balance`,
      condition: 'balance >= amount + gas',
      required: true,
      verification: {
        type: 'balance',
        target: proposal.intent.asset_in.symbol,
        operator: 'gte',
        value: (proposal.intent.amount?.value || 0) * 1.1 // 10% buffer for gas
      }
    });
  }
  
  // Price freshness check
  if (proposal.intent?.asset_out) {
    checks.push({
      check_id: 'price_fresh',
      description: `${proposal.intent.asset_out.symbol} price is fresh`,
      condition: 'price updated within 60 seconds',
      required: true,
      verification: {
        type: 'price',
        target: proposal.intent.asset_out.symbol,
        operator: 'gte',
        value: 0 // Any valid price
      }
    });
  }
  
  return checks;
}

/**
 * Generate rollback steps for each execution step
 */
function generateRollbackSteps(steps: ExecutionStep[]): RollbackStep[] {
  const rollbacks: RollbackStep[] = [];
  
  for (const step of steps) {
    if (step.type === 'swap') {
      rollbacks.push({
        step_number: step.step_number,
        trigger: 'swap_failed_or_slippage_exceeded',
        action: 'reverse_swap_if_partial_fill'
      });
    } else if (step.type === 'approve_token') {
      rollbacks.push({
        step_number: step.step_number,
        trigger: 'subsequent_step_failed',
        action: 'revoke_approval'
      });
    }
  }
  
  return rollbacks;
}