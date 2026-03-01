# Phase 8 Overview — Execution Protocol v1.0

**Publication Date:** February 2026  
**Version:** 1.0.0  
**Status:** Public Release

---

## What is Execution Protocol?

Execution Protocol (EP) is a **deterministic, verifiable infrastructure layer** for AI agent trading and economic operations. It provides policy enforcement, risk validation, and cryptographic proof-of-execution that any AI agent can integrate without trusting the operator.

Unlike traditional trading APIs that execute whatever commands they receive, EP validates every opportunity through a **policy engine** before any capital is at risk. The result is a **VerificationResult** containing a deterministic proof hash that can be independently verified.

---

## Core Concepts

### 1. OpportunityProposal
An agent submits a structured trade proposal containing:
- Asset, direction, amount, entry price
- Risk parameters (stop loss, take profit, leverage)
- Policy set reference (determines validation rules)
- Session ID for audit trail

### 2. Policy Engine
Every proposal is validated against a **policy set** — a JSON configuration defining:
- Allowed assets whitelist
- Maximum position sizes
- Leverage limits
- Required risk controls (stop loss, take profit)

Policy enforcement is deterministic: same proposal + same policy = same result, always.

### 3. VerificationResult
The output of validation contains:
- Valid/invalid status
- Risk score (LOW/MEDIUM/HIGH/CRITICAL)
- Violation details (if any)
- **Proof hash** — cryptographic fingerprint of the verification
- Plan summary and policy hash

### 4. Determinism Guarantee
EP's core differentiator is **deterministic execution proof**. Given the same inputs, EP produces:
- Identical validation results
- Identical proof hashes
- Identical audit trails

This enables:
- **Replayability:** Any third party can re-run validation and get the same proof
- **Attestation:** Proof hashes can be published on-chain (ERC-8004)
- **Dispute resolution:** Disagreements can be resolved by re-running verification

---

## Architecture Overview

```
┌─────────────────┐     POST /ep/validate      ┌──────────────────┐
│   AI Agent      │ ─────────────────────────> │  Execution       │
│  (Any Model)    │    OpportunityProposal     │  Protocol        │
└─────────────────┘                            │  v1.0            │
                                               │                  │
                                               │  ┌────────────┐  │
                                               │  │  Policy    │  │
                                               │  │  Engine    │  │
                                               │  └────────────┘  │
                                               │         │        │
                                               │         ▼        │
┌─────────────────┐     VerificationResult     │  ┌────────────┐  │
│   Agent         │ <───────────────────────── │  │  Proof     │  │
│  (Decision)     │    + Proof Hash            │  │  Hash      │  │
└─────────────────┘                            │  └────────────┘  │
                                               └──────────────────┘
```

---

## Public API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /ep/health` | None | Service health check |
| `GET /ep/status` | None | System status and policy info |
| `POST /ep/validate` | X-Agent-Key | Validate proposal against policy |
| `GET /schemas/opportunity-proposal.v1.json` | None | JSON Schema for proposals |
| `GET /schemas/verification-result.v1.json` | None | JSON Schema for results |

---

## Authentication

EP uses **X-Agent-Key** header authentication. Each agent receives a unique key:

```
X-Agent-Key: <YOUR_AGENT_KEY>
```

Keys are configured via environment variables on the EP server. No registration API — keys are provisioned out-of-band by the operator.

---

## Getting Started (5 Minutes)

### 1. Obtain an Agent Key
Contact the EP operator to receive an X-Agent-Key for your agent.

### 2. Verify Connectivity
```bash
curl https://api.execution-protocol.ai/ep/health
```

### 3. Submit Your First Proposal
```bash
curl -X POST https://api.execution-protocol.ai/ep/validate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: your_key_here" \
  -d '{
    "proposal_id": "prop_1234567890_abc123",
    "session_id": "sess_1234567890_xyz789",
    "asset": "BNKR",
    "direction": "buy",
    "amount_usd": 50,
    "entry_price": 0.042,
    "stop_loss": 0.038,
    "take_profit": 0.05,
    "leverage": 1,
    "rationale": "Testing EP integration",
    "agent_id": "my_agent_v1",
    "policy_set_id": "olympus-v1"
  }'
```

### 4. Handle the Response
```json
{
  "valid": true,
  "risk_score": "LOW",
  "violations": [],
  "proof_hash": "a1b2c3d4e5f6...",
  "plan_summary": "BNKR BUY $50.00 @ 0.042 | SL: 0.038 | TP: 0.05 | 1x",
  "policy_set_hash": "01a85db0f6...",
  "timestamp": "2026-02-28T15:30:00.000Z",
  "pricing_version": "free-v1"
}
```

---

## Use Cases

### Trading Agents
Validate trade opportunities before execution. Prevent oversized positions, unauthorized assets, or missing stop losses.

### DAO Treasury Management
Multi-sig proposals can include EP verification hashes. Treasury moves only execute if EP validation passed.

### Automated Market Makers
Before rebalancing liquidity, validate that proposed trades meet risk parameters via EP.

### Compliance & Auditing
Financial regulators can request EP proof hashes to verify that AI agents followed mandated risk controls.

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Core validation API | ✅ Live |
| Phase 2 | Policy sets & session management | ✅ Live |
| Phase 3 | Deterministic proof & transcripts | ✅ Live |
| Phase 4 | Reputation engine & attestation | ✅ Complete |
| Phase 5 | Economic activation & fee ledger | ✅ Complete |
| Phase 6 | Audit & hardening | ✅ Complete |
| Phase 7 | Determinism regression | ✅ Closed |
| **Phase 8** | **Public product & integrations** | **🚀 Active** |

---

## Integration Guides

- **[Bankr Skill Integration](INTEGRATION_GUIDE_BANKR.md)** — For Bankr bot agents
- **[Base Official Skills](INTEGRATION_GUIDE_BASE.md)** — For Base ecosystem integration
- **[API Quickstart](API_QUICKSTART.md)** — Minimal code examples
- **[Security Notes](SECURITY_NOTES.md)** — Security model & threat considerations
- **[OpenAPI Spec](OPENAPI_PHASE8.yaml)** — Complete API specification

---

## Support

- **Technical Issues:** Open an issue on GitHub
- **Integration Support:** Contact EP operator
- **Policy Configuration:** Requires operator coordination

---

## License

Execution Protocol is provided as a service. Schema specifications are public domain. Implementation details are proprietary.

---

**Seven streams. One protocol. Zero dependence.**
