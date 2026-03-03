/**
 * Policy Engine — Agent-agnostic constraint evaluation
 * 
 * Receives OpportunityProposal v1 and policy_set_id,
 * loads policy from PolicyRegistry, evaluates all constraints,
 * returns VerificationResult v1.
 * 
 * Zero Achilles-specific references. Pure business logic.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Load policy from registry
 */
function loadPolicy(policySetId) {
  try {
    const policyPath = join(process.cwd(), 'src', 'policy', 'policies', `${policySetId}.json`);
    const content = readFileSync(policyPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load policy ${policySetId}:`, error);
    return null;
  }
}

/**
 * Calculate risk score based on violations
 */
function calculateRiskScore(violations) {
  if (violations.length === 0) return 'LOW';
  
  const criticalTypes = ['stop_loss_missing', 'take_profit_missing', 'unauthorized_asset'];
  const hasCritical = violations.some(v => criticalTypes.includes(v.type));
  
  if (hasCritical) return 'CRITICAL';
  if (violations.length > 2) return 'HIGH';
  if (violations.length > 0) return 'MEDIUM';
  
  return 'LOW';
}

/**
 * Evaluate proposal against policy
 */
export function evaluateProposal(proposal, agentId) {
  const violations = [];
  
  // Load policy
  const policy = loadPolicy(proposal.policy_set_id);
  if (!policy) {
    violations.push({
      type: 'policy_not_found',
      field: 'policy_set_id',
      constraint: 'valid_policy',
      actual: proposal.policy_set_id,
      limit: 'existing_policy',
      message: `Policy set ${proposal.policy_set_id} not found`
    });
    
    return createResult(proposal, violations, agentId, null);
  }
  
  const c = policy.constraints;
  
  // Check allowed assets (wildcard "*" allows all assets)
  const allowsAllAssets = c.allowed_assets.includes('*');
  if (!allowsAllAssets && !c.allowed_assets.includes(proposal.asset)) {
    violations.push({
      type: 'unauthorized_asset',
      field: 'asset',
      constraint: 'allowed_assets',
      actual: proposal.asset,
      limit: c.allowed_assets.join(','),
      message: `Asset ${proposal.asset} not in allowed list`
    });
  }
  
  // Check max position
  if (proposal.amount_usd > c.max_single_position) {
    violations.push({
      type: 'position_oversized',
      field: 'amount_usd',
      constraint: 'max_single_position',
      actual: proposal.amount_usd,
      limit: c.max_single_position,
      message: `Position $${proposal.amount_usd} exceeds $${c.max_single_position} max`
    });
  }
  
  // Check leverage
  if (proposal.leverage > c.max_leverage) {
    violations.push({
      type: 'excessive_leverage',
      field: 'leverage',
      constraint: 'max_leverage',
      actual: proposal.leverage,
      limit: c.max_leverage,
      message: `Leverage ${proposal.leverage}x exceeds ${c.max_leverage}x max`
    });
  }
  
  // Check stop loss
  if (c.stop_loss_required && !proposal.stop_loss) {
    violations.push({
      type: 'stop_loss_missing',
      field: 'stop_loss',
      constraint: 'stop_loss_required',
      actual: null,
      limit: 'required',
      message: 'Stop loss is required'
    });
  }
  
  // Check take profit
  if (c.take_profit_required && !proposal.take_profit) {
    violations.push({
      type: 'take_profit_missing',
      field: 'take_profit',
      constraint: 'take_profit_required',
      actual: null,
      limit: 'required',
      message: 'Take profit is required'
    });
  }
  
  return createResult(proposal, violations, agentId, policy);
}

/**
 * Create verification result
 */
function createResult(proposal, violations, agentId, policy) {
  const leverage = proposal.leverage ?? 1;
  const planSummary = `${proposal.asset} ${proposal.direction.toUpperCase()} $${proposal.amount_usd} @ ${proposal.entry_price} | SL: ${proposal.stop_loss} | TP: ${proposal.take_profit} | ${leverage}x`;
  
  // Deterministic hash: exclude timestamp to ensure identical proposals = identical hashes
  const hashData = {
    proposal,
    violations,
    agentId
  };
  
  return {
    valid: violations.length === 0,
    risk_score: calculateRiskScore(violations),
    violations,
    proof_hash: createHash('sha256').update(JSON.stringify(hashData)).digest('hex').slice(0, 32),
    plan_summary: planSummary,
    policy_set_hash: createHash('sha256')
      .update(policy ? JSON.stringify(policy) : 'missing')
      .digest('hex')
      .slice(0, 32),
    session_id: proposal.session_id || null,
    timestamp: new Date().toISOString(),
    pricing_version: 'free-v1',
    payment_receipt: null,
    base_pay_ready: false
  };
}

export default { evaluateProposal };
