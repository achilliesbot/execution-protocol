# Lessons Learned — Execution Protocol v1.0 Overhaul

**Date:** 2026-02-27  
**Author:** Codex Tier 5 Audit  
**Commit:** 185f139

---

## What Was Built

Execution Protocol v1.0 is a multi-tenant verification infrastructure for AI agent swarms:

- **Auth Layer:** X-Agent-Key header validation with agent-scoped sessions
- **Policy Engine:** Agent-agnostic constraint evaluation with olympus-v1.json policy
- **Core Endpoint:** POST /ep/validate — returns VerificationResult v1 with proof_hash
- **Session Layer:** Isolated execution environments with tamper-evident transcript logging
- **Bankr Skill:** Documentation for validate-before-execute pattern

Key architecture decisions:
- No personal wallet data exposed in any endpoint
- Deterministic proof hashes (identical proposals = identical hashes)
- Policy constraints live in JSON data files only

---

## What Broke During Testing

### BLOCKING Finding 1: Static Env Loading
**Issue:** `agentAuth.ts` loaded `process.env.EP_KEY_*` at module import time. If env vars weren't set when module loaded, they remained empty forever.

**Impact:** All auth tests failed; keys loaded as empty strings.

**Fix:** Changed to dynamic loading via `getAgentRegistry()` function called at validation time.

### BLOCKING Finding 2: Non-Deterministic Proof Hashes
**Issue:** `createResult()` included `timestamp: new Date().toISOString()` in the hash data. Each call produced a different timestamp → different hash.

**Impact:** 100-iteration determinism test failed; identical proposals produced different proof hashes.

**Fix:** Removed timestamp from `hashData` object. Timestamp still included in response but not in hash calculation.

---

## What Was Fixed

| Issue | Severity | Fix | Test Coverage |
|-------|----------|-----|---------------|
| Static env loading | BLOCKING | Dynamic `getAgentRegistry()` | auth.test.mjs (3 tests) |
| Non-deterministic hashes | BLOCKING | Remove timestamp from hash | determinism.test.mjs (100 iterations) |

---

## Test Coverage

### Auth Tests (3 tests)
- ✅ Valid key passes
- ✅ Invalid key returns 401 error
- ✅ Missing key returns 401 error

### Policy Tests (6 tests)
- ✅ Valid proposal passes olympus-v1
- ✅ Amount > $20 fails (position_oversized)
- ✅ Missing stop loss fails
- ✅ Missing take profit fails
- ✅ Leverage > 2x fails
- ✅ Disallowed asset fails

### Determinism Test (100 iterations)
- ✅ Identical proposals produce identical proof hashes
- ✅ Consistent across separate runs

### Session Tests (6 tests)
- ✅ Create session with agent_id
- ✅ Get session (scoped to agent)
- ✅ Agent B cannot read Agent A's session
- ✅ Transcript logging with hash chain
- ✅ Hash chain integrity verification
- ✅ Agent isolation in transcripts

### Adversarial Tests (6 tests)
- ✅ Policy injection (invalid policy_set_id) → rejected
- ✅ Schema fuzzing (extreme amount) → rejected
- ✅ Schema fuzzing (negative leverage) → handled without crash
- ✅ Double validation replay → idempotent behavior
- ✅ No personal data exposed in any result
- ✅ Proof hash collision resistance (different proposals = different hashes)

---

## NON-BLOCKING Findings

### 1. No Proof Endpoint Yet
**Status:** NON-BLOCKING  
**Details:** `proof.ts` route is stubbed (501 Not Implemented). Proof lookup by hash requires transcript persistence layer not yet implemented.  
**Impact:** Dashboard proof search shows "not found" for all hashes.  
**Resolution:** Implement transcript persistence to filesystem/database for production.

### 2. Schema Validation Uses Zod Only at Route Level
**Status:** NON-BLOCKING  
**Details:** `OpportunityProposal` interface in PolicyEngine.ts doesn't enforce schema at TypeScript level. Runtime validation via Zod catches issues, but compile-time safety could be improved.  
**Resolution:** Use Zod schema to generate TypeScript types for stricter compile-time checking.

### 3. Session Storage In-Memory Only
**Status:** NON-BLOCKING  
**Details:** SessionManager and TranscriptLogger use in-memory Maps. Data lost on restart.  
**Impact:** Session continuity lost across deploys.  
**Resolution:** Implement persistent storage (Redis, PostgreSQL, or filesystem) for production.

---

## What Next Phase Needs

### Phase 1.1 (Immediate)
1. Implement transcript persistence (filesystem JSONL or database)
2. Complete `GET /ep/proof/:hash` endpoint
3. Add aggregated metrics endpoint for dashboard stats

### Phase 1.2 (Short-term)
4. Redis-backed session storage for multi-instance deployments
5. Rate limiting per agent (prevent abuse)
6. Webhook notifications for validation events

### Phase 2.0 (Future)
7. Multi-policy support (beyond olympus-v1)
8. Policy versioning and migration
9. Real-time WebSocket feeds for transcript updates

---

## Key Takeaways

1. **Env loading must be dynamic** — Static import-time loading fails in containerized environments where env vars may be injected after module load.

2. **Determinism requires discipline** — Any timestamp, random value, or memory address in hash data breaks determinism. Hash only the canonical data.

3. **Agent isolation is critical** — Every data structure must be scoped by agent_id. No shared mutable state between agents.

4. **Test coverage pays off** — 21 tests across 5 categories caught 2 BLOCKING issues before deploy. Determinism test (100 iterations) was especially valuable.

---

**Audit Status:** PASS ✅  
**Deploy Readiness:** APPROVED (after Commander Gate 2)
