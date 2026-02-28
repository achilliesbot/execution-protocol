/**
 * POST /ep/validate — Core public endpoint
 * 
 * Validates OpportunityProposal v1 against policy.
 * Returns VerificationResult v1.
 * 
 * Features:
 * - Idempotency key support (10-minute cache)
 * - Standardized error responses
 */

import { evaluateProposal } from '../policy/PolicyEngine.js';

// In-memory idempotency cache: key -> { result, timestamp }
const idempotencyCache = new Map();
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Simple Zod-like validation for OpportunityProposal
function validateProposalSchema(body) {
  const errors = [];
  
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ message: 'Request body must be an object' }] };
  }
  
  // Required fields
  const required = ['proposal_id', 'asset', 'direction', 'amount_usd', 'entry_price', 'agent_id', 'policy_set_id'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      errors.push({ field, message: `Required field '${field}' is missing` });
    }
  }
  
  // Validate types
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
 * Clean expired idempotency cache entries
 */
function cleanIdempotencyCache() {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.timestamp > IDEMPOTENCY_WINDOW_MS) {
      idempotencyCache.delete(key);
    }
  }
}

/**
 * Validate route handler
 */
export function validateRoute(req, res) {
  try {
    // Check for idempotency key
    const idempotencyKey = req.headers['idempotency-key'];
    
    if (idempotencyKey) {
      cleanIdempotencyCache();
      const cached = idempotencyCache.get(idempotencyKey);
      
      if (cached && (Date.now() - cached.timestamp <= IDEMPOTENCY_WINDOW_MS)) {
        // Return cached result
        console.log(`[IDEMPOTENCY] Returning cached result for key: ${idempotencyKey}`);
        return res.status(cached.statusCode).json(cached.result);
      }
    }
    
    // Schema validation
    const schemaResult = validateProposalSchema(req.body);
    
    if (!schemaResult.valid) {
      const errorResponse = {
        code: 'INVALID_SCHEMA',
        error: 'Invalid proposal schema',
        message: 'The request body does not match the OpportunityProposal schema',
        details: schemaResult.errors,
        timestamp: new Date().toISOString()
      };
      
      // Cache error response if idempotency key provided
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          result: errorResponse,
          statusCode: 400,
          timestamp: Date.now()
        });
      }
      
      return res.status(400).json(errorResponse);
    }
    
    const proposal = req.body;
    const agentId = req.agent?.id || 'unknown';
    
    // Evaluate against policy
    const result = evaluateProposal(proposal, agentId);
    
    // Log for audit (async, don't block response)
    logValidation(agentId, proposal, result).catch(console.error);
    
    // Determine status code
    const statusCode = result.valid ? 200 : 422;
    
    // Cache successful result if idempotency key provided
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        result,
        statusCode,
        timestamp: Date.now()
      });
    }
    
    // Return result
    res.status(statusCode).json(result);
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      error: 'Internal validation error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Async audit logging
 */
async function logValidation(agentId, proposal, result) {
  console.log('[AUDIT]', {
    agent: agentId,
    proposal_id: proposal.proposal_id,
    valid: result.valid,
    violations: result.violations.length,
    timestamp: new Date().toISOString()
  });
}

export default { validateRoute };
