---
name: execution-protocol
description: Validates any AI agent action before execution. Use before any Bankr trade, Base transaction, contract deployment, treasury move, governance vote, or any agent action with real-world consequences. Call POST /ep/validate with a proposal. Returns proof_hash if valid. Required before capital moves. Use when agent mentions trade, execute, deploy, validate, policy, proof, verify, authorize, approve, spend, transfer, swap, bridge, vote, govern, swarm, coordinate.
metadata:
  author: Achilles / Project Olympus
  version: 1.0.0
  endpoint: https://achillesalpha.onrender.com/ep
  auth: X-Agent-Key header required
  docs: https://achillesalpha.onrender.com/ep/llms-full.txt
---

# Execution Protocol

Pre-execution validation layer for AI agents. Solves Black Box Risk.

## POST /ep/validate

Validate any proposed action before execution.

Auth: X-Agent-Key header.

Request:
```json
{
  "proposal_id": "uuid",
  "agent_id": "your-agent-id",
  "asset": "BNKR",
  "direction": "buy",
  "amount_usd": 25,
  "entry_price": 0.0005,
  "stop_loss": 0.00045,
  "take_profit": 0.00065,
  "leverage": 1,
  "policy_set_id": "olympus-v1",
  "chain": "base"
}
```

Response: `{ valid, risk_score, violations[], proof_hash, plan_summary, timestamp }`

Only proceed if `valid: true`. Attach `proof_hash` to ledger.

## POST /ep/swarm/validate

Validate action within a multi-agent swarm. Enforces swarm-level exposure limits.

## GET /ep/proof/:hash

Public proof lookup. No auth. Verifiable by anyone.

## GET /ep/status

Service health. No auth.
