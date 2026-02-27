#!/usr/bin/env node
/**
 * Execution Protocol API Server
 * 
 * Endpoints:
 * - GET /health — Server health check
 * - GET /api/trades — Trade ledger from JSONL
 * - GET /api/capital — Capital status ($200 total)
 * - GET /api/positions — Open positions
 */

import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = import.meta.dirname || new URL('.', import.meta.url).pathname;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Phase 2 capital configuration
const CAPITAL = {
  total: 100,
  deployed: 0,
  remaining: 100,
  phase: 'phase2-live',
  mode: 'LIVE',
  autonomy: 'FULL',
  constraints: {
    max_position: 40,
    stop_loss_required: true,
    take_profit_required: true,
    daily_loss_limit: 20,
    max_leverage: 2,
    allowed_assets: ['BNKR', 'CLAWD', 'BNKRW']
  }
};

// Ledger path
const LEDGER_DIR = join(homedir(), '.openclaw', 'trades');

/**
 * Read trades from JSONL ledger
 */
function readTrades() {
  const today = new Date().toISOString().split('T')[0];
  const ledgerFile = join(LEDGER_DIR, `${today}.jsonl`);
  
  if (!existsSync(ledgerFile)) {
    return [];
  }
  
  try {
    const content = readFileSync(ledgerFile, 'utf-8').trim();
    if (!content) return [];
    
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (error) {
    console.error('Error reading ledger:', error.message);
    return [];
  }
}

/**
 * Calculate open positions from trades
 */
function getPositions(trades) {
  const positions = {};
  
  for (const trade of trades) {
    const asset = trade.asset;
    const direction = trade.direction;
    const amount = trade.amount_usd || 0;
    
    if (!positions[asset]) {
      positions[asset] = {
        asset,
        total_bought: 0,
        total_sold: 0,
        net_position: 0,
        avg_entry: 0,
        trades: []
      };
    }
    
    if (direction === 'buy' || direction === 'LONG') {
      positions[asset].total_bought += amount;
      positions[asset].net_position += amount;
    } else if (direction === 'sell' || direction === 'SHORT') {
      positions[asset].total_sold += amount;
      positions[asset].net_position -= amount;
    }
    
    positions[asset].trades.push({
      entry_id: trade.entry_id,
      timestamp: trade.timestamp,
      direction: trade.direction,
      amount: amount,
      entry_price: trade.entry_price,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit
    });
  }
  
  // Filter only open positions (net > 0)
  return Object.values(positions).filter(p => p.net_position > 0);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'execution-protocol-api',
    version: '1.0.0',
    phase: 'phase2-live',
    mode: 'LIVE',
    timestamp: new Date().toISOString()
  });
});

// Get all trades
app.get('/api/trades', (req, res) => {
  try {
    const trades = readTrades();
    
    // Sort by timestamp descending
    trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      count: trades.length,
      trades: trades,
      ledger_path: LEDGER_DIR,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read trades',
      message: error.message
    });
  }
});

// Get capital status
app.get('/api/capital', (req, res) => {
  const trades = readTrades();
  const deployed = trades.reduce((sum, t) => sum + (t.amount_usd || 0), 0);
  
  res.json({
    ...CAPITAL,
    deployed: deployed,
    remaining: CAPITAL.total - deployed,
    position_count: trades.length,
    last_updated: new Date().toISOString()
  });
});

// Get open positions
app.get('/api/positions', (req, res) => {
  try {
    const trades = readTrades();
    const positions = getPositions(trades);
    
    res.json({
      count: positions.length,
      positions: positions,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to calculate positions',
      message: error.message
    });
  }
});

// Root endpoint — serve frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Execution Protocol API Server');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Phase: Phase 2 LIVE`);
  console.log(`Ledger: ${LEDGER_DIR}`);
  console.log(`Capital: $${CAPITAL.total} USDC`);
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log(`  http://localhost:${PORT}/health`);
  console.log(`  http://localhost:${PORT}/api/trades`);
  console.log(`  http://localhost:${PORT}/api/capital`);
  console.log(`  http://localhost:${PORT}/api/positions`);
  console.log('='.repeat(60));
});
