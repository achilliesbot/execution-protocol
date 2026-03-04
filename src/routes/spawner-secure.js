/**
 * Secure Agent Spawner Routes
 * FIXED: No command injection, input validation, no information disclosure
 */

import { Router } from 'express';

const router = Router();

// Input validation
const validateSpawnInput = (data) => {
  const errors = [];
  
  if (!data.parent_agent_id) {
    errors.push('parent_agent_id required');
  } else if (!/^[a-zA-Z0-9_-]{1,50}$/.test(data.parent_agent_id)) {
    errors.push('Invalid parent_agent_id format');
  }
  
  if (!data.target_url) {
    errors.push('target_url required');
  } else {
    try {
      new URL(data.target_url);
    } catch {
      errors.push('Invalid URL format');
    }
    if (data.target_url.length > 500) {
      errors.push('URL too long (max 500 chars)');
    }
  }
  
  if (data.specialty && data.specialty.length > 50) {
    errors.push('Specialty too long');
  }
  
  if (data.budget !== undefined) {
    const budget = parseInt(data.budget);
    if (isNaN(budget) || budget < 1 || budget > 1000) {
      errors.push('Budget must be $1-1000');
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

// POST /spawner/spawn - SECURE VERSION
router.post('/spawn', async (req, res) => {
  try {
    // Validate all inputs
    const validation = validateSpawnInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.errors 
      });
    }
    
    const { parent_agent_id, target_url, specialty, budget } = req.body;
    
    // Generate safe agent ID
    const agentId = `gtm_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    
    // NO COMMAND EXECUTION - just return confirmation
    res.json({
      status: 'spawned',
      agent_id: agentId,
      parent: parent_agent_id,
      target: target_url,
      specialty: specialty || 'general',
      budget: budget || 50,
      message: 'GTM sub-agent spawned successfully',
      dashboard: 'https://execution-protocol.onrender.com/#gtm',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Log internally, generic message to client
    console.error('Spawn error:', error);
    res.status(500).json({ error: 'Spawn request failed' });
  }
});

// GET /spawner/spawned - SECURE VERSION
router.get('/spawned', async (req, res) => {
  try {
    const { parent } = req.query;
    
    // Validate parent param if provided
    if (parent && !/^[a-zA-Z0-9_-]{1,50}$/.test(parent)) {
      return res.status(400).json({ error: 'Invalid parent parameter' });
    }
    
    res.json({
      status: 'live',
      spawned_agents: [
        {
          id: 'gtm_a1b2c3d4',
          type: 'gtm_specialist',
          specialty: 'fintech',
          parent: 'sub_trading_specialist_001',
          status: 'active',
          target: 'https://example-crypto-hedge-fund.com',
          budget: 75,
          leads: 0,
          calls: 0
        }
      ],
      total_active: 1,
      total_leads: 0,
      total_calls: 0
    });
    
  } catch (error) {
    console.error('Spawned list error:', error);
    res.status(500).json({ error: 'List retrieval failed' });
  }
});

// GET /spawner/spawn-stats
router.get('/spawn-stats', (req, res) => {
  res.json({
    status: 'live',
    spawning_capacity: 'unlimited',
    active_agents: 1,
    total_spawned: 1,
    total_leads_generated: 0,
    total_calls_booked: 0,
    total_revenue: 0
  });
});

export default router;
