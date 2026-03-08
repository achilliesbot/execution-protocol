// Execution Protocol ACP Service - Main API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const contractIntegration = require('./contracts');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console()
  ]
});

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Rate limit exceeded' }
});
app.use('/api/', limiter);

// Configuration
const PORT = process.env.PORT || 3000;
const ATTEST_CONTRACT = process.env.ATTEST_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// Fee calculation: max(0.5%, 0.01 ETH)
function calculateFee(tradeValueUsd, ethPriceUsd) {
  const percentageFee = tradeValueUsd * 0.005; // 0.5%
  const flatFeeUsd = 0.01 * ethPriceUsd; // 0.01 ETH in USD
  
  const feeUsd = Math.max(percentageFee, flatFeeUsd);
  const feeEth = feeUsd / ethPriceUsd;
  
  return {
    feeUsd: feeUsd.toFixed(2),
    feeEth: feeEth.toFixed(6),
    basisPoints: feeUsd === percentageFee ? 50 : 100, // 0.5% = 50 bps, 0.01 ETH = 100 bps at $20 ETH
    method: feeUsd === percentageFee ? 'percentage' : 'flat'
  };
}

// In-memory decision storage (replace with DB in production)
const decisions = new Map();
const agentReputations = new Map();

// Middleware: Validate ACP request
function validateACPRequest(req, res, next) {
  const { agent_id, signature, opportunity } = req.body;
  
  if (!agent_id || !opportunity) {
    return res.status(400).json({ 
      error: 'Missing required fields: agent_id, opportunity' 
    });
  }
  
  // TODO: Verify agent signature onchain
  next();
}

// Routes

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'execution-acp-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Validate opportunity and return decision
 * POST /api/v1/validate
 */
app.post('/api/v1/validate', validateACPRequest, async (req, res) => {
  try {
    const { agent_id, opportunity } = req.body;
    
    logger.info(`Validation request from ${agent_id}`, { opportunity });
    
    // Execution Protocol Logic
    const decision = await evaluateOpportunity(agent_id, opportunity);
    
    // Calculate fee
    const ethPriceUsd = 2500; // TODO: Fetch from oracle
    const fee = calculateFee(opportunity.max_capital || 1000, ethPriceUsd);
    
    // Store decision
    decisions.set(decision.decision_id, {
      ...decision,
      agent_id,
      opportunity,
      fee,
      timestamp: Date.now()
    });
    
    // Create attestation onchain (async)
    if (contractIntegration.initialized) {
      const attestationUID = await contractIntegration.createAttestation(agent_id, decision);
      if (attestationUID) {
        decision.attestation_uid = attestationUID;
        decisions.set(decision.decision_id, decision);
      }
    }
    
    res.json({
      decision_id: decision.decision_id,
      status: decision.status,
      confidence_score: decision.confidence_score,
      risk_level: decision.risk_level,
      max_allocation: decision.max_allocation,
      reasoning: decision.reasoning,
      fee,
      attestation_uid: decision.attestation_uid || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Validation error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Execute approved trade
 * POST /api/v1/execute
 */
app.post('/api/v1/execute', async (req, res) => {
  try {
    const { decision_id, approval_token } = req.body;
    
    // Validate decision exists
    const decision = decisions.get(decision_id);
    if (!decision) {
      return res.status(404).json({ error: 'Decision not found' });
    }
    
    // Validate approval token format
    if (!approval_token || !approval_token.startsWith('APPROVE:')) {
      return res.status(400).json({ error: 'Invalid approval token format' });
    }
    
    // Check if already executed
    if (decision.executed) {
      return res.status(400).json({ error: 'Decision already executed' });
    }
    
    logger.info(`Execution request for ${decision_id}`);
    
    // Execute trade (placeholder - integrate with Hyperliquid)
    const execution = await executeTrade(decision, approval_token);
    
    // Mark as executed
    decision.executed = true;
    decision.execution = execution;
    decisions.set(decision_id, decision);
    
    res.json({
      decision_id,
      status: 'executed',
      tx_hash: execution.tx_hash || null,
      execution_price: execution.price,
      fee_paid: decision.fee,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Execution error', { error: error.message });
    res.status(500).json({ error: 'Execution failed' });
  }
});

/**
 * Get agent reputation
 * GET /api/v1/reputation/:agent_address
 */
app.get('/api/v1/reputation/:agent_address', async (req, res) => {
  try {
    const { agent_address } = req.params;
    
    // Fetch from onchain ATTEST or cache
    const reputation = await getAgentReputation(agent_address);
    
    res.json(reputation);
    
  } catch (error) {
    logger.error('Reputation fetch error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

/**
 * Get service stats
 * GET /api/v1/stats
 */
app.get('/api/v1/stats', (req, res) => {
  const stats = {
    total_decisions: decisions.size,
    total_executed: Array.from(decisions.values()).filter(d => d.executed).length,
    total_volume_usd: Array.from(decisions.values())
      .reduce((sum, d) => sum + (d.opportunity?.max_capital || 0), 0),
    active_agents: new Set(Array.from(decisions.values()).map(d => d.agent_id)).size,
    fee_structure: {
      percentage: '0.5%',
      flat: '0.01 ETH',
      method: 'whichever is higher'
    }
  };
  
  res.json(stats);
});

// Business Logic

async function evaluateOpportunity(agent_id, opportunity) {
  // Execution Protocol decision logic
  const decision_id = `d-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Risk assessment
  let risk_level = 'medium';
  let confidence_score = 0.5;
  let max_allocation = opportunity.max_capital || 1000;
  let status = 'rejected';
  let reasoning = [];
  
  // Check confidence threshold
  if (opportunity.confidence >= 0.85) {
    confidence_score = opportunity.confidence;
    risk_level = 'low';
    status = 'approved';
    reasoning.push('High confidence score (>= 0.85)');
  } else if (opportunity.confidence >= 0.70) {
    confidence_score = opportunity.confidence;
    risk_level = 'medium';
    status = 'approved';
    max_allocation = max_allocation * 0.5; // Reduce allocation
    reasoning.push('Medium confidence - reducing allocation by 50%');
  } else {
    confidence_score = opportunity.confidence;
    risk_level = 'high';
    status = 'rejected';
    reasoning.push('Confidence too low (< 0.70)');
  }
  
  // Check expected return
  if (opportunity.expected_return < 0.01) {
    status = 'rejected';
    reasoning.push('Expected return too low (< 1%)');
  }
  
  // Check agent reputation (if available)
  const agentRep = agentReputations.get(agent_id);
  if (agentRep && agentRep.reputation_score < 5000) {
    max_allocation = Math.min(max_allocation, 100); // Cap for low-rep agents
    reasoning.push('Agent reputation below threshold - capping allocation');
  }
  
  return {
    decision_id,
    status,
    confidence_score,
    risk_level,
    max_allocation,
    reasoning,
    attestation_uid: null // Will be populated after onchain attestation
  };
}

async function createAttestation(agent_id, decision) {
  // TODO: Implement onchain attestation via ATTEST contract
  logger.info('Creating attestation', { agent_id, decision_id: decision.decision_id });
  // Placeholder - will implement after contract deployment
  return null;
}

async function executeTrade(decision, approval_token) {
  // TODO: Integrate with Hyperliquid API
  logger.info('Executing trade', { decision_id: decision.decision_id });
  
  // Placeholder execution
  return {
    tx_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    price: decision.opportunity?.expected_price || 0,
    timestamp: Date.now()
  };
}

async function getAgentReputation(agent_address) {
  // TODO: Fetch from ATTEST contract
  const cached = agentReputations.get(agent_address);
  
  if (cached) {
    return cached;
  }
  
  // Default reputation for new agents
  return {
    address: agent_address,
    reputation_score: 5000, // Neutral starting score
    total_attestations: 0,
    success_rate: 0,
    total_volume: 0,
    is_verified: false
  };
}

// Initialize contract integration
contractIntegration.initialize().then(() => {
  logger.info('Contract integration initialized');
}).catch(err => {
  logger.error('Contract integration failed:', err.message);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Execution Protocol ACP Service running on port ${PORT}`);
  console.log(`🚀 Execution Protocol ACP Service`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`⛓️  ATTEST Contract: ${ATTEST_CONTRACT || 'Not deployed'}`);
  console.log(`💰 Fee: max(0.5%, 0.01 ETH)`);
  console.log(`✅ Ready for Virtuals ACP integration`);
  console.log(`🔗 ACP Manifest: /VIRTUALS_ACP.md`);
});

module.exports = app;
