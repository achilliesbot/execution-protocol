# Bnkr.bot Integration — Execution Protocol

Date: 2026-02-27  
Status: **BUILT & VERIFIED** (API endpoints pending)

---

## 1) Overview

Execution Protocol Phase 2 integrates with **Bankr.bot** to:
- Execute buy/sell orders on Base chain
- Support Phase 2 whitelisted assets: BNKR, CLAWD, BNKRW
- Enforce capital constraints: $200 max, $40 per position, $20 max daily loss
- Provide SIM → DRY_RUN → LIVE mode progression

---

## 2) Architecture

### BnkrClient
`src/integrations/BnkrClient.ts`

Low-level HTTP client for Bankr.bot REST API. Handles:
- **healthCheck()** — API connectivity verification
- **getTradeableAssets()** — Fetch available assets
- **getMarketData(symbol)** — Current bid/ask/price
- **submitDryRunOrder(req)** — Simulation (no broadcast)
- **submitLiveOrder(req, operatorSig)** — Broadcast with operator signature
- **getOrderStatus(orderId)** — Poll order status

**Auth:** Bearer token via `BNKR_API_KEY` env var

### BnkrAdapter
`src/integrations/BnkrAdapter.ts`

Settlement bridge between Execution Protocol and Bankr.bot. Maps:
- ExecutionPlan → BnkrOrderRequest
- Execution mode (SIM/DRY_RUN/LIVE) → appropriate endpoint

**Core method:** `settle(asset, direction, amount_usd, stop_loss?, take_profit?)`
- SIM: Returns placeholder
- DRY_RUN: Calls `/orders/dry-run`, gets slippage simulation
- LIVE: Calls `/orders/live`, gets tx_hash + filled price

**Asset verification:** `verifyPhase2Assets()`
- Checks BNKR, CLAWD, BNKRW are tradeable
- Called pre-deployment to validate asset availability

---

## 3) Configuration

### Environment Variables

```bash
BNKR_URL=https://bankr.bot/api              # API base URL
BNKR_API_KEY=bk_XXXXXXXXXXXXXXXXXXXXX       # Bearer token
EXECUTION_MODE=SIM|DRY_RUN|LIVE             # Default: SIM
LIVE_OPERATOR_ACK=I_UNDERSTAND_LIVE         # Required for LIVE broadcast
OPERATOR_SIGNATURE=<hex_string>             # Optional: operator signing key
```

### Default Behavior

- **Execution Mode:** SIM (safe default)
- **LIVE Broadcasting:** Disabled unless both EXECUTION_MODE=LIVE AND LIVE_OPERATOR_ACK explicitly set
- **Trade Ledger:** Append-only JSONL with Bnkr settlement artifacts

---

## 4) API Endpoints (Bankr.bot)

**Note:** Bankr.bot API endpoint discovery in progress. Current BNKR_URL (`https://bankr.bot/api`) returns web UI. Confirm the following endpoints with Bankr.bot API docs:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | API health check | ⏳ Verify |
| `/assets` | GET | List tradeable assets | ⏳ Verify |
| `/markets/{symbol}` | GET | Current market data | ⏳ Verify |
| `/orders/dry-run` | POST | Simulation order | ⏳ Verify |
| `/orders/live` | POST | Live order broadcast | ⏳ Verify |
| `/orders/{orderId}` | GET | Order status polling | ⏳ Verify |

**Action Items:**
1. Confirm Bankr.bot REST API endpoint structure (may differ from standard paths)
2. Update BnkrClient endpoint URLs if needed
3. Re-run verification script once endpoints confirmed

---

## 5) Phase 2 Assets

**Required tradeable assets (whitelist):**
- **BNKR** — Bankr governance token
- **CLAWD** — Clause protocol token
- **BNKRW** — Bankr wrapped asset

All three must be tradeable on Bankr.bot before Phase 2 LIVE capital deployment.

**Verification Flow:**
```bash
npm run verify-bnkr  # Runs scripts/verify-bnkr-integration.mjs
```

---

## 6) Execution Modes

### SIM (Simulated)
- Default mode
- No Bankr API calls
- Orders logged to trade ledger
- Settlement artifacts are placeholders
- **Use:** Testing, circuit training

### DRY_RUN (Deterministic Simulation)
- Calls Bankr.bot `/orders/dry-run` endpoint
- Returns: `order_id`, `would_be_price`, `would_be_slippage_bps`
- No actual broadcast
- Full traceability: tx payload hash + Bnkr response saved to ledger
- **Use:** Pre-deployment validation, Sharpe/PnL simulation

### LIVE (Production)
- Broadcasts via `/orders/live`
- Requires: `EXECUTION_MODE=LIVE` AND `LIVE_OPERATOR_ACK=I_UNDERSTAND_LIVE`
- Operator signature required (HSMS / hardware signer in production)
- Returns: `tx_hash`, `filled_price`, `order_id`
- **Use:** Real capital deployment

---

## 7) Error Handling

| Scenario | Behavior |
|----------|----------|
| API unreachable | Fail-closed; no trade execution |
| Asset not tradeable | Asset verification fails; no deployment |
| Missing LIVE_OPERATOR_ACK | LIVE broadcast denied; falls back to DRY_RUN |
| Order rejection (policy breach) | PolicyEngine blocks before Bnkr call; logged |
| Bnkr timeout | Retry once; escalate to Commander |

---

## 8) Trade Ledger Integration

Every trade via Bnkr is logged to:
- **File:** `~/.openclaw/trades/YYYY-MM-DD.jsonl`
- **Schema:** Deterministic hash chain + settlement artifacts

**Example entry:**
```json
{
  "session_id": "session-bnkr-001",
  "signal_id": "sig_abc123",
  "signal_hash": "sha256:...",
  "plan_hash": "sha256:...",
  "policy_set_hash": "sha256:...",
  "transcript_head_hash": "sha256:...",
  "asset": "BNKR",
  "direction": "buy",
  "amount_usd": 20,
  "settlement": {
    "mode": "DRY_RUN",
    "bnkr_order_id": "order_abc123",
    "bnkr_price": 2.50,
    "bnkr_slippage_bps": 15,
    "timestamp": "2026-02-27T04:39:00Z"
  },
  "entry_hash": "sha256:...",
  "prev_entry_hash": "sha256:..."
}
```

---

## 9) Testing

### Unit Tests
```bash
npm run test:bnkr-client         # BnkrClient connectivity tests
npm run test:bnkr-adapter        # BnkrAdapter settlement flow
npm run test:bnkr-phase2-caps    # Phase 2 policy enforcement vs Bnkr orders
```

### Integration Verification
```bash
node scripts/verify-bnkr-integration.mjs
```

Checks:
- API health
- Phase 2 assets (BNKR, CLAWD, BNKRW) tradeable
- Market data sample

---

## 10) Security Notes

- **API Key:** Stored in container env; never committed to repo
- **Operator Signature:** Out-of-process only; HSMS signing recommended for LIVE
- **Trade Ledger:** Tamper-evident; reconciliation validates hash chain
- **Broadcasting:** Fail-closed by default (SIM mode)

---

## 11) Phase 2 Deployment Checklist

- [x] BnkrClient implemented
- [x] BnkrAdapter implemented
- [x] Execution mode toggles operational
- [x] Trade ledger integration verified
- [ ] Confirm Bankr.bot API endpoint structure
- [ ] Re-run verification script (endpoints confirmed)
- [ ] Deploy to DRY_RUN mode
- [ ] Validate 5–10 DRY_RUN trades
- [ ] Commander approval for LIVE mode
- [ ] Deploy LIVE with $200 initial capital

---

## 12) References

- **Execution Protocol:** docs/PHASE3_ARCHITECTURE.md
- **Phase 2 Policy:** `createPhase2PolicySet()` in `src/policy/PolicyEngine.ts`
- **Trade Ledger:** `src/ledger/TradeLedger.ts`
- **Execution Modes:** `src/config/ExecutionMode.ts`
