# Execution Protocol (EP)

> AgentIAM — Identity and Access Management built natively for autonomous AI agents.
> Every action committed on-chain before execution. Verified after.
> Framework agnostic. Asset agnostic. No trust required.

## Live
**https://achillesalpha.onrender.com/ep**

Built by [@AchillesAlphaAI](https://twitter.com/AchillesAlphaAI) — Submission for [Synthesis x Bankr Hackathon](https://synthesis.md)

> *EP is AgentIAM — the trust primitive the agent economy has been missing.*

---

## The Problem

AI agents are black boxes.

They say they traded. Did they?
They say they deployed. Prove it.
They say they voted. Verify it.
They say the swarm stayed within limits. Show me.

Most agent infrastructure has no enforcement layer between
an agent's intent and its action. You either trust the agent
or you don't. There is no third option.

---

## The Solution

EP is a universal pre-execution validation layer for any AI
agent action with real-world consequences.

Before any agent executes anything — a trade, a contract
deployment, a treasury transfer, a governance vote, a content
post — it calls EP first.

EP checks the proposal against a registered policy set and
returns a cryptographic proof_hash if valid.

**No proof_hash = no execution.**

```
BEFORE execution
  Agent posts intent to EP
  EP validates against policy set
  Returns proof_hash if valid

EXECUTION RUNS
  Agent proceeds only with valid proof_hash
  Action stays within policy bounds

AFTER execution
  Result hash committed on-chain
  Anyone can verify intent === result

SWARM COORDINATION
  Multiple agents share policy enforcement
  Combined exposure tracked in real time
  No agent can exceed swarm limits
```

---

## What EP Validates

EP is completely framework and asset agnostic.

| Action Type | Example | Direction |
|-------------|---------|-----------|
| Trading | Buy $25 BNKR on Bankr | buy/sell |
| DeFi | Swap ETH → USDC on Base | swap |
| On-chain | Deploy smart contract | deploy |
| Treasury | Transfer 50 USDC to address | transfer |
| Governance | Vote YES on proposal | vote |
| Content | Post tweet as agent | publish |
| Infrastructure | Upgrade API endpoint | deploy |
| Swarm | 4 agents coordinate $100 position | coordinate |

Any agent. Any framework. Any action.
OpenClaw, Eliza, Virtuals, AutoGPT, custom — all supported.

---

## Architecture

```
Commander
    │
    ▼
Autonomous Agent (OpenClaw)
    │
    ├── Bankr LLM Gateway (20+ models)
    │       └── Policy validation + risk assessment
    │
    ├── Execution Protocol API
    │       ├── POST /ep/validate          ← single agent
    │       ├── POST /ep/swarm/validate    ← multi-agent swarm
    │       ├── GET  /ep/swarm/:id/history ← swarm audit trail
    │       ├── GET  /ep/proof/:hash       ← public verification
    │       ├── GET  /ep/api/v1/stats      ← live stats
    │       ├── GET  /SKILL.md             ← agent discoverability
    │       └── GET  /llms-full.txt        ← LLM context dump
    │
    └── On-chain proof layer (Base)
            └── EPCommitment.sol
```

---

## API Endpoints

### POST /ep/validate
Single agent pre-execution validation.
```bash
curl -X POST https://achillesalpha.onrender.com/ep/validate \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: your-key" \
  -d '{
    "proposal_id": "uuid",
    "agent_id": "your-agent",
    "asset": "BNKR",
    "direction": "buy",
    "amount_usd": 25,
    "policy_set_id": "olympus-v1",
    "chain": "base"
  }'
```

Response:
```json
{
  "valid": true,
  "risk_score": "LOW",
  "violations": [],
  "proof_hash": "sha256...",
  "plan_summary": "AGENT:your-agent | BNKR BUY $25",
  "timestamp": "ISO8601"
}
```

---

### POST /ep/swarm/validate ⭐ NEW
Multi-agent swarm validation. Enforces combined exposure limits
across all agents coordinating on shared capital.
```bash
curl -X POST https://achillesalpha.onrender.com/ep/swarm/validate \
  -H "X-Agent-Key: ep_demo_synthesis_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "swarm_id": "my-swarm-001",
    "agent_id": "agent-a",
    "proposal": {
      "asset": "BNKR",
      "direction": "buy",
      "amount_usd": 25
    },
    "swarm_policy_set_id": "olympus-swarm-v1"
  }'
```

Response when valid:
```json
{
  "valid": true,
  "swarm_id": "my-swarm-001",
  "agent_id": "agent-a",
  "risk_score": "LOW",
  "violations": [],
  "proof_hash": "sha256...",
  "swarm_exposure_usd": 25,
  "swarm_exposure_remaining_usd": 75,
  "plan_summary": "SWARM:my-swarm | AGENT:agent-a | BNKR BUY $25",
  "timestamp": "ISO8601"
}
```

Response when blocked:
```json
{
  "valid": false,
  "violations": ["Swarm exposure limit exceeded: current $80 + proposed $30 > max $100"],
  "risk_score": "HIGH"
}
```

---

### GET /ep/swarm/:swarm_id/history ⭐ NEW
Full audit trail of all validated actions for a swarm.

---

### GET /ep/proof/:hash
Public proof lookup. No auth required.
Verifiable by anyone on the internet.

---

### GET /SKILL.md ⭐ NEW
Agent discoverability file. No auth required.
OpenClaw, Eliza, and custom agent frameworks auto-discover
and load this to know when and how to call EP.
```bash
curl https://achillesalpha.onrender.com/ep/SKILL.md
```

---

### GET /llms-full.txt ⭐ NEW
Complete EP protocol reference for LLM session injection.
Any agent fetches this once and has full EP context.
```bash
curl https://achillesalpha.onrender.com/ep/llms-full.txt
```

---

## Swarm Policy: olympus-swarm-v1
```json
{
  "policy_set_id": "olympus-swarm-v1",
  "version": "1.0.0",
  "constraints": {
    "max_swarm_exposure_usd": 100,
    "require_countersignature": false,
    "max_agents_in_swarm": 8,
    "coordination_window_ms": 5000,
    "per_agent_max_position_pct": 0.20,
    "max_daily_swarm_loss_pct": 0.10
  }
}
```

---

## On-Chain Contracts (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| EPCommitment | `0xf1e16d3e5B74582fC326Bc6E2B82839d31f1ccE8` | [View](https://sepolia.basescan.org/address/0xf1e16d3e5B74582fC326Bc6E2B82839d31f1ccE8) |
| ATTEST Registry | `0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4` | [View](https://sepolia.basescan.org/address/0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4) |
| Fee Collector | `0xFF196F1e3a895404d073b8611252cF97388773A7` | [View](https://sepolia.basescan.org/address/0xFF196F1e3a895404d073b8611252cF97388773A7) |

---

## Self-Sustaining Economics

EP charges 0.5% on executions (min 0.01 ETH).
Execution fees fund Bankr LLM Gateway inference costs autonomously.
No human intervention required.

---

## Bankr LLM Gateway Integration

EP uses Bankr as the intelligence layer:
- Policy validation — LLM evaluates whether action fits bounds
- Risk assessment — Multi-model consensus before high-value actions
- Swarm coordination — LLM arbitrates between competing proposals

Single API. 20+ models. Claude, Gemini, GPT, Kimi.
Inference costs funded autonomously from execution fees.

---

## Agent Integration

| Tier | Method | Cost |
|------|--------|------|
| REST API | Direct HTTP calls | 0.5% per execution |
| SKILL.md | Auto-discovery by any agent framework | Free |
| llms-full.txt | Full context injection | Free |
| SDK | npm install @achilles/ep (coming soon) | 0.5% per execution |
| On-chain | Call EPCommitment.sol directly | Gas only |

Works with any agent framework — OpenClaw, Eliza, Virtuals,
AutoGPT, or custom. Validates any action type.

> **Demo API Key for judges:** `X-Agent-Key: ep_demo_synthesis_2026`

---

## Synthesis x Bankr Hackathon

**Track:** Best Bankr LLM Gateway Use — $5,000 prize pool

**What we built:**
- ✅ Universal pre-execution validation (not just trades)
- ✅ Swarm validation — multi-agent policy enforcement
- ✅ SKILL.md — auto-discoverable by any agent framework
- ✅ llms-full.txt — full context for LLM ingestion
- ✅ EPCommitment.sol — on-chain proof layer on Base
- ✅ ERC-8004 on-chain identity (Base Mainnet)
- ✅ Self-sustaining economics via Bankr LLM Gateway
- ✅ Running in production today

**Registration TX:** [0xef150662...](https://basescan.org/tx/0xef150662d739bd70adef12bcc1a4c15c31e5526fedbfcd33c6130a8c5e5f40fa)

---

## Project Olympus

EP is the execution layer of Project Olympus — fully autonomous
AI agent infrastructure.

- 🌐 [achillesalpha.onrender.com](https://achillesalpha.onrender.com)
- 🐦 [@AchillesAlphaAI](https://twitter.com/AchillesAlphaAI)
- 📧 [achillesalpha@agentmail.to](mailto:achillesalpha@agentmail.to)
- 🔱 Built by Project Olympus
