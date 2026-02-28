/**
 * POST /ep/simulate — Simulation endpoint
 * 
 * Validates OpportunityProposal v1 against policy AND returns
 * simulation metrics (expected PnL, drawdown, risk/reward).
 * 
 * Requires X-Agent-Key authentication.
 */

import { evaluateProposal } from '../policy/PolicyEngine.js';
import { recordValidation } from '../telemetry/Telemetry.js';

// Simple validation (same as validate route)
function validateProposalSchema(body) {
  const errors = [];
  
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ message: 'Request body must be an object' }] };
  }
  
  const required = ['proposal_id', 'asset', 'direction', 'amount_usd', 'entry_price', 'agent_id', 'policy_set_id'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      errors.push({ field, message: `Required field '${field}' is missing` });
    }
  }
  
  if (body.proposal_id !== undefined && typeof body.proposal_id !== 'string') {
    errors.push({ field: 'proposal_id', message: 'proposal_id must be a string' });
  }
  
  if (body.asset !== undefined && typeof body.asset !== 'string') {
    errors.push({ field: 'asset', message: 'asset must be a string' });
  }
  
  if (body.direction !== undefined && !['buy', 'sell'].includes(body.direction)) {
    errors.push({ field: 'direction', message: 'direction must be "buy" or "sell"' });
  }
  
  if (body.amount_usd !== undefined && (typeof body.amount_usd !== 'number' || body.amount_usd <= 0)) {
    errors.push({ field: 'amount_usd', message: 'amount_usd must be a positive number' });
  }
  
  if (body.entry_price !== undefined && (typeof body.entry_price !== 'number' || body.entry_price <= 0)) {
    errors.push({ field: 'entry_price', message: 'entry_price must be a positive number' });
  }
  
  if (body.agent_id !== undefined && typeof body.agent_id !== 'string') {
    errors.push({ field: 'agent_id', message: 'agent_id must be a string' });
  }
  
  if (body.policy_set_id !== undefined && typeof body.policy_set_id !== 'string') {
    errors.push({ field: 'policy_set_id', message: 'policy_set_id must be a string' });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate simulation metrics for a trade
 */
function calculateSimulation(proposal, validationResult) {
  const { direction, amount_usd, entry_price, stop_loss, take_profit, leverage = 1 } = proposal;
  
  // Default values if risk parameters not provided
  const hasStopLoss = stop_loss !== undefined && stop_loss !== null && stop_loss > 0;
  const hasTakeProfit = take_profit !== undefined && take_profit !== null && take_profit > 0;
  
  let expected_pnl_usd = 0;
  let max_drawdown_pct = 0;
  let risk_reward_ratio = 0;
  
  if (direction === 'buy') {
    // For buy: profit when price goes up
    if (hasTakeProfit) {
      const priceChange = (take_profit - entry_price) / entry_price;
      expected_pnl_usd = amount_usd * priceChange * leverage;
    }
    
    // Max drawdown is loss to stop loss
    if (hasStopLoss) {
      const drawdown = (entry_price - stop_loss) / entry_price;
      max_drawdown_pct = drawdown * 100 * leverage;
    } else {
      // No stop loss = 100% drawdown risk (lose entire position)
      max_drawdown_pct = 100 * leverage;
    }
    
    // Risk/reward ratio
    if (hasStopLoss && hasTakeProfit) {
      const risk = entry_price - stop_loss;
      const reward = take_profit - entry_price;
      risk_reward_ratio = risk > 0 ? reward / risk : 0;
    }
  } else {
    // For sell: profit when price goes down
    if (hasTakeProfit) {
      const priceChange = (entry_price - take_profit) / entry_price;
      expected_pnl_usd = amount_usd * priceChange * leverage;
    }
    
    // Max drawdown for short is price going up
    if (hasStopLoss) {
      const drawdown = (stop_loss - entry_price) / entry_price;
      max_drawdown_pct = drawdown * 100 * leverage;
    } else {
      max_drawdown_pct = 100 * leverage; // Unlimited upside risk for short
    }
    
    // Risk/reward ratio
    if (hasStopLoss && hasTakeProfit) {
      const risk = stop_loss - entry_price;
      const reward = entry_price - take_profit;
      risk_reward_ratio = risk > 0 ? reward / risk : 0;
    }
  }
  
  // Round to 2 decimal places
  expected_pnl_usd = Math.round(expected_pnl_usd * 100) / 100;
  max_drawdown_pct = Math.round(max_drawdown_pct * 100) / 100;
  risk_reward_ratio = Math.round(risk_reward_ratio * 100) / 100;
  
  return {
    expected_pnl_usd,
    max_drawdown_pct,
    risk_reward_ratio,
    // Additional metadata
    position_size_usd: amount_usd,
    leverage_applied: leverage,
    scenario: hasTakeProfit ? 'target_hit' : 'no_target',
    notes: !hasStopLoss ? 'WARNING: No stop loss defined. Max drawdown assumes 100% loss.' : undefined
  };
}

/**
 * Simulate route handler
 */
export function simulateRoute(req, res) {
  try {
    // Schema validation
    const schemaResult = validateProposalSchema(req.body);
    
    if (!schemaResult.valid) {
      return res.status(400).json({
        code: 'INVALID_SCHEMA',
        error: 'Invalid proposal schema',
        message: 'The request body does not match the OpportunityProposal schema',
        details: schemaResult.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    const proposal = req.body;
    const agentId = req.agent?.id || 'unknown';
    
    // Step 1: Validate against policy
    const validationResult = evaluateProposal(proposal, agentId);
    
    // Record for telemetry
    recordValidation(validationResult);
    
    // Step 2: Calculate simulation metrics
    const simulation = calculateSimulation(proposal, validationResult);
    
    // Log for audit
    console.log('[SIMULATE]', {
      agent: agentId,
      proposal_id: proposal.proposal_id,
      valid: validationResult.valid,
      expected_pnl: simulation.expected_pnl_usd,
      max_drawdown: simulation.max_drawdown_pct,
      risk_reward: simulation.risk_reward_ratio,
      timestamp: new Date().toISOString()
    });
    
    // Build combined response
    const response = {
      // Full VerificationResult v1
      ...validationResult,
      // Simulation data
      simulation
    };
    
    // Return result (200 if valid, 422 if invalid)
    const statusCode = validationResult.valid ? 200 : 422;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      error: 'Internal simulation error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

// GET /ep/proof/:hash — Get verification proof (future)
export function proofRoute(req, res) {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    error: 'Not implemented',
    message: 'Proof retrieval coming in v1.1',
    timestamp: new Date().toISOString()
  });
}

// Session routes (future)
export function sessionRoute(req, res) {
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    error: 'Not implemented',
    message: 'Session management coming in v1.1',
    timestamp: new Date().toISOString()
  });
}

export default { simulateRoute, proofRoute, sessionRoute };
