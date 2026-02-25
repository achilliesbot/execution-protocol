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
import { PolicySet, ValidationResult } from '../policy';
/**
 * ExecutionPlan.v1
 *
 * The ONLY object that can be executed by the system.
 * Generated deterministically by Execution Protocol core.
 * Never created or modified by LLM layer.
 */
export interface ExecutionPlan {
    schema_version: 'v1';
    plan_id: string;
    proposal_id: string;
    proposal_hash: string;
    policy_set_id: string;
    policy_set_hash: string;
    validation_result: ValidationResult;
    state_snapshot: StateSnapshot;
    steps: ExecutionStep[];
    constraints: ExecutionConstraints;
    execution_risk: ExecutionRiskAssessment;
    generated_at: string;
    generated_by: string;
    expiry: string;
    pre_checks: PreExecutionCheck[];
    rollback_steps: RollbackStep[];
}
export interface StateSnapshot {
    timestamp: string;
    block_height?: number;
    portfolio: {
        total_value_usd: number;
        available_capital_usd: number;
        allocated_capital_usd: number;
        positions: Position[];
    };
    market: {
        asset_prices: Record<string, number>;
        gas_prices?: Record<string, number>;
        network_congestion?: 'low' | 'medium' | 'high';
    };
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
    description: string;
    transaction?: {
        to: string;
        data?: string;
        value?: string;
        gas_limit: number;
        max_fee_per_gas?: string;
        max_priority_fee_per_gas?: string;
    };
    expected_result: {
        asset_in?: string;
        asset_out?: string;
        amount_in?: number;
        amount_out?: number;
        price?: number;
    };
    validation: {
        required: boolean;
        condition: string;
        timeout_seconds: number;
    };
    on_failure: 'abort' | 'retry' | 'rollback';
    max_retries: number;
}
export type ExecutionStepType = 'approve_token' | 'swap' | 'bridge' | 'stake' | 'unstake' | 'claim' | 'deploy' | 'validate_balance' | 'validate_price';
export interface ExecutionRiskAssessment {
    slippage_expected: number;
    slippage_max: number;
    worst_case_loss_usd: number;
    worst_case_loss_percent: number;
    execution_probability: number;
    flags: RiskFlag[];
}
export type RiskFlag = 'high_volatility' | 'low_liquidity' | 'network_congestion' | 'price_stale' | 'high_gas_cost';
export interface PreExecutionCheck {
    check_id: string;
    description: string;
    condition: string;
    required: boolean;
    verification: {
        type: 'balance' | 'price' | 'allowance' | 'network';
        target: string;
        operator: 'gte' | 'lte' | 'eq';
        value: number | string;
    };
}
export interface RollbackStep {
    step_number: number;
    trigger: string;
    action: string;
    transaction?: ExecutionStep['transaction'];
}
/**
 * Generate ExecutionPlan from Proposal + Policy + State
 *
 * This is the core deterministic transformation.
 * GOVERNANCE.md §1.2: Only deterministic layer creates ExecutionPlan.
 */
export declare function generateExecutionPlan(proposal: OpportunityProposal, policySet: PolicySet, stateSnapshot: StateSnapshot): {
    plan: ExecutionPlan | null;
    error?: string;
};
//# sourceMappingURL=ExecutionPlanGenerator.d.ts.map