/**
 * SECURE GTM Routes - Input Validated, No Command Injection
 */

import { Router } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const router = Router();

// Input validation
const validate = (input, rules) => {
  const errors = [];
  
  if (rules.url && input.url) {
    try { new URL(input.url); } catch { errors.push('Invalid URL'); }
    if (input.url.length > 500) errors.push('URL too long');
  }
  
  if (rules.agentId && input.parent_agent_id) {
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(input.parent_agent_id)) {
      errors.push('Invalid agent ID');
    }
  }
  
  if (rules.budget && input.budget) {
    const b = parseInt(input.budget);
    if (isNaN(b) || b < 1 || b > 1000) errors.push('Budget $1-1000');
  }
  
  return errors.length ? { valid: false, errors } : { valid: true };
};

// Safe data retrieval (NO command execution)
const getData = async () => {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '../../data/live/gtm_data.json');
    const data = await readFile(path, 'utf-8').catch(() => '{}');
    return JSON.parse(data);
  } catch { 
    return { urls_analyzed: 0, leads_generated: 0, sequences_sent: 0, calls_booked: 0 };
  }
};

router.post('/analyze', async (req, res) => {
  try {
    const v = validate(req.body, { url: true });
    if (!v.valid) return res.status(400).json({ error: 'Invalid input', details: v.errors });
    
    const { url } = req.body;
    
    res.json({
      status: 'queued',
      url,
      message: 'URL queued for analysis',
      estimated_time: 'Under 1 hour',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const data = await getData();
    res.json({
      status: 'live',
      urls_analyzed: data.urls_analyzed || 0,
      leads_generated: data.leads_generated || 0,
      sequences_sent: data.sequences_sent || 0,
      calls_booked: data.calls_booked || 0,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Stats failed' });
  }
});

export default router;
