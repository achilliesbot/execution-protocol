/**
 * Agent Authentication Layer
 * 
 * All routes except /ep/health and /ep/status require X-Agent-Key header.
 * Invalid or missing key returns 401.
 */

import { createHash } from 'crypto';

export interface Agent {
  id: string;
  key: string;
  tier: 'internal' | 'external' | 'enterprise';
}

export interface AuthResult {
  valid: boolean;
  agent_id?: string;
  tier?: string;
  error?: string;
}

// Agent registry — loaded dynamically to support runtime env changes
function getAgentRegistry(): Record<string, Agent> {
  return {
    achilles: {
      id: 'achilles',
      key: process.env.EP_KEY_ACHILLES_1 || process.env.EP_KEY_ACHILLES || '',
      tier: 'internal'
    },
    argus: {
      id: 'argus',
      key: process.env.EP_KEY_ARGUS || '',
      tier: 'internal'
    },
    atlas: {
      id: 'atlas',
      key: process.env.EP_KEY_ATLAS || '',
      tier: 'internal'
    }
  };
}

/**
 * Validate X-Agent-Key header
 */
export function validateAgentKey(keyHeader: string | undefined): AuthResult {
  if (!keyHeader) {
    return { valid: false, error: 'Missing X-Agent-Key header' };
  }

  // Find agent by key
  const registry = getAgentRegistry();
  for (const [agentId, agent] of Object.entries(registry)) {
    if (agent.key && keyHeader === agent.key) {
      return {
        valid: true,
        agent_id: agentId,
        tier: agent.tier
      };
    }
  }

  return { valid: false, error: 'Invalid X-Agent-Key' };
}

/**
 * Express middleware for auth
 */
export function agentAuthMiddleware(req: any, res: any, next: any) {
  // Skip auth for health and status endpoints
  if (req.path === '/ep/health' || req.path === '/ep/status') {
    return next();
  }

  const keyHeader = req.headers['x-agent-key'];
  const result = validateAgentKey(keyHeader);

  if (!result.valid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: result.error,
      timestamp: new Date().toISOString()
    });
  }

  // Attach agent info to request
  req.agent = {
    id: result.agent_id,
    tier: result.tier
  };

  next();
}

export default { validateAgentKey, agentAuthMiddleware };
