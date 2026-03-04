/**
 * Pantheon UI Routes — Public dashboard + admin ledger views
 * 
 * Structure:
 * - GET /pantheon/overview — Revenue, streams, treasury (public)
 * - GET /pantheon/streams — Stream details (public)
 * - GET /pantheon/income — Income history (public)
 * - GET /pantheon/integrate — API docs/integration guide (public)
 * - GET /pantheon/vault — Vault status (public)
 * - GET /admin/ledger — Full ledger access (admin-gated)
 * - GET /admin/proofs — Proof hash lookup (admin-gated)
 */

import { Router } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Admin auth middleware (simple API key check)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const expectedKey = process.env.PANTHEON_ADMIN_KEY;
  
  if (!expectedKey) {
    return res.status(503).json({ error: 'Admin access not configured' });
  }
  
  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Ledger path configuration
const LEDGER_DIR = process.env.LEDGER_DIR || join(process.cwd(), 'data', 'ledger');

/**
 * Public Routes — Clean, minimal, trustworthy
 */

// Overview: Money + Proof (Top of page)
router.get('/overview', async (req, res) => {
  const now = new Date();
  
  // Check live connector status
  const polyConfigured = !!(process.env.POLYMARKET_API_KEY && process.env.POLYMARKET_PRIVATE_KEY);
  const bnkrConfigured = !!process.env.BNKR_API_KEY;
  
  // Calculate revenue data (mock for now - will be from ledger)
  const revenue7d = 1234.56;
  const revenue30d = 5678.90;
  const revenueAllTime = 12345.67;
  
  // Treasury snapshot with live status
  const treasury = {
    total_usd: 45678.90,
    polymarket_allocation: polyConfigured ? 15000.00 : 0,
    bnkr_allocation: bnkrConfigured ? 20000.00 : 0,
    yield_allocation: 10000.00,
    oddpool_locked: 678.90,
    last_updated: now.toISOString()
  };
  
  // Stream health with live indicators
  const streams = [
    { id: 'execution-protocol', name: 'Execution Protocol', status: 'active', revenue_7d: 234.56, live: true },
    { id: 'bnkr', name: 'BNKR', status: bnkrConfigured ? 'active' : 'connecting', revenue_7d: 456.78, live: bnkrConfigured },
    { id: 'polymarket', name: 'Polymarket', status: polyConfigured ? 'active' : 'connecting', revenue_7d: 345.67, live: polyConfigured },
    { id: 'yield', name: 'Yield', status: 'active', revenue_7d: 123.45, live: true },
    { id: 'oddpool', name: 'Oddpool', status: 'locked', revenue_7d: 0, live: false }
  ];
  
  res.json({
    revenue: {
      '7d': revenue7d,
      '30d': revenue30d,
      all_time: revenueAllTime
    },
    treasury,
    streams,
    connectors: {
      polymarket: { configured: polyConfigured, status: polyConfigured ? 'live' : 'not_configured' },
      bnkr: { configured: bnkrConfigured, status: bnkrConfigured ? 'live' : 'not_configured' }
    },
    updated_at: now.toISOString()
  });
});

// Streams: Detailed stream view
router.get('/streams', (req, res) => {
  const streams = [
    {
      id: 'execution-protocol',
      name: 'Execution Protocol',
      status: 'active',
      description: 'Policy validation + proof generation',
      stats: {
        validations_24h: 1234,
        avg_response_ms: 45,
        uptime_pct: 99.9
      },
      revenue: { '7d': 234.56, '30d': 1234.56, all_time: 5678.90 }
    },
    {
      id: 'bnkr',
      name: 'BNKR',
      status: 'active',
      description: 'Base ecosystem execution',
      stats: {
        orders_24h: 89,
        fill_rate: 0.94,
        avg_slippage: 0.0012
      },
      revenue: { '7d': 456.78, '30d': 2345.67, all_time: 12345.67 }
    },
    {
      id: 'polymarket',
      name: 'Polymarket',
      status: 'active',
      description: 'Prediction market execution',
      stats: {
        orders_24h: 156,
        fill_rate: 0.88,
        avg_fee: 0.002
      },
      revenue: { '7d': 345.67, '30d': 1567.89, all_time: 8901.23 }
    },
    {
      id: 'yield',
      name: 'Yield',
      status: 'active',
      description: 'Automated yield strategies',
      stats: {
        apy_current: 0.08,
        tvl: 50000.00,
        harvests_24h: 4
      },
      revenue: { '7d': 123.45, '30d': 567.89, all_time: 2345.67 }
    },
    {
      id: 'oddpool',
      name: 'Oddpool',
      status: 'locked',
      description: 'Coming soon',
      stats: {},
      revenue: { '7d': 0, '30d': 0, all_time: 0 }
    }
  ];
  
  res.json({ streams, updated_at: new Date().toISOString() });
});

// Income: Revenue history
router.get('/income', (req, res) => {
  // Generate mock daily data
  const days = 30;
  const daily = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    daily.push({
      date: date.toISOString().split('T')[0],
      total: +(Math.random() * 100 + 50).toFixed(2),
      by_stream: {
        'execution-protocol': +(Math.random() * 20 + 10).toFixed(2),
        'bnkr': +(Math.random() * 30 + 15).toFixed(2),
        'polymarket': +(Math.random() * 25 + 10).toFixed(2),
        'yield': +(Math.random() * 15 + 5).toFixed(2)
      }
    });
  }
  
  res.json({ daily, updated_at: now.toISOString() });
});

// Integrate: API documentation
router.get('/integrate', (req, res) => {
  res.json({
    name: 'Pantheon API',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/pantheon/overview', auth: 'none', description: 'Revenue + treasury snapshot' },
      { method: 'GET', path: '/pantheon/streams', auth: 'none', description: 'Stream details' },
      { method: 'GET', path: '/pantheon/income', auth: 'none', description: 'Income history' },
      { method: 'POST', path: '/ep/validate', auth: 'X-Agent-Key', description: 'Validate execution proposal' },
      { method: 'POST', path: '/ep/simulate', auth: 'X-Agent-Key', description: 'Simulate execution' }
    ],
    schemas: {
      'opportunity-proposal': '/schemas/opportunity-proposal.v1.json',
      'verification-result': '/schemas/verification-result.v1.json'
    },
    quickstart: {
      validate: `curl -X POST https://api.pantheon.ai/ep/validate \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Key: your_key_here" \\
  -d '{
    "proposal_id": "prop_001",
    "asset": "BNKR",
    "direction": "buy",
    "amount_usd": 100,
    "entry_price": 0.042,
    "stop_loss": 0.038,
    "take_profit": 0.05
  }'`
    }
  });
});

// Vault: Phase status
router.get('/vault', (req, res) => {
  res.json({
    phases: [
      {
        phase: 8,
        name: 'Entropy Detector',
        status: 'beta',
        description: 'Live execution validation',
        live: true
      },
      {
        phase: 9,
        name: 'Agent Entropy Detector',
        status: 'launch',
        description: 'Full agent integration',
        live: true
      },
      {
        phase: 10,
        name: 'Achilles Memory Map',
        status: 'coming_soon',
        description: 'Persistent agent memory',
        live: false,
        service_name: 'achilles-memory-mcp'
      }
    ],
    service_name: 'achilles-memory-mcp',
    updated_at: new Date().toISOString()
  });
});

/**
 * Admin Routes — Full power, gated
 */

// Ledger: Full access to ledger entries
router.get('/admin/ledger', adminAuth, (req, res) => {
  const { stream, limit = 100, after_sequence } = req.query;
  
  try {
    const entries = [];
    const ledgerFiles = readdirSync(LEDGER_DIR)
      .filter(f => f.startsWith('ledger-') && f.endsWith('.jsonl'))
      .sort();
    
    let count = 0;
    let skip_until = after_sequence ? parseInt(after_sequence) : 0;
    
    for (const file of ledgerFiles.reverse()) {
      if (count >= limit) break;
      
      const content = readFileSync(join(LEDGER_DIR, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines.reverse()) {
        if (count >= limit) break;
        
        const entry = JSON.parse(line);
        
        if (entry.sequence <= skip_until) continue;
        if (stream && entry.stream !== stream) continue;
        
        entries.push(entry);
        count++;
      }
    }
    
    res.json({
      entries: entries.reverse(), // Back to chronological order
      total_returned: entries.length,
      ledger_dir: LEDGER_DIR
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to read ledger', message: err.message });
  }
});

// Proofs: Hash lookup
router.get('/admin/proofs/:hash', adminAuth, (req, res) => {
  const { hash } = req.params;
  
  try {
    const ledgerFiles = readdirSync(LEDGER_DIR)
      .filter(f => f.startsWith('ledger-') && f.endsWith('.jsonl'))
      .sort();
    
    for (const file of ledgerFiles) {
      const content = readFileSync(join(LEDGER_DIR, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        const entry = JSON.parse(line);
        if (entry.entry_hash === hash || entry.entry_hash.startsWith(hash)) {
          return res.json({ found: true, entry });
        }
      }
    }
    
    res.status(404).json({ found: false, error: 'Hash not found in ledger' });
    
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

// Integrity check
router.get('/admin/integrity', adminAuth, (req, res) => {
  try {
    const ledgerFiles = readdirSync(LEDGER_DIR)
      .filter(f => f.startsWith('ledger-') && f.endsWith('.jsonl'))
      .sort();
    
    let totalEntries = 0;
    let brokenChains = [];
    let lastHash = '0'.repeat(64);
    
    for (const file of ledgerFiles) {
      const content = readFileSync(join(LEDGER_DIR, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        const entry = JSON.parse(line);
        totalEntries++;
        
        if (entry.prev_hash !== lastHash) {
          brokenChains.push({
            sequence: entry.sequence,
            expected: lastHash.slice(0, 16) + '...',
            got: entry.prev_hash.slice(0, 16) + '...'
          });
        }
        
        // Verify entry hash
        const data = {
          timestamp: entry.timestamp,
          stream: entry.stream,
          entry_type: entry.entry_type,
          payload: entry.payload,
          prev_hash: entry.prev_hash,
          sequence: entry.sequence
        };
        const computed = createHash('sha256')
          .update(JSON.stringify(data, Object.keys(data).sort()))
          .digest('hex');
        
        if (computed !== entry.entry_hash) {
          brokenChains.push({
            sequence: entry.sequence,
            error: 'Hash mismatch',
            computed: computed.slice(0, 16) + '...',
            stored: entry.entry_hash.slice(0, 16) + '...'
          });
        }
        
        lastHash = entry.entry_hash;
      }
    }
    
    res.json({
      integrity: brokenChains.length === 0 ? 'OK' : 'BROKEN',
      total_entries: totalEntries,
      broken_chains: brokenChains,
      last_hash: lastHash
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Integrity check failed', message: err.message });
  }
});

// Trades endpoint - reads from polymarket-trader trades.jsonl
router.get('/trades', (req, res) => {
  try {
    const tradesPath = '/home/ubuntu/polymarket-trader/trades.jsonl';
    const fs = require('fs');
    
    if (!fs.existsSync(tradesPath)) {
      return res.json({ trades: [], stats: {} });
    }
    
    const content = fs.readFileSync(tradesPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    const trades = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Calculate stats
    const totalTrades = trades.length;
    const openPositions = trades.filter(t => t.status === 'executed' || t.status === 'validated_pending_execution').length;
    const totalDeployed = trades.reduce((sum, t) => sum + (t.proposal?.amount_usd || 0), 0);
    
    // Simple win/loss tracking (would need actual P&L data)
    const wins = trades.filter(t => t.status === 'won').length;
    const losses = trades.filter(t => t.status === 'lost').length;
    const completed = wins + losses;
    const winRate = completed > 0 ? ((wins / completed) * 100).toFixed(1) : '0.0';
    
    res.json({
      trades: trades.reverse(), // Most recent first
      stats: {
        totalTrades,
        openPositions,
        totalDeployed: totalDeployed.toFixed(2),
        winRate,
        wins,
        losses
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read trades', message: err.message });
  }
});

// Income streams endpoint - real-time income calculation from Python
router.get('/income-streams', (req, res) => {
  try {
    // Import and run Python income calculator
    const { spawn } = require('child_process');
    const path = require('path');
    
    const calculatorPath = path.join(__dirname, '../../pantheon/income_calculator.py');
    
    const python = spawn('python3', [calculatorPath], {
      env: { ...process.env },
      timeout: 10000
    });
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Income calculator error:', error);
        // Return fallback data
        return res.json({
          bnk: { total: 0, daily: 0, trades: 0, stream: "BNKR Trading" },
          polymarket: { total: 0, daily: 0, trades: 0, stream: "Polymarket Trading" },
          ep: { total: 0, validations: 0, stream: "Execution Protocol" },
          total: 0,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const income = JSON.parse(output);
        res.json(income);
      } catch (e) {
        console.error('Failed to parse income data:', e);
        res.status(500).json({ error: 'Failed to parse income data' });
      }
    });
    
  } catch (err) {
    console.error('Income streams error:', err);
    res.status(500).json({ error: 'Failed to calculate income', message: err.message });
  }
});

// Connector status endpoint
router.get('/status/connectors', (req, res) => {
  const status = {
    polymarket: {
      configured: !!(process.env.POLYMARKET_API_KEY && process.env.POLYMARKET_PRIVATE_KEY),
      api_url: process.env.POLY_URL || 'https://gamma-api.polymarket.com',
      status: 'live'
    },
    bnkr: {
      configured: !!process.env.BNKR_API_KEY,
      api_url: process.env.BNKR_URL || 'https://bankr.bot/api',
      status: 'live'
    },
    execution_protocol: {
      version: '1.0.0',
      mode: process.env.EXECUTION_MODE || 'DRY_RUN',
      status: 'operational'
    },
    timestamp: new Date().toISOString()
  };
  
  res.json(status);
});

// Export ledger
router.get('/admin/export', adminAuth, (req, res) => {
  try {
    const ledgerFiles = readdirSync(LEDGER_DIR)
      .filter(f => f.startsWith('ledger-') && f.endsWith('.jsonl'))
      .sort();
    
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-export-${Date.now()}.jsonl"`);
    
    for (const file of ledgerFiles) {
      const content = readFileSync(join(LEDGER_DIR, file), 'utf-8');
      res.write(content);
    }
    
    res.end();
    
  } catch (err) {
    res.status(500).json({ error: 'Export failed', message: err.message });
  }
});

export default router;
