"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExecutionPlan = generateExecutionPlan;
var policy_1 = require("../policy");
var canonicalization_1 = require("../canonicalization");
/**
 * Generate ExecutionPlan from Proposal + Policy + State
 *
 * This is the core deterministic transformation.
 * GOVERNANCE.md §1.2: Only deterministic layer creates ExecutionPlan.
 */
function generateExecutionPlan(proposal, policySet, stateSnapshot) {
    // Step 1: Validate proposal against policy set
    var validation = (0, policy_1.validateAgainstPolicySet)(proposal, policySet, stateSnapshot);
    if (!validation.valid) {
        // Check if any violations are blockers
        var blockers = validation.violations.filter(function (v) { return v.action === 'block'; });
        if (blockers.length > 0) {
            return {
                plan: null,
                error: "Policy violations block execution: ".concat(blockers.map(function (v) { return v.message; }).join(', '))
            };
        }
        // If only warnings/escalations, we can proceed but log them
        console.warn('Policy warnings:', validation.violations);
    }
    // Step 2: Generate execution steps based on intent
    var steps = generateSteps(proposal, stateSnapshot);
    if (steps.length === 0) {
        return {
            plan: null,
            error: 'Could not generate execution steps for intent'
        };
    }
    // Step 3: Calculate execution risk
    var executionRisk = assessExecutionRisk(proposal, stateSnapshot, steps);
    // Step 4: Generate pre-execution checks
    var preChecks = generatePreChecks(proposal, steps);
    // Step 5: Generate rollback plan
    var rollbackSteps = generateRollbackSteps(steps);
    // Step 6: Compute plan expiry (sooner of proposal expiry or 1 hour)
    var proposalExpiry = new Date(proposal.expiry).getTime();
    var oneHourFromNow = Date.now() + (60 * 60 * 1000);
    var planExpiry = new Date(Math.min(proposalExpiry, oneHourFromNow));
    // Step 7: Assemble ExecutionPlan
    var plan = {
        schema_version: 'v1',
        plan_id: "plan_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)),
        proposal_id: proposal.proposal_id,
        proposal_hash: (0, canonicalization_1.computeProposalHash)(proposal),
        policy_set_id: policySet.id,
        policy_set_hash: validation.policySetHash,
        validation_result: validation,
        state_snapshot: stateSnapshot,
        steps: steps,
        constraints: proposal.constraints,
        execution_risk: executionRisk,
        generated_at: new Date().toISOString(),
        generated_by: proposal.agent_id,
        expiry: planExpiry.toISOString(),
        pre_checks: preChecks,
        rollback_steps: rollbackSteps
    };
    return { plan: plan };
}
/**
 * Generate execution steps from intent
 */
function generateSteps(proposal, state) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    var steps = [];
    var intent = proposal.intent;
    if (!intent)
        return steps;
    switch (intent.action) {
        case 'swap':
            // Step 1: Validate balances
            steps.push({
                step_number: 1,
                type: 'validate_balance',
                description: "Verify ".concat((_a = intent.asset_in) === null || _a === void 0 ? void 0 : _a.symbol, " balance"),
                expected_result: {
                    asset_in: (_b = intent.asset_in) === null || _b === void 0 ? void 0 : _b.symbol,
                    amount_in: (_c = intent.amount) === null || _c === void 0 ? void 0 : _c.value
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
            if (((_d = intent.asset_in) === null || _d === void 0 ? void 0 : _d.symbol) !== 'ETH') {
                steps.push({
                    step_number: 2,
                    type: 'approve_token',
                    description: "Approve ".concat((_e = intent.asset_in) === null || _e === void 0 ? void 0 : _e.symbol, " for swap"),
                    transaction: {
                        to: ((_f = intent.asset_in) === null || _f === void 0 ? void 0 : _f.address) || '',
                        data: '0xapprove', // Would be actual encoded data
                        gas_limit: 50000
                    },
                    expected_result: {
                        asset_in: (_g = intent.asset_in) === null || _g === void 0 ? void 0 : _g.symbol
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
                step_number: ((_h = intent.asset_in) === null || _h === void 0 ? void 0 : _h.symbol) === 'ETH' ? 2 : 3,
                type: 'swap',
                description: "Swap ".concat((_j = intent.amount) === null || _j === void 0 ? void 0 : _j.value, " USD of ").concat((_k = intent.asset_in) === null || _k === void 0 ? void 0 : _k.symbol, " to ").concat((_l = intent.asset_out) === null || _l === void 0 ? void 0 : _l.symbol),
                transaction: {
                    to: '0xrouter', // Would be actual DEX router
                    value: ((_m = intent.asset_in) === null || _m === void 0 ? void 0 : _m.symbol) === 'ETH' ? String((_o = intent.amount) === null || _o === void 0 ? void 0 : _o.value) : '0',
                    data: '0xswap', // Would be actual encoded data
                    gas_limit: 200000
                },
                expected_result: {
                    asset_in: (_p = intent.asset_in) === null || _p === void 0 ? void 0 : _p.symbol,
                    asset_out: (_q = intent.asset_out) === null || _q === void 0 ? void 0 : _q.symbol,
                    amount_in: (_s = (_r = intent.amount) === null || _r === void 0 ? void 0 : _r.value) !== null && _s !== void 0 ? _s : 0,
                    amount_out: ((_u = (_t = intent.amount) === null || _t === void 0 ? void 0 : _t.value) !== null && _u !== void 0 ? _u : 0) * 0.99 // Estimate with 1% slippage
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
                description: "Validate ".concat(((_v = intent.asset_out) === null || _v === void 0 ? void 0 : _v.symbol) || ((_w = intent.asset_in) === null || _w === void 0 ? void 0 : _w.symbol), " price"),
                expected_result: {
                    price: state.market.asset_prices[((_x = intent.asset_out) === null || _x === void 0 ? void 0 : _x.symbol) || ((_y = intent.asset_in) === null || _y === void 0 ? void 0 : _y.symbol) || '']
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
function assessExecutionRisk(proposal, state, steps) {
    var _a, _b;
    var flags = [];
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
    var expectedSlippage = proposal.constraints.slippage_tolerance_percent * 0.5;
    // Worst case: full slippage tolerance
    var amount = ((_b = (_a = proposal.intent) === null || _a === void 0 ? void 0 : _a.amount) === null || _b === void 0 ? void 0 : _b.value) || 0;
    var worstCaseLoss = amount * (proposal.constraints.slippage_tolerance_percent / 100);
    return {
        slippage_expected: expectedSlippage,
        slippage_max: proposal.constraints.slippage_tolerance_percent,
        worst_case_loss_usd: worstCaseLoss,
        worst_case_loss_percent: proposal.constraints.slippage_tolerance_percent,
        execution_probability: proposal.confidence * (flags.length > 0 ? 0.8 : 1.0),
        flags: flags
    };
}
/**
 * Generate pre-execution validation checks
 */
function generatePreChecks(proposal, steps) {
    var _a, _b, _c;
    var checks = [];
    // Balance check
    if ((_a = proposal.intent) === null || _a === void 0 ? void 0 : _a.asset_in) {
        checks.push({
            check_id: 'sufficient_balance',
            description: "Sufficient ".concat(proposal.intent.asset_in.symbol, " balance"),
            condition: 'balance >= amount + gas',
            required: true,
            verification: {
                type: 'balance',
                target: proposal.intent.asset_in.symbol,
                operator: 'gte',
                value: (((_b = proposal.intent.amount) === null || _b === void 0 ? void 0 : _b.value) || 0) * 1.1 // 10% buffer for gas
            }
        });
    }
    // Price freshness check
    if ((_c = proposal.intent) === null || _c === void 0 ? void 0 : _c.asset_out) {
        checks.push({
            check_id: 'price_fresh',
            description: "".concat(proposal.intent.asset_out.symbol, " price is fresh"),
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
function generateRollbackSteps(steps) {
    var rollbacks = [];
    for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
        var step = steps_1[_i];
        if (step.type === 'swap') {
            rollbacks.push({
                step_number: step.step_number,
                trigger: 'swap_failed_or_slippage_exceeded',
                action: 'reverse_swap_if_partial_fill'
            });
        }
        else if (step.type === 'approve_token') {
            rollbacks.push({
                step_number: step.step_number,
                trigger: 'subsequent_step_failed',
                action: 'revoke_approval'
            });
        }
    }
    return rollbacks;
}
