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
import { recordValidation } from '../telemetry/Telemetry.js';

// In-memory idempotency cache: key -> { result, timestamp }
const idempotencyCache = new Map();
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Validation for OpportunityProposal v1 (must match published JSON Schema)
function validateProposalSchema(body, agentId) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: [{ message: 'Request body must be an object' }] };
  }

  const allowedFields = [
    'proposal_id',
    'session_id',
    'asset',
    'direction',
    'amount_usd',
    'entry_price',
    'leverage',
    'stop_loss',
    'take_profit',
    'rationale',
    'agent_id',
    'policy_set_id',
    'metadata'
  ];

  // additionalProperties: false
  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      errors.push({ field: key, message: `Unknown field '${key}' is not allowed` });
    }
  }

  // Required fields (including session_id)
  const required = ['proposal_id', 'session_id', 'asset', 'direction', 'amount_usd', 'entry_price', 'agent_id', 'policy_set_id'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      errors.push({ field, message: `Required field '${field}' is missing` });
    }
  }

  // proposal_id format: ^prop_[0-9]+_[a-z0-9]+$
  if (body.proposal_id !== undefined) {
    if (typeof body.proposal_id !== 'string') {
      errors.push({ field: 'proposal_id', message: 'proposal_id must be a string' });
    } else if (!/^prop_[0-9]+_[a-z0-9]+$/.test(body.proposal_id)) {
      errors.push({ field: 'proposal_id', message: 'proposal_id must match ^prop_[0-9]+_[a-z0-9]+$' });
    }
  }

  if (body.session_id !== undefined && typeof body.session_id !== 'string') {
    errors.push({ field: 'session_id', message: 'session_id must be a string' });
  }

  if (body.asset !== undefined && typeof body.asset !== 'string') {
    errors.push({ field: 'asset', message: 'asset must be a string' });
  }

  if (body.direction !== undefined && !['buy', 'sell'].includes(body.direction)) {
    errors.push({ field: 'direction', message: 'direction must be "buy" or "sell"' });
  }

  if (body.amount_usd !== undefined && (typeof body.amount_usd !== 'number' || body.amount_usd < 0.01)) {
    errors.push({ field: 'amount_usd', message: 'amount_usd must be a number >= 0.01' });
  }

  if (body.entry_price !== undefined && (typeof body.entry_price !== 'number' || body.entry_price <= 0)) {
    errors.push({ field: 'entry_price', message: 'entry_price must be a positive number' });
  }

  if (body.leverage !== undefined && (typeof body.leverage !== 'number' || body.leverage < 1)) {
    errors.push({ field: 'leverage', message: 'leverage must be a number >= 1' });
  }

  const numOrNull = (v) => v === null || (typeof v === 'number' && v > 0);

  if (body.stop_loss !== undefined && !numOrNull(body.stop_loss)) {
    errors.push({ field: 'stop_loss', message: 'stop_loss must be a positive number or null' });
  }

  if (body.take_profit !== undefined && !numOrNull(body.take_profit)) {
    errors.push({ field: 'take_profit', message: 'take_profit must be a positive number or null' });
  }

  if (body.rationale !== undefined && body.rationale !== null && typeof body.rationale !== 'string') {
    errors.push({ field: 'rationale', message: 'rationale must be a string or null' });
  }

  if (body.agent_id !== undefined && typeof body.agent_id !== 'string') {
    errors.push({ field: 'agent_id', message: 'agent_id must be a string' });
  }

  // Enforce agent_id matches authenticated agent
  if (body.agent_id && agentId && body.agent_id !== agentId) {
    errors.push({ field: 'agent_id', message: 'agent_id must match authenticated agent (X-Agent-Key)' });
  }

  if (body.policy_set_id !== undefined && typeof body.policy_set_id !== 'string') {
    errors.push({ field: 'policy_set_id', message: 'policy_set_id must be a string' });
  }

  if (body.metadata !== undefined && body.metadata !== null && (typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
    errors.push({ field: 'metadata', message: 'metadata must be an object or null' });
  }

  return { valid: errors.length === 0, errors };
}

function normalizeProposal(body) {
  // Ensure leverage is always present for deterministic downstream behavior
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.leverage === undefined || body.leverage === null) {
      body.leverage = 1;
    }
  }
  return body;
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
    const agentId = req.agent?.id || 'unknown';

    // Check for idempotency key (scoped per-agent to prevent cache poisoning)
    const rawIdempotencyKey = req.headers['idempotency-key'];
    const idempotencyKey = rawIdempotencyKey ? `${agentId}:${rawIdempotencyKey}` : null;

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
    const schemaResult = validateProposalSchema(req.body, agentId);
    
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
    
    const proposal = normalizeProposal(req.body);
    // agentId already resolved above
    
    // Evaluate against policy
    const result = evaluateProposal(proposal, agentId);
    
    // Record for telemetry
    recordValidation(result);
    
    // Log for audit (async, don't block response)
    logValidation(agentId, proposal, result).catch(console.error);
    
    // Determine status code
    const statusCode = result.valid ? 200 : 422;

    // Ensure 422 responses are standardized with a code
    const responseBody = result.valid ? result : { ...result, code: 'POLICY_VIOLATION' };

    // Cache result if idempotency key provided
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        result: responseBody,
        statusCode,
        timestamp: Date.now()
      });
    }

    // Return result
    res.status(statusCode).json(responseBody);
    
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
