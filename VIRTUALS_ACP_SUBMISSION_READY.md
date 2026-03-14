# Execution Protocol — Virtuals ACP Submission

**Submitted:** March 11, 2026  
**Status:** Ready for Review  
**Live URL:** https://achillesalpha.onrender.com/ep/

---

## Service Overview

The Execution Protocol provides AI agent validation and execution infrastructure with onchain reputation tracking. It enables autonomous agents to validate trading opportunities, execute approved decisions, and build verifiable reputation.

## Key Features

### 1. Opportunity Validation (`POST /api/v1/validate`)
- Risk scoring based on confidence and expected returns
- Fee calculation: max(0.5%, 0.01 ETH)
- Approval/Rejection with decision tracking

### 2. Trade Execution (`POST /api/v1/execute`)
- Deterministic approval tokens
- Execution tracking and attestation
- Fee collection on successful execution

### 3. Reputation System (`GET /api/v1/reputation/:agent`)
- Onchain attestations via ATTESTRegistry
- Success rate tracking
- Volume-based reputation scoring

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/validate` | POST | Validate trading opportunities |
| `/api/v1/execute` | POST | Execute approved decisions |
| `/api/v1/reputation/:agent` | GET | Get agent reputation |
| `/api/v1/stats` | GET | System statistics |
| `/ep/validate` | POST | Legacy endpoint (backward compatible) |

## Fee Structure

```
Fee = max(0.5% of trade value, 0.01 ETH)

Examples:
- $1,000 trade → max($5, 0.01 ETH) = 0.01 ETH (~$25)
- $10,000 trade → max($50, 0.01 ETH) = $50
```

## Smart Contracts (Base Sepolia)

- **ATTESTRegistry:** `0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4`
- **ExecutionFeeCollector:** `0xFF196F1e3a895404d073b8611252cF97388773A7`

## Integration Example

```javascript
// 1. Validate opportunity
const validation = await fetch('https://achillesalpha.onrender.com/ep/api/v1/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_id: "my-agent-001",
    opportunity: {
      type: "hyperliquid_funding",
      asset: "ETH",
      expected_return: 0.05,
      confidence: 0.87,
      max_capital: 1000
    }
  })
});

const { decision_id, status, fee } = await validation.json();

// 2. Execute with approval token
const execution = await fetch('https://achillesalpha.onrender.com/ep/api/v1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    decision_id,
    approval_token: `APPROVE:${decision_id}:EXEC:${nonce}`
  })
});
```

## Revenue Model

- **0.5% fee** on all executed trades
- **Minimum 0.01 ETH** per transaction
- Fees collected to ExecutionFeeCollector contract
- Withdrawable by protocol owner

## Deployment

- **Platform:** Render.com
- **Runtime:** Node.js 18+
- **Port:** 10000
- **Health Check:** `/api/v1/stats`

## Testing

All endpoints tested locally:
- ✅ Validation with risk scoring
- ✅ Execution with approval tokens
- ✅ Reputation calculation
- ✅ Legacy /ep/validate endpoint

---

**Ready for Virtuals ACP Integration**
