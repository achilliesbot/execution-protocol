# Determinism Proof — Execution Protocol (Phase 7)

**Scope:** Phase 7 — P7-1 Determinism Regression Closure

This document records the deterministic boundary, the test method, and the results of the 1000-iteration determinism suite.

---

## 1) Determinism Boundary (Explicit Design Decision)

**Definition:** For Execution Protocol, *determinism* means:

> For identical canonical inputs, the system must produce identical hashes and identical deterministic artifacts **regardless of session, machine, time, or runtime order**.

### 1.1 What is part of the deterministic hash boundary

The following inputs **MUST** affect hashes and deterministic outputs:

- Canonicalized JSON payloads (RFC-8785-style canonicalization semantics as implemented)
- Schema version identifiers (when present)
- Semantic proposal fields (intent, constraints, confidence, etc.)
- Policy set content (policy rules and constraints)
- State snapshot fields that are explicitly part of plan generation

### 1.2 What is NOT part of the deterministic hash boundary

The following fields are **metadata** and **MUST NOT** affect deterministic hashing:

- `session_id`
- Wall-clock timestamps (e.g., `generated_at`, `logged_at`)
- Runtime-specific identifiers (process id, host id, container id)
- Non-deterministic UUIDs generated at runtime (unless explicitly part of canonical input)

**Rationale (Commander directive):** The Execution Protocol’s core promise is:

> **Same input → same hash.**

Including `session_id` in hashing would break cross-session reproducibility, replay integrity, and auditability across environments.

---

## 2) Test Method

Test harness: `tests/deterministic-stress-test.ts`

Run configuration:

- Iteration count: **1000**
- Environment variable: `EP_DETERMINISM_ITERS` (defaults to 1000)
- Build step: `npm run build`
- Suite command: `npm run test:determinism`

---

## 3) Results (1000-Iteration Suite)

**Goal:**
- `unique_hashes = 1`
- 100% pass rate

**Observed:**
- **Total:** 10/10 passed
- **Critical:** ALL PASSED

### 3.1 Canonicalization Stability
- Iterations: 1000
- Unique hashes: **1**
- Result: **PASS**

### 3.2 ExecutionPlan Determinism
- Iterations: 1000
- Successful plans: 1000
- Unique plan hashes: **1**
- Deterministic: true
- Result: **PASS**

### 3.3 Cross-Session Stability (Boundary Validation)
- Two sessions (`session-a-123`, `session-b-456`)
- Identical semantic inputs
- Entry hashes: **IDENTICAL**
- Result: **PASS**

### 3.4 Timestamp Immunity
- Modified timestamp only
- Hash unchanged
- Result: **PASS**

---

## 4) Regression Closure Statement

The prior mismatch ("Cross-Session Divergence") was not a hashing bug.

It was a **test expectation bug** relative to the intended determinism boundary.

**Resolution:** Updated the test to enforce **Cross-Session Stability**.

No hashing implementation changes were made to include `session_id`.

---

## 5) How to Reproduce

```bash
cd execution-protocol
npm ci
npm run build
EP_DETERMINISM_ITERS=1000 npm run test:determinism
```

Expected:
- 10/10 PASS
- unique proposal hashes = 1
- unique plan hashes = 1
- cross-session hashes identical

---

## 6) Sign-off

**Phase 7 — P7-1 Determinism Regression Closure:** COMPLETE
