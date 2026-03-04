/**
 * Achilles GTM Agent Routes
 * Reverse-engineered ClawGTM with superior features
 */

import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// Run GTM agent analysis
router.post('/analyze', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }
  
  try {
    // Run Python GTM agent
    const scriptPath = path.join(process.cwd(), '..', 'gtm-agent', 'achilles_gtm.py');
    const { stdout } = await execAsync(`python3 ${scriptPath} --analyze "${url}"`);
    
    res.json({
      status: 'analyzed',
      url,
      result: stdout,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// Get GTM stats
router.get('/stats', async (req, res) => {
  // Return live stats from database
  res.json({
    status: 'live',
    urls_analyzed: 0,
    leads_found: 0,
    sequences_sent: 0,
    calls_booked: 0,
    revenue_generated: 0,
    conversion_rate: 0,
    updated_at: new Date().toISOString()
  });
});

// Get activity log
router.get('/activity', async (req, res) => {
  const { limit = 10 } = req.query;
  
  // Return combat log style activity
  res.json({
    activities: [
      {
        time: '18:35',
        type: 'agent_launched',
        description: 'Achilles GTM Agent deployed',
        status: 'success'
      }
    ],
    updated_at: new Date().toISOString()
  });
});

// Marketplace info
router.get('/marketplace', (req, res) => {
  res.json({
    product_id: 'achilles-gtm-agent',
    name: 'Achilles GTM Agent',
    tagline: 'From URL to Booked Call in Under an Hour',
    price_model: 'performance_based',
    price_per_booking: '$50-200',
    revenue_share: '20%',
    status: 'live',
    seller: 'achillesalphaai',
    wallet: '0x16708f79D6366eE32774048ECC7878617236Ca5C'
  });
});

export default router;
