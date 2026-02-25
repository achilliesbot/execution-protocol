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
 * Proposal Validation
 *
 * Validates that proposal has all required fields
 * Does NOT evaluate against policy (PolicyEngine does that)
 */
export function validateProposalStructure(proposal) {
    const errors = [];
    // Required fields
    const required = [
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
export function createProposalTemplate(agentId, sessionId) {
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
