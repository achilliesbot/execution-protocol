# Lessons Learned — Phase 7 (Execution Protocol)

Date: 2026-02-26

---

## What worked

- **Determinism boundary discipline:** explicit decision that `session_id` is metadata → reproducible hashes across environments.
- **1000-iteration determinism proof:** scaling from 100 → 1000 surfaced only expectation mismatch; no core drift.
- **Policy cap formalization:** Phase 2 policy set is explicit and adversarially tested; caps are enforceable at the boundary.
- **Fail-closed broadcast gate:** LIVE requires an explicit operator acknowledgment; DRY_RUN never touches broadcast.
- **Append-only, tamper-evident trade ledger:** hash chaining + reconciliation provides audit-grade traceability.

## What broke / friction points

- **ESM entrypoint quirks:** test harnesses initially relied on `require.main` (not ESM-safe).
- **Constraint evaluation subtlety:** treating `null` as “missing” enabled an unintended fallback path; fixed to treat null as explicit.
- **Path + env semantics:** modules that compute constants at import time can ignore late env changes (HOME/paths) — relevant for tooling.

## Root causes

- Boundary ambiguities (hash inputs vs metadata) create test expectation drift.
- JavaScript/TypeScript ESM differences encourage subtle runtime failures when tests are executed directly.

## Process improvements

- Document boundaries first, then write tests (boundary-driven tests).
- Keep “policy enforcement” adversarial harnesses as first-class CI checks.
- Maintain a single “execution mode” gate module to prevent broadcast creep.

## Security findings

- No secrets in repo; `.gitignore` + secret scan script are mandatory.
- Broadcast impossible unless explicitly toggled (two-factor style env gate).

## Token efficiency

- DRY_RUN produces deterministic artifacts without on-chain cost.

## Scope changes / notes

- DRY_RUN tx payload generation is deterministic placeholder until real settlement adapters are integrated.

## Recommendations for Phase 8

- Expand reconciliation: cross-check ledger entries against transcript store.
- Add more adversarial cases: partial-file truncation, reordered JSONL lines.
- Implement structured “SettlementArtifact” schema with versioning.

