/**
 * Agent Spawner API - SECURE VERSION
 * Allows AI agents to spawn specialized sub-agents
 * 
 * Security fixes:
 * - No user input passed to spawn()
 * - Input validation for all parameters
 * - File-based data retrieval only
 * - Generic error messages
 */

import { Router } from 'express';
import { readFile } from 'fs/promises';
import path from 'path';

const router = Router();

// Validation constants
const AGENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;
const URL_MAX_LENGTH = 500;
const VALID_SPECIALTIES = ['general', 'fintech', 'crypto', 'saas', 'enterprise', 'healthcare', 'ecommerce'];
const MIN_BUDGET = 1;
const MAX_BUDGET = 1000;

/**
 * Validate URL format and length
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.length > URL_MAX_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate agent ID format
 * @param {string} id - Agent ID to validate
 * @returns {boolean} - True if valid
 */
function isValidAgentId(id) {
  return typeof id === 'string' && AGENT_ID_REGEX.test(id);
}

/**
 * Get spawner data from file (no command execution)
 * @returns {Promise<Object>} - Spawner data
 */
async function getSpawnerData() {
  const dataPath = path.join(process.cwd(), 'data', 'live', 'spawner_data.json');
  try {
    const data = await readFile(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default structure if file doesn't exist
    return {
      spawned_agents: [],
      total_active: 0,
      total_leads: 0,
      total_calls: 0,
      last_updated: new Date().toISOString()
    };
  }
}

/**
 * Save spawner data to file
 * @param {Object} data - Data to save
 */
async function saveSpawnerData(data) {
  const dataPath = path.join(process.cwd(), 'data', 'live', 'spawner_data.json');
  const fs = await import('fs/promises');
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

// Spawn new GTM agent
router.post('/spawn', async (req, res) => {
  const { parent_agent_id, target_url, specialty, budget } = req.body;
  
  // Validation
  const errors = [];
  
  if (!parent_agent_id) {
    errors.push('parent_agent_id is required');
  } else if (!isValidAgentId(parent_agent_id)) {
    errors.push('parent_agent_id must be 1-50 alphanumeric characters (a-z, A-Z, 0-9, _, -)');
  }
  
  if (!target_url) {
    errors.push('target_url is required');
  } else if (!isValidUrl(target_url)) {
    errors.push('target_url must be a valid HTTP/HTTPS URL (max 500 chars)');
  }
  
  const validatedSpecialty = specialty || 'general';
  if (!VALID_SPECIALTIES.includes(validatedSpecialty)) {
    errors.push(`specialty must be one of: ${VALID_SPECIALTIES.join(', ')}`);
  }
  
  const validatedBudget = parseInt(budget) || 50;
  if (isNaN(validatedBudget) || validatedBudget < MIN_BUDGET || validatedBudget > MAX_BUDGET) {
    errors.push(`budget must be a number between ${MIN_BUDGET} and ${MAX_BUDGET}`);
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Generate agent ID (no command execution)
    const agentId = `gtm_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    
    // Create agent record
    const newAgent = {
      id: agentId,
      type: 'gtm_specialist',
      specialty: validatedSpecialty,
      parent: parent_agent_id,
      status: 'active',
      target: target_url,
      budget: validatedBudget,
      leads: 0,
      calls: 0,
      created_at: new Date().toISOString()
    };
    
    // Read current data and append
    const data = await getSpawnerData();
    data.spawned_agents.push(newAgent);
    data.total_active = data.spawned_agents.filter(a => a.status === 'active').length;
    data.last_updated = new Date().toISOString();
    await saveSpawnerData(data);
    
    res.json({
      status: 'spawned',
      agent_id: agentId,
      parent: parent_agent_id,
      target: target_url,
      specialty: validatedSpecialty,
      budget: validatedBudget,
      message: 'GTM sub-agent spawned successfully',
      dashboard: 'https://execution-protocol.onrender.com/#gtm',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log detailed error internally
    console.error('[SPAWNER] Spawn error:', error);
    
    // Return generic error to client
    res.status(500).json({
      error: 'Spawn failed',
      message: 'An internal error occurred while spawning the agent',
      timestamp: new Date().toISOString()
    });
  }
});

// List spawned agents
router.get('/spawned', async (req, res) => {
  const { parent } = req.query;
  
  // Validate parent parameter if provided
  if (parent && !isValidAgentId(parent)) {
    return res.status(400).json({
      error: 'Invalid parent parameter',
      message: 'parent must be 1-50 alphanumeric characters (a-z, A-Z, 0-9, _, -)',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const data = await getSpawnerData();
    let agents = data.spawned_agents || [];
    
    // Filter by parent if specified
    if (parent) {
      agents = agents.filter(a => a.parent === parent);
    }
    
    res.json({
      status: 'live',
      spawned_agents: agents,
      total_active: agents.filter(a => a.status === 'active').length,
      total_leads: agents.reduce((sum, a) => sum + (a.leads || 0), 0),
      total_calls: agents.reduce((sum, a) => sum + (a.calls || 0), 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SPAWNER] List error:', error);
    res.status(500).json({
      error: 'Failed to retrieve spawned agents',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Get spawn stats
router.get('/spawn-stats', async (req, res) => {
  try {
    const data = await getSpawnerData();
    const agents = data.spawned_agents || [];
    
    res.json({
      status: 'live',
      spawning_capacity: 'unlimited',
      active_agents: agents.filter(a => a.status === 'active').length,
      total_spawned: agents.length,
      total_leads_generated: agents.reduce((sum, a) => sum + (a.leads || 0), 0),
      total_calls_booked: agents.reduce((sum, a) => sum + (a.calls || 0), 0),
      total_revenue: agents.reduce((sum, a) => sum + (a.revenue || 0), 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SPAWNER] Stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Get single agent details
router.get('/spawned/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  if (!isValidAgentId(agentId)) {
    return res.status(400).json({
      error: 'Invalid agent ID',
      message: 'agentId must be 1-50 alphanumeric characters',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const data = await getSpawnerData();
    const agent = data.spawned_agents?.find(a => a.id === agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${agentId}`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      status: 'success',
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SPAWNER] Get agent error:', error);
    res.status(500).json({
      error: 'Failed to retrieve agent',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Update agent status (for internal use)
router.patch('/spawned/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { status, leads, calls, revenue } = req.body;
  
  if (!isValidAgentId(agentId)) {
    return res.status(400).json({
      error: 'Invalid agent ID',
      message: 'agentId must be 1-50 alphanumeric characters',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const data = await getSpawnerData();
    const agentIndex = data.spawned_agents?.findIndex(a => a.id === agentId);
    
    if (agentIndex === -1 || agentIndex === undefined) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${agentId}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update fields
    if (status && ['active', 'paused', 'completed', 'failed'].includes(status)) {
      data.spawned_agents[agentIndex].status = status;
    }
    if (typeof leads === 'number') {
      data.spawned_agents[agentIndex].leads = leads;
    }
    if (typeof calls === 'number') {
      data.spawned_agents[agentIndex].calls = calls;
    }
    if (typeof revenue === 'number') {
      data.spawned_agents[agentIndex].revenue = revenue;
    }
    
    data.spawned_agents[agentIndex].updated_at = new Date().toISOString();
    data.total_active = data.spawned_agents.filter(a => a.status === 'active').length;
    data.last_updated = new Date().toISOString();
    
    await saveSpawnerData(data);
    
    res.json({
      status: 'updated',
      agent: data.spawned_agents[agentIndex],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SPAWNER] Update error:', error);
    res.status(500).json({
      error: 'Failed to update agent',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
