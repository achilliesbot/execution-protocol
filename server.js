const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const PORT = process.env.PORT || 10000;

// Contract ABIs (minimal)
const ATTEST_REGISTRY_ABI = [
  "function attest(address agent, bytes32 actionType, uint256 value, uint256 confidence, string calldata metadata) external payable returns (bytes32)",
  "function getReputation(address agent) external view returns (uint256 score, uint256 totalAttestations, uint256 successCount)",
  "event AttestationCreated(bytes32 indexed uid, address indexed agent, bytes32 actionType, uint256 value)"
];

const FEE_COLLECTOR_ABI = [
  "function collectFee(address agent, uint256 tradeValue) external payable",
  "function getFee(uint256 tradeValue) external pure returns (uint256)",
  "function withdraw() external",
  "event FeeCollected(address indexed agent, uint256 amount, uint256 tradeValue)"
];

// Contract addresses from deployment
const CONTRACTS = {
  baseSepolia: {
    attestRegistry: '0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4',
    feeCollector: '0xFF196F1e3a895404d073b8611252cF97388773A7'
  }
};

// In-memory state (will be persisted to file)
let state = {
  decisions: {},
  attestations: [],
  agents: {},
  stats: {
    totalValidations: 0,
    totalExecutions: 0,
    totalFeesCollected: 0,
    totalVolume: 0
  }
};

// Load state from file if exists
const STATE_FILE = './data/ep-state.json';
try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log('State loaded from file');
  }
} catch (e) {
  console.log('No existing state file, starting fresh');
}

// Save state helper
function saveState() {
  try {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save state:', e.message);
  }
}

// Fee calculation: max(0.5%, 0.01 ETH)
function calculateFee(tradeValue) {
  const percentageFee = tradeValue * 0.005; // 0.5%
  const minFee = 0.01; // 0.01 ETH
  const fee = Math.max(percentageFee, minFee);
  return {
    amount_eth: fee.toFixed(4),
    amount_usd: (fee * 2500).toFixed(2), // Approximate ETH price
    basis_points: fee === minFee ? 100 : 50
  };
}

// Validation logic
function validateOpportunity(opportunity) {
  const { type, asset, expected_return, confidence, max_capital } = opportunity;
  
  // Risk scoring
  let riskScore = 0;
  if (confidence > 0.8) riskScore += 30;
  else if (confidence > 0.6) riskScore += 20;
  else if (confidence > 0.4) riskScore += 10;
  
  if (expected_return > 0.1) riskScore += 30;
  else if (expected_return > 0.05) riskScore += 20;
  else if (expected_return > 0.02) riskScore += 10;
  
  if (max_capital < 1000) riskScore += 20;
  else if (max_capital < 5000) riskScore += 10;
  
  // Decision
  const approved = confidence >= 0.3 && expected_return > 0.01 && riskScore >= 30;
  
  return {
    approved,
    risk_level: riskScore >= 60 ? 'low' : riskScore >= 40 ? 'medium' : 'high',
    confidence_score: confidence,
    max_allocation: Math.min(max_capital, 1000) // Cap at $1000 for safety
  };
}

// Request handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Key');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API Routes
  if (pathname === '/api/v1/validate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { agent_id, opportunity } = data;
        
        if (!agent_id || !opportunity) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing agent_id or opportunity' }));
          return;
        }
        
        const decisionId = `d-${Date.now()}`;
        const validation = validateOpportunity(opportunity);
        const fee = calculateFee(opportunity.max_capital || 100);
        
        const response = {
          decision_id: decisionId,
          status: validation.approved ? 'approved' : 'rejected',
          confidence_score: validation.confidence_score,
          risk_level: validation.risk_level,
          max_allocation: validation.max_allocation,
          fee: fee,
          attestation_uid: null,
          timestamp: new Date().toISOString()
        };
        
        // Store decision
        state.decisions[decisionId] = {
          ...response,
          agent_id,
          opportunity,
          executed: false
        };
        
        state.stats.totalValidations++;
        saveState();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
        console.log(`[VALIDATE] ${agent_id} -> ${response.status} (${validation.risk_level})`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  if (pathname === '/api/v1/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { decision_id, approval_token } = data;
        
        if (!decision_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing decision_id' }));
          return;
        }
        
        const decision = state.decisions[decision_id];
        if (!decision) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Decision not found' }));
          return;
        }
        
        if (decision.executed) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Decision already executed' }));
          return;
        }
        
        // Validate approval token format
        if (!approval_token || !approval_token.startsWith('APPROVE:')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid approval token' }));
          return;
        }
        
        // Mark as executed
        decision.executed = true;
        decision.execution_time = new Date().toISOString();
        
        state.stats.totalExecutions++;
        state.stats.totalVolume += decision.max_allocation || 0;
        
        // Update agent stats
        if (!state.agents[decision.agent_id]) {
          state.agents[decision.agent_id] = {
            validations: 0,
            executions: 0,
            volume: 0,
            fees: 0
          };
        }
        state.agents[decision.agent_id].executions++;
        state.agents[decision.agent_id].volume += decision.max_allocation || 0;
        
        saveState();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          decision_id,
          status: 'executed',
          execution_time: decision.execution_time,
          fee_paid: decision.fee
        }));
        
        console.log(`[EXECUTE] ${decision_id} executed`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  if (pathname.startsWith('/api/v1/reputation/') && req.method === 'GET') {
    const agentAddress = pathname.split('/').pop();
    const agent = state.agents[agentAddress] || { validations: 0, executions: 0, volume: 0, fees: 0 };
    
    // Calculate reputation score
    const successRate = agent.executions > 0 ? agent.executions / agent.validations : 0;
    const reputationScore = Math.floor(
      (agent.executions * 100) + 
      (successRate * 1000) + 
      (Math.log10(agent.volume + 1) * 100)
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      address: agentAddress,
      reputation_score: Math.min(reputationScore, 10000),
      total_attestations: agent.executions || 0,
      success_rate: successRate.toFixed(2),
      total_volume: agent.volume || 0
    }));
    return;
  }
  
  if (pathname === '/api/v1/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...state.stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Legacy endpoint for backward compatibility
  if (pathname === '/ep/validate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { agent, action, params } = data;
        
        const decisionId = `ep-${Date.now()}`;
        const confidence = params?.confidence || 0.5;
        const approved = confidence >= 0.3;
        
        const response = {
          decision_id: decisionId,
          approved,
          confidence,
          fee_eth: approved ? '0.01' : '0',
          timestamp: new Date().toISOString()
        };
        
        state.decisions[decisionId] = {
          ...response,
          agent,
          action,
          params,
          executed: false
        };
        
        saveState();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
        console.log(`[EP/VALIDATE] ${agent} -> ${approved ? 'APPROVED' : 'REJECTED'}`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // Static file serving
  let filePath = '.' + pathname;
  if (filePath === './') filePath = './index.html';
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png'
  };
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile('./index.html', (err, content) => {
          if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('500 Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`⚡ Execution Protocol API running on port ${PORT}`);
  console.log(`📊 Stats: ${state.stats.totalValidations} validations, ${state.stats.totalExecutions} executions`);
  console.log(`🌐 Endpoints:`);
  console.log(`   POST /api/v1/validate - Validate opportunities`);
  console.log(`   POST /api/v1/execute  - Execute approved decisions`);
  console.log(`   GET  /api/v1/reputation/:agent - Get agent reputation`);
  console.log(`   GET  /api/v1/stats - Get system stats`);
  console.log(`   POST /ep/validate - Legacy validation endpoint`);
});
