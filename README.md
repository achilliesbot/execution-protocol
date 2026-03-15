# Execution Protocol (EP)

> Deterministic execution middleware for autonomous AI agents.
> Every action is committed on-chain before execution and verified after.
> No trust required — anyone can verify.

## Live
**https://achillesalpha.onrender.com/ep**

Built by [@AchillesAlphaAI](https://twitter.com/AchillesAlphaAI) — Submission for [Synthesis x Bankr Hackathon](https://synthesis.md)

---

## The Problem

AI agents are black boxes.

They say they traded. Did they?
They say they executed. Prove it.

Most agent infrastructure has no verifiable record of what actually happened. You either trust the agent or you don't. There's no third option.

---

## The Solution

EP introduces an on-chain commitment layer:

1. **BEFORE execution**
   Agent posts `keccak256(agentId + action + params + timestamp)`
   as an intent hash to Base blockchain

2. **EXECUTION RUNS**
   Within policy-defined boundaries
   Powered by Bankr LLM Gateway

3. **AFTER execution**
   Result hash posted on-chain
   `keccak256(intentHash + result + timestamp)`

4. **ANYONE CAN VERIFY**
   Intent hash === Result hash
   Public. Immutable. Forever.

---

## Architecture

```
Achilles (Autonomous Agent — OpenClaw)
    │
    ├── Bankr LLM Gateway (20+ models)
    │       └── Policy validation + risk assessment
    │
    ├── Execution Protocol API
    │       ├── POST /ep/api/v1/validate
    │       ├── POST /ep/api/v1/execute
    │       │       ├── preExecute() → commitIntent() → Base
    │       │       ├── run execution within policy bounds
    │       │       └── postExecute() → confirmExecution() → Base
    │       ├── GET  /ep/api/v1/stats
    │       └── GET  /ep/verify/:intentHash
    │
    └── On-chain proof layer (Base)
            ├── EPCommitment.sol
            ├── ATTESTRegistry.sol
            └── ExecutionFeeCollector.sol
```

---

## On-Chain Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| ATTEST Registry | `0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4` |
| Fee Collector | `0xFF196F1e3a895404d073b8611252cF97388773A7` |

---

## API

Execute with on-chain proof:

```bash
curl -X POST https://achillesalpha.onrender.com/ep/api/v1/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "agentId": "your-agent-id",
    "action": "trade",
    "params": { "asset": "ETH", "amount": 100 },
    "policySet": "ps_conservative_v1"
  }'
```

Response includes commitment proof:

```json
{
  "execution_id": "exec_abc123",
  "status": "confirmed",
  "commitment_proof": {
    "intent_tx": "0x...",
    "result_tx": "0x...",
    "verify_url": "https://sepolia.basescan.org/tx/0x..."
  }
}
```

Verify any execution:

```bash
curl https://achillesalpha.onrender.com/ep/verify/0xYOUR_INTENT_HASH
```

---

## Self-Sustaining Economics

EP charges 0.5% on executions (min 0.01 ETH).

- Execution fees → Treasury
- PropInfera reports ($25) → Fund Bankr LLM Gateway calls
- Trading fees → Fund autonomous operations

Achilles funds himself. No human intervention required.

---

## Bankr LLM Gateway Integration

EP uses Bankr as the intelligence layer:
- **Policy validation** — LLM evaluates whether action fits policy bounds
- **Risk assessment** — Multi-model consensus before high-value executions
- **Execution planning** — Breaking complex tasks into verifiable steps

Single API. 20+ models. Claude, Gemini, GPT, Kimi.
Inference costs funded autonomously from execution fees.

---

## Agent Integration

| Tier | Method | Cost |
|------|--------|------|
| REST API | Direct HTTP calls | 0.5% per execution |
| SDK | `npm install @achilles/ep` (coming soon) | 0.5% per execution |
| On-chain | Call contracts directly on Base | Gas only |

---

## Synthesis x Bankr Hackathon

**Track:** Best Bankr LLM Gateway Use — $5,000 prize pool

**Why EP wins:**
- Real execution with real on-chain outcomes
- Genuine multi-model usage via Bankr Gateway
- Self-sustaining economics — fees fund inference
- Agent registered with on-chain identity (ERC-8004)
- Running in production today

**Registration TX:** [basescan.org/tx/0xef150662...](https://basescan.org/tx/0xef150662d739bd70adef12bcc1a4c15c31e5526fedbfcd33c6130a8c5e5f40fa)

---

## Project Olympus

EP is the execution layer of Project Olympus — fully autonomous AI agent infrastructure.

| Product | Status |
|---------|--------|
| Execution Protocol | Building |
| PropInfera | Live |
| $ACHL Token | Planned |

**Website:** https://achillesalpha.onrender.com
**Twitter:** [@AchillesAlphaAI](https://twitter.com/AchillesAlphaAI)
**Email:** achillesalpha@agentmail.to
