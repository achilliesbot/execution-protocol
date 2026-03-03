# Phase 5 — Economic Activation

**Branch:** `phase5-activation` → `master`  
**Status:** COMPLETE (merged)  
**Merge Commit:** `6b8e4f2`  
**Objective:** Transition from isolated modules → economically real system

---

## Tags

| Tag | Commit | Description |
|-----|--------|-------------|
| `phase5-core` | `24d5cc8` | Fee Ledger, OnChainClient, observability |
| `phase5-tests` | `423b345` | Module tests (FeeLedger, OnChainClient) |
| `phase5-e2e` | `f5ccf4c` | E2E harness (28 tests, determinism) |

---

## 1. ERC-8004 Real Integration

### Scope
Replace stubs with sandboxed on-chain calls.

### Constraints
- **NO mainnet writes** — devnet/testnet only
- **Feature flag:** `ENABLE_ATTESTATION=false` (default)
- **Sandbox:** All network calls wrapped in error boundaries
- **Rollback:** Single flag disables all attestation logic

### Implementation
- `src/attestation/OnChainClient.ts` — sandboxed RPC client
- `src/attestation/config.ts` — network selectors (devnet/testnet)
- Environment variable: `ATTESTATION_NETWORK=devnet`

---

## 2. Fee Accounting (Not Billing)

### Scope
Persist execution weight calculations.

### Constraints
- **NO invoicing** — calculation only
- **NO payment rails** — no actual charges
- **Storage:** Append-only fee ledger

### Implementation
- `src/fees/FeeLedger.ts` — persistent fee records
- `src/fees/FeeAccumulator.ts` — running totals per agent
- Storage: `~/.openclaw/fees/YYYY-MM-DD.jsonl`

---

## 3. Phase 5 Observability

### STATE.json Extensions
```json
{
  "phase5": {
    "attestation_status": "pending|confirmed|failed|disabled",
    "fee_accrual_total": 0,
    "reputation_score_latest": 75,
    "enabled_features": {
      "attestation": false,
      "fee_accounting": false
    }
  }
}
```

### Constraints
- **NO secrets** in STATE.json
- **Read-only** extensions (no control plane)

---

## 4. Safety Flags

### Global Kill Switch
```typescript
const PHASE5_SAFETY = {
  ATTESTATION_ENABLED: false,      // Master switch
  FEE_ACCOUNTING_ENABLED: false,   // Master switch
  NETWORK_ALLOWLIST: ['devnet'],   // No mainnet
  MAX_GAS_PER_TX: 100000,          // Hard cap
  DAILY_FEE_ACCRUAL_CAP: 10000     // Limit exposure
};
```

### Feature Flags
All Phase 5 features require explicit opt-in:
- `ENABLE_ATTESTATION=false` (default)
- `ENABLE_FEE_ACCOUNTING=false` (default)
- `ATTESTATION_NETWORK=none` (default)

---

## 5. Activation Rules

### Phase 5 Entry Criteria
1. All Phase 4 tests passing
2. Safety flags defined and default-off
3. Devnet infrastructure ready
4. Rollback plan documented

### Economic Boundaries
| Boundary | Rule |
|----------|------|
| Network | devnet/testnet only |
| Value at risk | $0 (no real funds) |
| Gas limit | 100k per transaction |
| Daily exposure | 10k fee units cap |

---

## 6. Rollback Conditions

### Automatic Rollback Triggers
- Any on-chain revert
- Gas estimation failure
- Network timeout >30s
- Unexpected fee accrual spike

### Manual Rollback
```bash
# Instant kill switch
export ENABLE_ATTESTATION=false
export ENABLE_FEE_ACCOUNTING=false
```

---

## 7. Safety Gates Validated

| Gate | Status | Evidence |
|------|--------|----------|
| Feature flags default-off | ✅ | `ENABLE_ATTESTATION === 'true'` required |
| Mainnet blocked | ✅ | `isNetworkAllowed()` only allows devnet/testnet |
| Gas cap enforced | ✅ | `MAX_GAS_PER_TX=100000` default |
| Daily fee cap | ✅ | `DAILY_FEE_ACCRUAL_CAP=10000` default |
| No side effects when disabled | ✅ | E2E harness validates |
| Determinism | ✅ | 100-iteration test passes |

---

## 8. Checklist

- [x] Branch `phase5-activation` created
- [x] PHASE5.md documented
- [x] Feature flags defined (default-off)
- [x] Sandbox wrappers implemented
- [x] FeeLedger created (append-only)
- [x] STATE.json extensions defined
- [x] Safety flags documented
- [x] Rollback plan ready
- [x] Tests passing (28 new tests)
- [x] Merged to master

---

## Status

**Phase 5 COMPLETE.** Economic activation layer delivered with safety gates.
