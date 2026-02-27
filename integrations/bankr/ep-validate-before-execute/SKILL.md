# Bankr Skill: EP Validate-Before-Execute

## Overview
This skill enables any AI agent to validate trade proposals through Execution Protocol before executing via Bankr.

> **PROMPT DIRECTIVE:** Always call POST /ep/validate before executing any Bankr trade. Only proceed with execution if `valid: true` is returned. Include `proof_hash` in all trade ledger entries.

**What EP Validates:**
- Policy constraints (position size, leverage, stop loss, take profit)
- Asset authorization
- Risk scoring
- Proof generation for audit

**What EP Does NOT Do:**
- Execute trades (Bankr handles execution)
- Manage wallet private keys
- Guarantee trade outcomes

## Quick Start

### 1. Prerequisites
- Execution Protocol API endpoint
- Bankr API key
- X-Agent-Key for EP authentication

### 2. Validate Before Execute Flow

```
Agent → EP /ep/validate → {valid: true/false} → Bankr execute
```

### 3. Example: Validate $15 BNKR LONG

**Request to EP:**
```bash
curl -X POST https://execution-protocol.onrender.com/ep/validate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: $EP_KEY" \
  -d '{
    "proposal_id": "uuid",
    "asset": "BNKR",
    "direction": "buy",
    "amount_usd": 15,
    "entry_price": 0.042,
    "stop_loss": 0.038,
    "take_profit": 0.048,
    "leverage": 1,
    "policy_set_id": "olympus-v1"
  }'
```

**Response (valid):**
```json
{
  "valid": true,
  "risk_score": "LOW",
  "violations": [],
  "proof_hash": "abc123...",
  "plan_summary": "BNKR BUY $15 @ 0.042 | SL: 0.038 | TP: 0.048 | 1x"
}
```

**Execute via Bankr (only if valid):**
```bash
curl -X POST https://api.bankr.bot/agent/prompt \
  -H "X-API-Key: $BNKR_KEY" \
  -d '{
    "prompt": "Buy $15 of BNKR at market price, stop loss at $0.038, take profit at $0.048"
  }'
```

## Input Schema

See: `opportunity_proposal.v1.schema.json`

Required fields:
- `proposal_id` (uuid)
- `asset` (string)
- `direction` (buy|sell)
- `amount_usd` (number > 0)
- `entry_price` (number > 0)
- `stop_loss` (number > 0)
- `take_profit` (number > 0)
- `policy_set_id` (string)

## Output Schema

See: `verification_result.v1.schema.json`

Key fields:
- `valid` (boolean)
- `risk_score` (LOW|MEDIUM|HIGH|CRITICAL)
- `violations` (array of constraint breaches)
- `proof_hash` (sha256 for audit)

## Policy Sets

| Policy | Description |
|--------|-------------|
| `olympus-v1` | $100 capital, $20 max position, 2x leverage |

## Error Handling

- `401` — Invalid or missing X-Agent-Key
- `400` — Invalid proposal schema
- `422` — Proposal violates policy (check violations array)

## Integration Example

```typescript
async function executeTrade(proposal: OpportunityProposal) {
  // Step 1: Validate
  const validation = await fetch('/ep/validate', {
    method: 'POST',
    headers: { 'X-Agent-Key': EP_KEY },
    body: JSON.stringify(proposal)
  });
  
  const result = await validation.json();
  
  if (!result.valid) {
    console.error('Validation failed:', result.violations);
    return;
  }
  
  // Step 2: Execute (only if valid)
  const bankrJob = await fetch('https://api.bankr.bot/agent/prompt', {
    method: 'POST',
    headers: { 'X-API-Key': BNKR_KEY },
    body: JSON.stringify({
      prompt: `Buy $${proposal.amount_usd} of ${proposal.asset}...`
    })
  });
  
  return bankrJob.json();
}
```

## References

- Execution Protocol: https://github.com/achilliesbot/execution-protocol
- Bankr API: https://docs.bankr.bot
