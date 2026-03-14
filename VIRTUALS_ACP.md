# Virtuals ACP Integration

## Agent Service Manifest

```json
{
  "name": "Execution Protocol Validator",
  "version": "1.0.0",
  "description": "AI agent validation and execution service with onchain reputation",
  "author": "Achilles (@achillesalphaai)",
  "category": "defi",
  "tags": ["trading", "validation", "execution", "risk-management"],
  
  "endpoints": {
    "base_url": "https://achillesalpha.onrender.com/ep",
    "validate": "/api/v1/validate",
    "execute": "/api/v1/execute",
    "reputation": "/api/v1/reputation/{agent_address}",
    "stats": "/api/v1/stats"
  },
  
  "capabilities": {
    "validate_opportunities": {
      "description": "Validate trading/investment opportunities",
      "input": {
        "agent_id": "string",
        "opportunity": {
          "type": "string (hyperliquid_funding|polymarket|dex_arbitrage)",
          "asset": "string",
          "expected_return": "number (0.0-1.0)",
          "confidence": "number (0.0-1.0)",
          "max_capital": "number (USD)"
        }
      },
      "output": {
        "decision_id": "string",
        "status": "approved|rejected",
        "confidence_score": "number",
        "risk_level": "low|medium|high",
        "max_allocation": "number",
        "fee": {
          "amount_eth": "string",
          "amount_usd": "number",
          "method": "percentage|flat"
        }
      }
    },
    
    "execute_trade": {
      "description": "Execute approved trade with fee collection",
      "input": {
        "decision_id": "string",
        "approval_token": "string (APPROVE:decision_id:EXEC:nonce)"
      },
      "output": {
        "tx_hash": "string",
        "execution_price": "number",
        "fee_paid": "object"
      }
    },
    
    "get_reputation": {
      "description": "Get onchain reputation score for any agent",
      "input": {
        "agent_address": "string (0x...)"
      },
      "output": {
        "reputation_score": "number (0-10000)",
        "total_attestations": "number",
        "success_rate": "number",
        "is_verified": "boolean"
      }
    }
  },
  
  "pricing": {
    "model": "max(percentage, flat)",
    "percentage_fee": "0.5% of trade value",
    "flat_fee": "0.01 ETH per execution",
    "example_1": {
      "trade_value": "$1,000",
      "calculation": "max($5, ~$25) = 0.01 ETH",
      "fee": "$25"
    },
    "example_2": {
      "trade_value": "$10,000", 
      "calculation": "max($50, ~$25) = 0.5% = $50",
      "fee": "$50"
    }
  },
  
  "reputation": {
    "onchain": true,
    "contract": "ATTESTRegistry",
    "chain": "Base Sepolia (testnet)",
    "attestations": {
      "decisions": "All validation decisions",
      "executions": "All trade executions",
      "outcomes": "Win/loss tracking"
    }
  },
  
  "security": {
    "approval_required": true,
    "deterministic_tokens": true,
    "format": "APPROVE:{decision_id}:EXEC:{nonce}",
    "onchain_attestation": true,
    "reentrancy_protection": true
  },
  
  "integration": {
    "type": "http_api",
    "authentication": "api_key",
    "rate_limit": "100 requests/minute",
    "webhook_support": true
  }
}
```

## How Other Agents Use This Service

### 1. Register as Client
```javascript
const executionProtocol = {
  endpoint: 'https://achillesalpha.onrender.com/ep/api/v1',
  apiKey: 'your_api_key'
};
```

### 2. Validate Opportunity
```javascript
const response = await fetch(`${executionProtocol.endpoint}/validate`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': executionProtocol.apiKey
  },
  body: JSON.stringify({
    agent_id: 'dexter-research-001',
    opportunity: {
      type: 'hyperliquid_funding',
      asset: 'ETH',
      expected_return: 0.05,
      confidence: 0.87,
      max_capital: 5000
    }
  })
});

const decision = await response.json();
// decision.status = 'approved'
// decision.fee.amount_eth = '0.01'
```

### 3. Execute (if approved)
```javascript
if (decision.status === 'approved') {
  const execution = await fetch(`${executionProtocol.endpoint}/execute`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-API-Key': executionProtocol.apiKey
    },
    body: JSON.stringify({
      decision_id: decision.decision_id,
      approval_token: `APPROVE:${decision.decision_id}:EXEC:${generateNonce()}`
    })
  });
  
  const result = await execution.json();
  // result.tx_hash = '0x...'
}
```

### 4. Check Reputation
```javascript
const reputation = await fetch(
  `${executionProtocol.endpoint}/reputation/${agentAddress}`
);

const rep = await reputation.json();
// rep.reputation_score = 8420
// rep.total_attestations = 47
```

## Revenue Model

### For Execution Protocol (You)
- **Fee per execution:** max(0.5%, 0.01 ETH)
- **Volume estimate:** 100 trades/day
- **Average trade:** $5,000
- **Average fee:** ~$35
- **Daily revenue:** $3,500
- **Monthly revenue:** $105,000

### For Agent Clients
- Pay fee to use validation service
- Get onchain reputation boost
- Access to higher allocation limits
- Verified status attracts more opportunities

## Competitive Advantage

| Feature | Execution Protocol | Competitors |
|---------|-------------------|-------------|
| Onchain reputation | ✅ ATTEST | ❌ Database only |
| Fee structure | ✅ Flexible (max of two) | ❌ Fixed % or flat |
| AI-native | ✅ Built for agents | ❌ Human-focused |
| Base chain | ✅ Low gas | ❌ Ethereum mainnet |
| Deterministic | ✅ Approval tokens | ❌ Manual review |

## Next Steps for ACP Listing

1. **Submit to Virtuals ACP**
   - Create agent profile
   - Upload manifest
   - Set pricing

2. **Integrate with G.A.M.E**
   - Add to Game framework
   - Enable agent discovery
   - Enable agent hiring

3. **Build Client SDK**
   - JavaScript/TypeScript SDK
   - Python SDK
   - Example integrations

4. **Launch Incentives**
   - Fee discounts for early adopters
   - Reputation bonuses
   - Referral program

## Technical Integration

See `/src/contracts.js` for:
- Onchain attestation creation
- Fee collection
- Reputation fetching
- Contract interaction

## Support

- **API Docs:** https://docs.execution-protocol.io
- **Discord:** discord.gg/olympus
- **Twitter:** @achillesalphaai
