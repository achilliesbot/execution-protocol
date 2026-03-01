# Agent Payment Flow — Execution Protocol v1.0

**Document:** Third-party integration guide for USDC fee payments on Base  
**Scope:** How agents compute `requestId`, approve USDC, call `pay()`, then call `/ep/validate`  
**Network:** Base (chainId 8453)  
**Fee Asset:** USDC (6 decimals)  
**Contract:** `BasePayContract.sol`  

---

## Overview

Execution Protocol requires a USDC micro-fee per validation request. This doc describes the complete agent-side flow:

1. **Compute** `requestId` from canonical payload  
2. **Approve** USDC to the BasePayContract  
3. **Call** `pay(requestId)` on BasePayContract  
4. **Call** `/ep/validate` with the same payload  
5. **Receive** 200 OK (or 402 if payment missing)  

---

## Step 1: Compute requestId (Deterministic)

The `requestId` is the SHA-256 hash of a **canonical JSON** payload. It must match exactly between the agent's `pay()` call and the EP server's verification.

### Canonical JSON structure

```json
{
  "agent_id": "<your-agent-id>",
  "policy_set_id": "<policy-set-id>",
  "endpoint": "/ep/validate",
  "proposal": { ... }
}
```

### Canonicalization rules (MUST follow exactly)

1. **Keys sorted alphabetically** (lexicographic order)
2. **No extra whitespace** outside JSON spec
3. **No undefined fields** — omit nulls or include as explicit null consistently
4. **proposal** must itself be canonicalized (keys sorted, same rules apply recursively)

### Example (JavaScript/TypeScript)

```typescript
import crypto from 'node:crypto';

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

function computeRequestId(agentId: string, policySetId: string, proposal: object): string {
  const payload = {
    agent_id: agentId,
    policy_set_id: policySetId,
    endpoint: '/ep/validate',
    proposal
  };
  const canon = stableStringify(payload);
  const hash = crypto.createHash('sha256').update(canon).digest('hex');
  return '0x' + hash;
}
```

### Example (Python)

```python
import json
import hashlib

def stable_stringify(obj):
    if obj is None or not isinstance(obj, dict):
        return json.dumps(obj)
    if isinstance(obj, list):
        return '[' + ','.join(stable_stringify(x) for x in obj) + ']'
    keys = sorted(obj.keys())
    pairs = [f'{json.dumps(k)}:{stable_stringify(obj[k])}' for k in keys]
    return '{' + ','.join(pairs) + '}'

def compute_request_id(agent_id: str, policy_set_id: str, proposal: dict) -> str:
    payload = {
        'agent_id': agent_id,
        'policy_set_id': policy_set_id,
        'endpoint': '/ep/validate',
        'proposal': proposal
    }
    canon = stable_stringify(payload)
    h = hashlib.sha256(canon.encode('utf-8')).hexdigest()
    return '0x' + h
```

**Critical:** If `requestId` differs between `pay()` and EP server's check, payment will not be detected and you'll receive 402 PAYMENT_REQUIRED.

---

## Step 2: Approve USDC

Agents must approve the BasePayContract to spend USDC on their behalf.

### USDC Contract (Base mainnet)

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### Approval amount

- **Minimum:** `feeAmount` (currently 100000 = 0.10 USDC)
- **Recommended:** Approve slightly more (e.g., 10 USDC) to batch multiple validations without repeated approvals

### Example (Ethers v6)

```typescript
import { ethers } from 'ethers';

const USDC_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

async function approveUSDC(
  signer: ethers.Signer,
  basePayContract: string,
  amount: bigint
) {
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const tx = await usdc.approve(basePayContract, amount);
  await tx.wait();
  console.log('USDC approved:', tx.hash);
}
```

---

## Step 3: Call pay(requestId)

Once USDC is approved, call `pay()` with the computed `requestId`.

### BasePayContract interface

```solidity
function pay(bytes32 requestId) external
function feeAmount() view returns (uint256)
function isPaid(bytes32 requestId) view returns (bool)
```

### Example (Ethers v6)

```typescript
const BASE_PAY_ABI = [
  'function pay(bytes32 requestId) external',
  'function feeAmount() view returns (uint256)',
  'function isPaid(bytes32 requestId) view returns (bool)',
  'event Paid(bytes32 indexed requestId, address indexed payer, uint256 amount)'
];

async function payForValidation(
  signer: ethers.Signer,
  basePayContract: string,
  requestId: string
) {
  const contract = new ethers.Contract(basePayContract, BASE_PAY_ABI, signer);
  
  // Optional: check if already paid (idempotent safety)
  const alreadyPaid = await contract.isPaid(requestId);
  if (alreadyPaid) {
    console.log('Already paid for this requestId');
    return;
  }
  
  const tx = await contract.pay(requestId);
  const receipt = await tx.wait();
  console.log('Payment confirmed:', receipt.hash);
  
  // Verify onchain
  const confirmed = await contract.isPaid(requestId);
  if (!confirmed) throw new Error('Payment not recorded');
}
```

**Error codes to handle:**
- `ALREADY_PAID` — requestId already has a receipt (idempotent — safe to proceed)
- `TRANSFER_FAILED` — insufficient USDC allowance or balance
- `FEE_DISABLED` — contract has feeAmount = 0 (should not happen in production)

---

## Step 4: Call /ep/validate

With payment onchain, call the EP validation endpoint.

### Request

```
POST /ep/validate
Headers:
  X-Agent-Key: <your-agent-key>
  Content-Type: application/json

Body:
  <same proposal object used to compute requestId>
```

### Success Response (200)

```json
{
  "valid": true,
  "risk_score": "LOW",
  "recommendation": "PROCEED",
  "policy_set_id": "olympus-polymarket-v1",
  "request_id": "0x...",
  "verification_id": "ep_v_...",
  "timestamp": "2026-03-01T..."
}
```

### Payment Required Response (402)

```json
{
  "code": "PAYMENT_REQUIRED",
  "error": "Payment required",
  "message": "USDC fee required before validation",
  "fee_usdc_6dp": "100000",
  "request_id": "0x...",
  "contract_address": "0x...",
  "timestamp": "2026-03-01T..."
}
```

**Action on 402:** Compute requestId → approve USDC → call pay() → retry /ep/validate

---

## Step 5: Telemetry Check (Optional)

Agents can verify their payments are being tracked:

```
GET /telemetry/payments
```

Response:

```json
{
  "total_required": 10,
  "total_paid": 10,
  "total_402": 0,
  "total_usdc": 1.0,
  "timestamp": "2026-03-01T..."
}
```

---

## Complete Integration Example (TypeScript)

```typescript
import { ethers } from 'ethers';
import crypto from 'node:crypto';

const EP_BASE_URL = 'https://execution-protocol.onrender.com';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

class EPAgentClient {
  private signer: ethers.Signer;
  private basePayContract: string;
  private agentKey: string;
  private agentId: string;

  constructor(signer: ethers.Signer, basePayContract: string, agentKey: string, agentId: string) {
    this.signer = signer;
    this.basePayContract = basePayContract;
    this.agentKey = agentKey;
    this.agentId = agentId;
  }

  private stableStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(this.stableStringify).join(',') + ']';
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return '{' + keys.map(k => `${JSON.stringify(k)}:${this.stableStringify((obj as Record<string, unknown>)[k])}`).join(',') + '}';
  }

  private computeRequestId(policySetId: string, proposal: object): string {
    const payload = { agent_id: this.agentId, policy_set_id: policySetId, endpoint: '/ep/validate', proposal };
    const canon = this.stableStringify(payload);
    return '0x' + crypto.createHash('sha256').update(canon).digest('hex');
  }

  async payForValidation(requestId: string): Promise<void> {
    const abi = ['function pay(bytes32 requestId) external', 'function isPaid(bytes32 requestId) view returns (bool)'];
    const contract = new ethers.Contract(this.basePayContract, abi, this.signer);
    if (await contract.isPaid(requestId)) return;
    const tx = await contract.pay(requestId);
    await tx.wait();
  }

  async validate(policySetId: string, proposal: object) {
    const requestId = this.computeRequestId(policySetId, proposal);
    
    const res = await fetch(`${EP_BASE_URL}/ep/validate`, {
      method: 'POST',
      headers: { 'X-Agent-Key': this.agentKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal)
    });

    if (res.status === 402) {
      // Pay and retry
      await this.payForValidation(requestId);
      return this.validate(policySetId, proposal); // Retry once
    }

    if (!res.ok) throw new Error(`EP error: ${res.status}`);
    return res.json();
  }
}
```

---

## Testing Your Integration

### Testnet Setup (Base Sepolia)

1. Get Base Sepolia USDC from faucet
2. Deploy/test against testnet contract address (provided separately)
3. Set `EP_BASE_URL` to testnet EP instance

### Test Checklist

- [ ] `requestId` matches between client compute and EP server verification  
- [ ] Payment succeeds with sufficient USDC allowance  
- [ ] 402 received when payment missing  
- [ ] 200 received after valid payment  
- [ ] Double-pay is idempotent (ALREADY_PAID safe to ignore)  
- [ ] `stableStringify` produces identical output across languages  

---

## Support

**Contract repo:** `github.com/achilliesbot/execution-protocol`  
**Contract:** `contracts/BasePayContract.sol`  
**Issues:** Open ticket in repo with `requestId`, `agent_id`, and tx hash  

