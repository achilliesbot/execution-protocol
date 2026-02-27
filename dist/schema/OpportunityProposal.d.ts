/**
 * OpportunityProposal.v1 Schema — Execution Protocol v2
 *
 * The canonical boundary object between LLM and deterministic execution.
 *
 * GOVERNANCE.md §1.1: LLM produces OpportunityProposal.v1 only
 * GOVERNANCE.md §1.2: Proposal ≠ Execution
 * GOVERNANCE.md §3: LLM prohibited from generating ExecutionPlan
 *
 * Build: Sonnet 4.6
 * Review: Codex 5.3
 */
/**
 * OpportunityProposal.v1
 *
 * This is the ONLY output the LLM layer is permitted to generate.
 * It contains probabilistic reasoning, intent, and constraints.
 * It does NOT contain executable instructions.
 */
export interface OpportunityProposal {
    schema_version: 'v1';
    proposal_id: string;
    timestamp: string;
    expiry: string;
    execution_domain: ExecutionDomain;
    environment: 'mainnet' | 'testnet' | 'simulation';
    policy_set_id?: string;
    policy_set_hash?: string;
    opportunity_type: OpportunityType;
    intent: Intent;
    risk_budget: RiskBudget;
    constraints: ExecutionConstraints;
    reasoning: ReasoningReceipt;
    confidence: number;
    agent_id: string;
    session_id: string;
    signature?: string;
}
export type ExecutionDomain = 'base' | 'solana' | 'ethereum' | 'cross_chain';
export type OpportunityType = 'swap' | 'bridge' | 'stake' | 'lend' | 'deploy' | 'signal_trade' | 'custom';
/**
 * Intent — What the LLM wants to accomplish
 *
 * Typed structure, no freeform text execution allowed.
 */
export interface Intent {
    action: 'buy' | 'sell' | 'swap' | 'stake' | 'unstake' | 'bridge' | 'deploy';
    asset_in?: Asset;
    asset_out?: Asset;
    amount?: {
        type: 'exact' | 'max' | 'percentage_of_portfolio';
        value: number;
        unit: 'usd' | 'token' | 'percentage';
    };
    target?: {
        type: 'market' | 'limit' | 'twap';
        limit_price?: number;
        duration_seconds?: number;
    };
    destination?: {
        domain: ExecutionDomain;
        address?: string;
    };
}
export interface Asset {
    symbol: string;
    address?: string;
    chain: ExecutionDomain;
    decimals: number;
}
/**
 * Risk Budget — What risk the agent is willing to take
 */
export interface RiskBudget {
    max_loss_usd: number;
    max_loss_percent: number;
    max_drawdown_percent: number;
    position_size_percent: number;
    risk_reward_min: number;
}
/**
 * Execution Constraints — Hard limits for safety
 */
export interface ExecutionConstraints {
    slippage_tolerance_percent: number;
    deadline: string;
    min_price?: number;
    max_price?: number;
    stop_loss?: {
        price: number;
        type: 'fixed' | 'trailing';
        trailing_percent?: number;
    };
    take_profit?: {
        price: number;
        type: 'fixed' | 'partial';
        partial_targets?: Array<{
            price: number;
            percentage: number;
        }>;
    };
    require_success: boolean;
    allow_partial_fill: boolean;
}
/**
 * Reasoning Receipt — LLM's thought process (non-binding)
 *
 * This is logged for transparency but NEVER used for execution decisions.
 * Execution Protocol ignores this field entirely.
 */
export interface ReasoningReceipt {
    signal_sources: string[];
    market_conditions: string;
    timing_rationale: string;
    risk_assessment: string;
    confidence_explanation: string;
    alternatives_considered: string[];
    raw_llm_output?: string;
}
/**
 * Proposal Validation
 *
 * Validates that proposal has all required fields
 * Does NOT evaluate against policy (PolicyEngine does that)
 */
export declare function validateProposalStructure(proposal: Partial<OpportunityProposal>): {
    valid: boolean;
    errors: string[];
};
/**
 * Create a sample/proposal template
 */
export declare function createProposalTemplate(agentId: string, sessionId: string): OpportunityProposal;
//# sourceMappingURL=OpportunityProposal.d.ts.map