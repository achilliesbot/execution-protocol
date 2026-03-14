# ⚡ Execution Protocol

[![Live Site](https://img.shields.io/badge/Live-execution--protocol.onrender.com-blue)](https://achillesalpha.onrender.com/ep/)
[![Mobile Friendly](https://img.shields.io/badge/Mobile-Responsive-success)](https://achillesalpha.onrender.com/ep/)

## Overview
AI agent validation and execution infrastructure with onchain reputation. Built for the Virtuals ACP ecosystem.

**🌐 Live Documentation**: https://achillesalpha.onrender.com/ep/

**📱 Mobile-Friendly**: Fully responsive with hamburger navigation

## Fee Structure
- **Calculation:** `max(0.5% of trade value, 0.01 ETH)`
- **Example:** 
  - $1,000 trade → 0.5% = $5 → charge 0.01 ETH (~$20-30)
  - $10,000 trade → 0.5% = $50 → charge 0.5% ($50)

## Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent Client   │────▶│  Execution       │────▶│   ATTEST        │
│  (Virtuals ACP) │     │  Protocol API    │     │   Registry      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Trade Execution │
                        │  (Hyperliquid)   │
                        └──────────────────┘
```

## API Endpoints

### 1. Validate Opportunity
```
POST /api/v1/validate
{
  "agent_id": "dexter-research-001",
  "opportunity": {
    "type": "hyperliquid_funding",
    "asset": "ETH",
    "expected_return": 0.05,
    "confidence": 0.87,
    "max_capital": 1000
  }
}

Response:
{
  "decision_id": "d-1234567890",
  "status": "approved|rejected",
  "confidence_score": 0.92,
  "risk_level": "low",
  "max_allocation": 500,
  "fee": {
    "amount_eth": "0.01",
    "amount_usd": 25.50,
    "basis_points": 100
  },
  "attestation_uid": "0xabc..."
}
```

### 2. Execute Trade
```
POST /api/v1/execute
{
  "decision_id": "d-1234567890",
  "approval_token": "APPROVE:d-1234567890:EXEC:nonce123"
}
```

### 3. Get Agent Reputation
```
GET /api/v1/reputation/:agent_address

Response:
{
  "address": "0x...",
  "reputation_score": 8420,
  "total_attestations": 47,
  "success_rate": 0.94,
  "total_volume": 125000
}
```

## Deployment Status
- [ ] ACP Wrapper API
- [ ] ATTEST Contract Deployed (Base Sepolia)
- [ ] Fee Collection Contract
- [ ] Integration Tests
- [ ] Documentation
