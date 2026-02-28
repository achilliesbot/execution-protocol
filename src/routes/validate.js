/**
 * POST /ep/validate — Core public endpoint
 * 
 * Validates OpportunityProposal v1 against policy.
 * Returns VerificationResult v1.
 */

import { z } from 'zod';
import { evaluateProposal } from '../policy/PolicyEngine.js';

// Zod schema for OpportunityProposal v1
const OpportunityProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  asset: z.string().min(1),
  direction: z.enum(['buy', 'sell']),
  amount_usd: z.number().positive(),
  entry_price: z.number().positive(),
  stop_loss: z.number().positive().optional(),
  take_profit: z.number().positive().optional(),
  leverage: z.number().min(1).default(1),
  policy_set_id: z.string().default('olympus-v1'),
  chain: z.string().default('base'),
  reasoning_receipt: z.string().optional()
});

/**
 * Validate route handler
 */
export function validateRoute(req, res) {
  try {
    // Schema validation
    const parseResult = OpportunityProposalSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid proposal schema',
        details: parseResult.error.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    const proposal = parseResult.data;
    const agentId = req.agent?.id || 'unknown';
    
    // Evaluate against policy
    const result = evaluateProposal(proposal, agentId);
    
    // Log for audit (async, don't block response)
    logValidation(agentId, proposal, result).catch(console.error);
    
    // Return result
    res.status(result.valid ? 200 : 422).json(result);
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Internal validation error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Async audit logging
 */
async function logValidation(agentId, proposal, result) {
  // TODO: Write to audit log / transcript
  // For now, console log
  console.log('[AUDIT]', {
    agent: agentId,
    proposal_id: proposal.proposal_id,
    valid: result.valid,
    violations: result.violations.length,
    timestamp: new Date().toISOString()
  });
}

export default { validateRoute };
