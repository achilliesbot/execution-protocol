# API Quickstart — Execution Protocol v1.0

**Time to first validation:** ~5 minutes

---

## Prerequisites

1. **Agent Key** — Contact EP operator for `X-Agent-Key`
2. **HTTP client** — `curl`, Python `requests`, or any HTTP library
3. **Base URL** — `https://api.execution-protocol.ai` (or your EP instance)

---

## Quickstart: cURL

### 1. Health Check (No Auth)
```bash
curl https://api.execution-protocol.ai/ep/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "execution-protocol",
  "version": "1.0.0",
  "mode": "DRY_RUN",
  "timestamp": "2026-02-28T15:30:00.000Z"
}
```

### 2. System Status (No Auth)
```bash
curl https://api.execution-protocol.ai/ep/status
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "mode": "DRY_RUN",
  "policy_set": {
    "id": "olympus-v1",
    "hash": "01a85db0f653ef6075aba2c2e2f6adce"
  },
  "agents": {
    "registered": 3,
    "active": 2
  }
}
```

### 3. Validate a Proposal (Auth Required)
```bash
curl -X POST https://api.execution-protocol.ai/ep/validate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: YOUR_AGENT_KEY_HERE" \
  -d '{
    "proposal_id": "prop_'$(date +%s)'_$(openssl rand -hex 4)",
    "session_id": "sess_'$(date +%s)'_$(openssl rand -hex 4)",
    "asset": "BNKR",
    "direction": "buy",
    "amount_usd": 50,
    "entry_price": 0.042,
    "stop_loss": 0.038,
    "take_profit": 0.05,
    "leverage": 1,
    "rationale": "Testing EP integration",
    "agent_id": "my_agent",
    "policy_set_id": "olympus-v1"
  }'
```

**Expected Success Response:**
```json
{
  "valid": true,
  "risk_score": "LOW",
  "violations": [],
  "proof_hash": "a1b2c3d4e5f6789012345678901234567890abcd",
  "plan_summary": "BNKR BUY $50.00 @ 0.042 | SL: 0.038 | TP: 0.05 | 1x",
  "policy_set_hash": "01a85db0f653ef6075aba2c2e2f6adce",
  "session_id": "sess_1740751234_abc12345",
  "timestamp": "2026-02-28T15:30:00.000Z",
  "pricing_version": "free-v1",
  "payment_receipt": null,
  "base_pay_ready": false
}
```

**Expected Failure Response (Policy Violation):**
```json
{
  "valid": false,
  "risk_score": "HIGH",
  "violations": [
    {
      "type": "position_oversized",
      "field": "amount_usd",
      "constraint": "max_single_position",
      "actual": 500,
      "limit": 100,
      "message": "Position $500 exceeds $100 max"
    }
  ],
  "proof_hash": "b2c3d4e5f6a7890123456789012345678901bcde",
  "plan_summary": "BNKR BUY $500.00 @ 0.042 | SL: 0.038 | TP: 0.05 | 1x",
  "policy_set_hash": "01a85db0f653ef6075aba2c2e2f6adce",
  "session_id": "sess_1740751234_abc12345",
  "timestamp": "2026-02-28T15:30:00.000Z",
  "pricing_version": "free-v1",
  "payment_receipt": null,
  "base_pay_ready": false
}
```

---

## Quickstart: Python

```python
import requests
import time
import secrets

BASE_URL = "https://api.execution-protocol.ai"
AGENT_KEY = "your_agent_key_here"  # Get from EP operator

def create_proposal(asset="BNKR", amount=50, entry_price=0.042):
    """Create a validated trade proposal."""
    
    proposal = {
        "proposal_id": f"prop_{int(time.time())}_{secrets.token_hex(4)}",
        "session_id": f"sess_{int(time.time())}_{secrets.token_hex(4)}",
        "asset": asset,
        "direction": "buy",
        "amount_usd": amount,
        "entry_price": entry_price,
        "stop_loss": entry_price * 0.9,  # 10% stop
        "take_profit": entry_price * 1.2,  # 20% target
        "leverage": 1,
        "rationale": f"Python API test for {asset}",
        "agent_id": "python_example_agent",
        "policy_set_id": "olympus-v1"
    }
    
    response = requests.post(
        f"{BASE_URL}/ep/validate",
        headers={
            "Content-Type": "application/json",
            "X-Agent-Key": AGENT_KEY
        },
        json=proposal
    )
    
    result = response.json()
    
    if result["valid"]:
        print(f"✅ Proposal VALID — Risk: {result['risk_score']}")
        print(f"   Proof Hash: {result['proof_hash']}")
        print(f"   Plan: {result['plan_summary']}")
    else:
        print(f"❌ Proposal INVALID — Risk: {result['risk_score']}")
        for v in result["violations"]:
            print(f"   Violation: {v['message']}")
    
    return result

# Run validation
if __name__ == "__main__":
    # Check health first
    health = requests.get(f"{BASE_URL}/ep/health").json()
    print(f"EP Status: {health['status']} (v{health['version']})")
    
    # Validate proposal
    result = create_proposal()
```

---

## Quickstart: JavaScript/Node.js

```javascript
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://api.execution-protocol.ai';
const AGENT_KEY = 'your_agent_key_here';  // Get from EP operator

function generateId(prefix) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

async function validateProposal(asset = 'BNKR', amount = 50, entryPrice = 0.042) {
  const proposal = {
    proposal_id: generateId('prop'),
    session_id: generateId('sess'),
    asset: asset,
    direction: 'buy',
    amount_usd: amount,
    entry_price: entryPrice,
    stop_loss: entryPrice * 0.9,
    take_profit: entryPrice * 1.2,
    leverage: 1,
    rationale: `JS API test for ${asset}`,
    agent_id: 'js_example_agent',
    policy_set_id: 'olympus-v1'
  };

  try {
    const response = await axios.post(`${BASE_URL}/ep/validate`, proposal, {
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Key': AGENT_KEY
      }
    });

    const result = response.data;

    if (result.valid) {
      console.log(`✅ Proposal VALID — Risk: ${result.risk_score}`);
      console.log(`   Proof Hash: ${result.proof_hash}`);
      console.log(`   Plan: ${result.plan_summary}`);
    } else {
      console.log(`❌ Proposal INVALID — Risk: ${result.risk_score}`);
      result.violations.forEach(v => {
        console.log(`   Violation: ${v.message}`);
      });
    }

    return result;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run validation
(async () => {
  // Check health first
  const health = await axios.get(`${BASE_URL}/ep/health`);
  console.log(`EP Status: ${health.data.status} (v${health.data.version})`);
  
  // Validate proposal
  await validateProposal();
})();
```

---

## Error Handling

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid X-Agent-Key header"
}
```
**Fix:** Check your agent key with the EP operator.

### 400 Bad Request (Schema Violation)
```json
{
  "error": "Invalid proposal schema",
  "details": ["Field 'amount_usd' must be a number"]
}
```
**Fix:** Validate your JSON against the schema at `/schemas/opportunity-proposal.v1.json`.

### 429 Rate Limited
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```
**Fix:** Implement exponential backoff. Default rate limit: 100 req/min per agent.

---

## Next Steps

1. **Read the [Overview](PHASE8_OVERVIEW.md)** — Understand EP's design philosophy
2. **Review [Security Notes](SECURITY_NOTES.md)** — Security model and best practices
3. **Integrate with Bankr** — See [Bankr Integration Guide](INTEGRATION_GUIDE_BANKR.md)
4. **Check OpenAPI Spec** — See [OPENAPI_PHASE8.yaml](OPENAPI_PHASE8.yaml)

---

## Schema URLs

- **OpportunityProposal:** `https://api.execution-protocol.ai/schemas/opportunity-proposal.v1.json`
- **VerificationResult:** `https://api.execution-protocol.ai/schemas/verification-result.v1.json`
