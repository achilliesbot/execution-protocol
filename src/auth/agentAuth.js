/**
 * Agent Authentication Layer
 * 
 * All routes except /ep/health, /ep/status, /schemas/* require X-Agent-Key header.
 * Invalid or missing key returns 401 with standardized error format.
 */

// Agent registry — loaded dynamically to support runtime env changes
function getAgentRegistry() {
  return {
    achilles: {
      id: 'achilles',
      key: process.env.EP_KEY_ACHILLES_1 || process.env.EP_KEY_ACHILLES || '',
      tier: 'internal'
    },
    argus: {
      id: 'argus',
      key: process.env.EP_KEY_ARGUS_1 || process.env.EP_KEY_ARGUS || '',
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
export function validateAgentKey(keyHeader) {
  if (!keyHeader) {
    return { 
      valid: false, 
      code: 'UNAUTHORIZED',
      error: 'Missing X-Agent-Key header',
      message: 'The X-Agent-Key header is required for this endpoint'
    };
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

  return { 
    valid: false, 
    code: 'UNAUTHORIZED',
    error: 'Invalid X-Agent-Key',
    message: 'The provided X-Agent-Key is not recognized'
  };
}

/**
 * Express middleware for auth
 */
export function agentAuthMiddleware(req, res, next) {
  // Skip auth for public endpoints
  const publicPaths = ['/ep/health', '/ep/status'];
  const isPublicPath = publicPaths.includes(req.path) || req.path.startsWith('/schemas/') || req.path.startsWith('/telemetry/');
  
  if (isPublicPath) {
    return next();
  }

  const keyHeader = req.headers['x-agent-key'];
  const result = validateAgentKey(keyHeader);

  if (!result.valid) {
    return res.status(401).json({
      code: result.code,
      error: result.error,
      message: result.message,
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
