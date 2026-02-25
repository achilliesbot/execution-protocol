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
  // Schema identification
  schema_version: 'v1';
  proposal_id: string;           // UUID v4
  
  // Temporal fields
  timestamp: string;             // ISO 8601 UTC
  expiry: string;                // Proposal invalid after
  
  // Execution context
  execution_domain: ExecutionDomain;
  environment: 'mainnet' | 'testnet' | 'simulation';
  
  // Policy binding (to be filled by Execution Protocol)
  policy_set_id?: string;
  policy_set_hash?: string;
  
  // Opportunity classification
  opportunity_type: OpportunityType;
  
  // Intent (what the LLM wants to do)
  intent: Intent;
  
  // Risk parameters
  risk_budget: RiskBudget;
  
  // Constraints (hard limits)
  constraints: ExecutionConstraints;
  
  // LLM reasoning (non-binding)
  reasoning: ReasoningReceipt;
  
  // Metadata
  confidence: number;            // 0.0 - 1.0
  agent_id: string;              // Originating agent
  session_id: string;            // Execution session
  
  // Optional attestation
  signature?: string;            // Cryptographic signature (optional)
}

export type ExecutionDomain = 
  | 'base'           // Base chain (EVM)
  | 'solana'         // Solana
  | 'ethereum'       // Ethereum mainnet
  | 'cross_chain';   // Multi-domain

export type OpportunityType =
  | 'swap'           // Token swap
  | 'bridge'         // Cross-chain bridge
  | 'stake'          // Staking operation
  | 'lend'           // Lending/DeFi
  | 'deploy'         // Contract deployment
  | 'signal_trade'   // Trading signal
  | 'custom';        // Other (requires explicit approval)

/**
 * Intent — What the LLM wants to accomplish
 * 
 * Typed structure, no freeform text execution allowed.
 */
export interface Intent {
  action: 'buy' | 'sell' | 'swap' | 'stake' | 'unstake' | 'bridge' | 'deploy';
  
  // Asset specification
  asset_in?: Asset;
  asset_out?: Asset;
  
  // Amount specification (either exact or range)
  amount?: {
    type: 'exact' | 'max' | 'percentage_of_portfolio';
    value: number;           // USD value or percentage
    unit: 'usd' | 'token' | 'percentage';
  };
  
  // Target specification (for limit orders)
  target?: {
    type: 'market' | 'limit' | 'twap';  // TWAP = time-weighted average price
    limit_price?: number;
    duration_seconds?: number;  // For TWAP
  };
  
  // Destination (for bridges)
  destination?: {
    domain: ExecutionDomain;
    address?: string;
  };
}

export interface Asset {
  symbol: string;        // ETH, BTC, USDC
  address?: string;      // Contract address
  chain: ExecutionDomain;
  decimals: number;
}

/**
 * Risk Budget — What risk the agent is willing to take
 */
export interface RiskBudget {
  // Maximum loss acceptable
  max_loss_usd: number;
  max_loss_percent: number;      // Percentage of position
  
  // Drawdown tolerance
  max_drawdown_percent: number;  // From entry price
  
  // Position sizing
  position_size_percent: number; // Percentage of total capital
  
  // Risk:Reward ratio
  risk_reward_min: number;       // Minimum R:R (e.g., 2.0)
}

/**
 * Execution Constraints — Hard limits for safety
 */
export interface ExecutionConstraints {
  // Price constraints
  slippage_tolerance_percent: number;  // Max 0.5% - 5%
  
  // Time constraints
  deadline: string;              // ISO 8601, must execute before
  
  // Price protection
  min_price?: number;            // For sells (don't sell below)
  max_price?: number;            // For buys (don't buy above)
  
  // Stop loss (required for risk management)
  stop_loss?: {
    price: number;
    type: 'fixed' | 'trailing';
    trailing_percent?: number;
  };
  
  // Take profit
  take_profit?: {
    price: number;
    type: 'fixed' | 'partial';   // Partial = scale out
    partial_targets?: Array<{price: number; percentage: number}>;
  };
  
  // Execution requirements
  require_success: boolean;      // Fail closed if can't execute perfectly
  allow_partial_fill: boolean;   // Accept partial execution
}

/**
 * Reasoning Receipt — LLM's thought process (non-binding)
 * 
 * This is logged for transparency but NEVER used for execution decisions.
 * Execution Protocol ignores this field entirely.
 */
export interface ReasoningReceipt {
  // Why this opportunity was identified
  signal_sources: string[];      // e.g., ['twitter_sentiment', 'whale_watch']
  
  // Market analysis
  market_conditions: string;
  
  // Why this timing
  timing_rationale: string;
  
  // Risk assessment
  risk_assessment: string;
  
  // Confidence explanation
  confidence_explanation: string;
  
  // Alternative considerations
  alternatives_considered: string[];
  
  // Raw LLM output (for audit)
  raw_llm_output?: string;
}

/**
 * Proposal Validation
 * 
 * Validates that proposal has all required fields
 * Does NOT evaluate against policy (PolicyEngine does that)
 */
export function validateProposalStructure(
  proposal: Partial<OpportunityProposal>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  const required: Array<keyof OpportunityProposal> = [
    'schema_version',
    'proposal_id',
    'timestamp',
    'expiry',
    'execution_domain',
    'opportunity_type',
    'intent',
    'risk_budget',
    'constraints',
    'reasoning',
    'confidence',
    'agent_id',
    'session_id'
  ];
  
  for (const field of required) {
    if (proposal[field] === undefined || proposal[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Schema version check
  if (proposal.schema_version && proposal.schema_version !== 'v1') {
    errors.push(`Invalid schema_version: ${proposal.schema_version}, expected 'v1'`);
  }
  
  // Confidence range check
  if (proposal.confidence !== undefined) {
    if (proposal.confidence < 0 || proposal.confidence > 1) {
      errors.push(`Invalid confidence: ${proposal.confidence}, must be 0.0 - 1.0`);
    }
  }
  
  // Timestamp validity
  if (proposal.timestamp && proposal.expiry) {
    const created = new Date(proposal.timestamp).getTime();
    const expires = new Date(proposal.expiry).getTime();
    if (expires <= created) {
      errors.push('Expiry must be after timestamp');
    }
    
    // Max 24 hour expiry
    const maxExpiry = created + (24 * 60 * 60 * 1000);
    if (expires > maxExpiry) {
      errors.push('Expiry cannot be more than 24 hours after creation');
    }
  }
  
  // Intent validation
  if (proposal.intent) {
    if (!proposal.intent.action) {
      errors.push('Intent missing action');
    }
    
    if (proposal.intent.amount) {
      if (proposal.intent.amount.value <= 0) {
        errors.push('Intent amount must be positive');
      }
    }
  }
  
  // Risk budget validation
  if (proposal.risk_budget) {
    if (proposal.risk_budget.max_loss_usd < 0) {
      errors.push('max_loss_usd cannot be negative');
    }
    if (proposal.risk_budget.max_drawdown_percent < 0 || 
        proposal.risk_budget.max_drawdown_percent > 100) {
      errors.push('max_drawdown_percent must be 0-100');
    }
  }
  
  // Constraints validation
  if (proposal.constraints) {
    if (proposal.constraints.slippage_tolerance_percent < 0 || 
        proposal.constraints.slippage_tolerance_percent > 50) {
      errors.push('slippage_tolerance_percent must be 0-50');
    }
    
    // Stop loss recommended but not required at schema level
    // (PolicyEngine enforces based on policy)
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a sample/proposal template
 */
export function createProposalTemplate(
  agentId: string,
  sessionId: string
): OpportunityProposal {
  const now = new Date();
  const expiry = new Date(now.getTime() + (4 * 60 * 60 * 1000)); // 4 hours
  
  return {
    schema_version: 'v1',
    proposal_id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: now.toISOString(),
    expiry: expiry.toISOString(),
    execution_domain: 'base',
    environment: 'simulation',
    opportunity_type: 'swap',
    intent: {
      action: 'swap',
      asset_in: {
        symbol: 'USDC',
        chain: 'base',
        decimals: 6
      },
      asset_out: {
        symbol: 'ETH',
        chain: 'base',
        decimals: 18
      },
      amount: {
        type: 'exact',
        value: 50,
        unit: 'usd'
      },
      target: {
        type: 'market'
      }
    },
    risk_budget: {
      max_loss_usd: 5,
      max_loss_percent: 10,
      max_drawdown_percent: 10,
      position_size_percent: 25,
      risk_reward_min: 2.0
    },
    constraints: {
      slippage_tolerance_percent: 1.0,
      deadline: expiry.toISOString(),
      stop_loss: {
        price: 0,
        type: 'fixed'
      },
      require_success: false,
      allow_partial_fill: true
    },
    reasoning: {
      signal_sources: ['template'],
      market_conditions: 'Template proposal - replace with actual analysis',
      timing_rationale: 'Template - replace with actual rationale',
      risk_assessment: 'Template - replace with actual assessment',
      confidence_explanation: 'Template - replace with actual reasoning',
      alternatives_considered: []
    },
    confidence: 0.75,
    agent_id: agentId,
    session_id: sessionId
  };
}