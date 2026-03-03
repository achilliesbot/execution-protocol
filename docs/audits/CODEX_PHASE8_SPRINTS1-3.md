# PASS — Phase 8 Manual Audit (Sprints 1–3)

**Audit ID:** CODEX_PHASE8_SPRINTS1-3 (Manual)

**Scope source:** Commander directive (schemas + OpenAPI + docs + /ep/simulate + rate limiting + idempotency + error standardization + telemetry + adversarial checks).

**Result:** **PASS**
- All **BLOCKING** findings discovered during this audit were fixed in-code and/or in-docs before marking PASS.

---

## 1) What was audited (traceable checklist)

### Schemas + endpoints
- [x] `GET /schemas/opportunity-proposal.v1.json` returns valid JSON Schema
- [x] `GET /schemas/verification-result.v1.json` returns valid JSON Schema
- [x] Both endpoints are accessible with **no auth**
- [x] Schema fields match the actual **validate/simulate** request/response shapes

### Documentation
- [x] `docs/phase8/OPENAPI_PHASE8.yaml` validates as **OpenAPI 3.0.3**
- [x] All six docs exist under `docs/phase8/`
- [x] `API_QUICKSTART.md` examples match real endpoint signatures (auth + error shapes)

### `POST /ep/simulate`
- [x] Returns **VerificationResult v1 + simulation object**
- [x] Simulation math verified: `expected_pnl_usd`, `max_drawdown_pct`, `risk_reward_ratio`
- [x] Requires `X-Agent-Key` (401 without)

### Rate limiting
- [x] **100 req/min per agent_id** on authenticated endpoints
- [x] **200 req/min per IP** on public endpoints
- [x] Returns `429` with `code: RATE_LIMITED` and **`Retry-After` header**

### Idempotency
- [x] Same `Idempotency-Key` within 10 minutes returns cached result
- [x] Different keys re-evaluate
- [x] Expired cache re-evaluates (verified by implementation + cache eviction logic)

### Error standardization
- [x] Every error path returns **structured JSON with `code` field**
- [x] No plain-text errors observed (incl. JSON parse failures)
- [x] All six error codes exercised/confirmed:
  - `INVALID_SCHEMA`
  - `POLICY_VIOLATION`
  - `RATE_LIMITED`
  - `UNAUTHORIZED`
  - `NOT_FOUND`
  - `INTERNAL_ERROR`

### Telemetry
- [x] `ep_status.json` and `validations_24h.json` write on 60-second interval
- [x] `GET /telemetry/status` and `GET /telemetry/validations` return correct data
- [x] No per-agent data exposed

### Adversarial
- [x] Schema fuzzing on `POST /ep/simulate` inputs
- [x] Rate-limit bypass attempts considered (see findings)
- [x] Idempotency cache poisoning attempt (different agent same key)
- [x] Telemetry endpoints reviewed for sensitive leakage

---

## 2) Test execution notes (what I actually ran)

All tests were executed against a local instance:
- `PORT=3999 EP_KEY_ACHILLES=testkey EP_KEY_ARGUS=arguskey node server.mjs`

### Validators
- JSON Schema compilation (Ajv CLI):
  - `npx -y ajv-cli@5 compile --strict=false -s src/schemas/opportunity_proposal.v1.schema.json`
  - `npx -y ajv-cli@5 compile --strict=false -s src/schemas/verification_result.v1.schema.json`
- OpenAPI validation:
  - `npx -y swagger-cli@4 validate docs/phase8/OPENAPI_PHASE8.yaml`

### Endpoint behavioral checks (representative)
- Public endpoints: `/ep/health`, `/schemas/*`, `/telemetry/*`
- Auth enforcement: missing `X-Agent-Key` → 401 UNAUTHORIZED
- Rate limiting:
  - Public exceeded → 429 + `Retry-After: 60`
  - Auth exceeded → 429 + `Retry-After: 60`
- Idempotency:
  - same key returns cached proof hash
  - different agents + same key do NOT collide

### Simulation math spot-check (buy)
Inputs:
- entry_price=1.0
- take_profit=1.2
- stop_loss=0.9
- amount_usd=10
- leverage=1

Expected:
- expected_pnl_usd = 10 * ((1.2-1.0)/1.0) * 1 = **2.00**
- max_drawdown_pct = ((1.0-0.9)/1.0)*100*1 = **10.00**
- risk_reward_ratio = (1.2-1.0)/(1.0-0.9) = **2.00**

Observed: matched.

---

## 3) Findings

### BLOCKING (fixed)

#### B1 — OpenAPI YAML was invalid (indentation / unquoted `:` in example strings)
- **Impact:** `OPENAPI_PHASE8.yaml` failed validator.
- **Fix:** Quoted example strings containing `:` and corrected formatting.

#### B2 — Schema mismatch: `session_id` required in schema but not enforced by API
- **Impact:** schema/docs vs runtime mismatch; clients can send invalid objects that “pass” server-side.
- **Fix:** Updated request validation for `/ep/validate` and `/ep/simulate` to require `session_id` and enforce `additionalProperties: false`.

#### B3 — Rate limiting did not decrement / was ineffective in local testing
- **Impact:** rate limiting requirement not met.
- **Fix:** Switched key generators to stable `req.ip` (public) and `req.agent.id || req.ip` (auth) and added conditional `TRUST_PROXY` support.

#### B4 — Missing `Retry-After` header on 429 responses
- **Impact:** scope requires `Retry-After` header.
- **Fix:** Added `Retry-After: 60` header to both rate-limit handlers and global rate-limit error path.

#### B5 — Idempotency cache poisoning risk (shared key across agents)
- **Impact:** Different agent could reuse the same idempotency key and receive cached response.
- **Fix:** Scoped cache keys to `agentId:Idempotency-Key` for both `/ep/validate` and `/ep/simulate`.

#### B6 — `POLICY_VIOLATION` code not emitted anywhere
- **Impact:** scope requires all six codes to work.
- **Fix:** Added `code: POLICY_VIOLATION` on 422 responses (while retaining VerificationResult fields + `simulation` for simulate).

#### B7 — `policy_set_hash` could be non-hex (`"missing"`) when policy not found
- **Impact:** breaks published VerificationResult schema.
- **Fix:** Always compute a SHA-256 hash (hash policy JSON or the string `"missing"`).

#### B8 — JSON parse failures could become 500 INTERNAL_ERROR
- **Impact:** violates INVALID_SCHEMA handling expectation; also could surface non-deterministic error text.
- **Fix:** Global error handler now maps JSON parse errors to `400 INVALID_SCHEMA`.

---

### NON-BLOCKING (not fixed here)

#### N1 — `npm test` currently fails (dist/test harness issues)
- **Observed:** `npm test` fails with multiple ESM export/type errors in `dist/tests/**`.
- **Why non-blocking for this audit:** Phase 8 API server behavior/requirements are met and validated manually, but CI quality signal is degraded.
- **Recommendation:** Repair or remove the failing legacy `dist/tests/**` harness, or adjust `npm test` to target Phase 8 API tests specifically.

---

## 4) Adversarial results (high-signal)

- **Schema fuzzing:** unknown fields now rejected with `400 INVALID_SCHEMA` (no crash).
- **Rate limit bypass attempts:**
  - With `TRUST_PROXY` disabled (default), IP is derived from socket and not trivially spoofable.
  - If deploying behind a reverse proxy, enable `TRUST_PROXY=1` so rate limiting works on real client IPs.
- **Idempotency poisoning:** prevented by per-agent idempotency key scoping.
- **Telemetry sensitivity:** endpoints expose only aggregate status/stats; no agent identifiers or keys.

---

## 5) Files changed during this audit (for review)

- `server.mjs`
- `src/routes/validate.js`
- `src/routes/simulate.js`
- `src/policy/PolicyEngine.js`
- `src/schemas/verification_result.v1.schema.json`
- `docs/phase8/OPENAPI_PHASE8.yaml`
- `docs/phase8/API_QUICKSTART.md`

---

## 6) PASS conditions satisfied

- All scope items verified.
- All BLOCKING findings resolved.
- OpenAPI validates.
- Endpoints behave per spec (auth, rate limits, idempotency, standardized errors, telemetry, simulation math).
