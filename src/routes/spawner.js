/**
 * Agent Spawner API
 * Allows AI agents to spawn specialized sub-agents
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = Router();

// Spawn new GTM agent
router.post('/spawn', async (req, res) => {
  const { parent_agent_id, target_url, specialty, budget } = req.body;
  
  if (!parent_agent_id || !target_url) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['parent_agent_id', 'target_url'],
      optional: ['specialty', 'budget']
    });
  }
  
  try {
    // Call Python spawner
    const scriptPath = path.join(process.cwd(), '..', 'gtm-agent', 'agent_spawner.py');
    const { stdout } = await promisify(spawn)('python3', [
      scriptPath,
      '--spawn',
      parent_agent_id,
      target_url,
      specialty || 'general',
      budget || '50'
    ]);
    
    res.json({
      status: 'spawned',
      parent: parent_agent_id,
      target: target_url,
      specialty: specialty || 'general',
      budget: budget || 50,
      message: 'GTM sub-agent spawned successfully',
      dashboard: 'https://execution-protocol.onrender.com/#gtm',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Spawn failed',
      message: error.message
    });
  }
});

// List spawned agents
router.get('/spawned', async (req, res) => {
  const { parent } = req.query;
  
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
});

// Get spawn stats
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
