# Lessons Learned — Phase 2 Pre-Flight (Execution Protocol)

**Date:** 2026-02-27  
**Phase:** Phase 2 DRY-RUN GO Preparation  
**Auditor:** Tier 5 (Codex 5.3 Protocol)

---

## What Worked

### API Integration Discovery
- **Bankr SKILL.md was authoritative** — API endpoint and auth header format documented there
- Environment-based credential loading worked cleanly
- IP whitelisting (3.132.54.63) prevented auth issues

### Safety-First Design Patterns
- Execution toggle (SIM/DRY_RUN/LIVE) prevented accidental broadcasts
- Default-off feature flags contained blast radius
- Fail-closed behavior on missing LIVE_OPERATOR_ACK

### Audit Process
- Tier 5 (Codex 5.3) review caught critical auth header mismatch
- Structured audit format (PASS/FINDINGS/RECOMMENDATIONS) enabled quick triage
- Pre-flight checklist prevented DRY-RUN with broken integration

---

## What Broke / Friction Points

### Critical: Auth Header Mismatch
**Issue:** BankrClient.ts used `Authorization: Bearer` instead of `X-API-Key`  
**Root Cause:** Assumed standard Bearer token format vs reading Bankr API docs  
**Impact:** Would have caused 403 errors in DRY-RUN  
**Fix:** Changed to `X-API-Key: {key}` (non-standard header)

### API Polling Timeouts
**Issue:** Long-running Bankr jobs (token verification) hit polling timeouts  
**Root Cause:** Synchronous verification scripts assumed quick responses  
**Fix:** Switched to "quick check" pattern (connectivity only, not full job completion)

### Container vs Host Architecture
**Issue:** EC2 watchdog systemd service cannot be tested in container  
**Root Cause:** systemd not available in Docker environment  
**Impact:** Code complete but deployment deferred to host access  

---

## Root Causes

1. **API Documentation Assumptions** — Did not verify auth format against Bankr SKILL.md initially
2. **Testing Environment Mismatch** — Containerized dev vs systemd-enabled production
3. **Async Job Handling** — Bankr's job-based API requires polling pattern, not request/response

---

## Process Improvements

### Pre-Integration Checklist
- [ ] Read vendor SKILL.md for auth format
- [ ] Verify endpoint URL from canonical source
- [ ] Test auth with minimal ping before complex operations
- [ ] Document expected headers in integration code comments

### Testing Patterns
- Use "quick verification" (connectivity + auth only) before deep testing
- Add timeouts with AbortController for all external API calls
- Separate container-testable code from host-specific deployment code

### Audit Discipline
- Always run Tier 5 (Codex 5.3) review before GO decisions
- Document findings in structured format (CRITICAL/HIGH/MEDIUM/LOW)
- Fix CRITICALs immediately, queue others for next phase

---

## Security Findings

### ✅ Positive
- No secrets in code (all env-based)
- No API key logging
- Fail-closed execution mode

### ⚠️ Hardening Needed
- Add request timeouts (30s default)
- Add input validation (token symbols)
- Add rate limit tracking (X-Rate-Limit headers)

---

## Token Efficiency

- Bankr verification: 3 API calls (health, tokens, quote)
- Twitter integration: Built but not yet rate-limit optimized
- EC2 watchdog: Static code (zero runtime tokens)

---

## Scope Changes

None — Phase 2 scope maintained. Blocker fixes were within existing scope.

---

## Recommendations for Phase 3 (LIVE Transition)

1. **Pre-LIVE Audit Requirements:**
   - Full adversarial review of settlement path
   - Penetration test on API authentication
   - Key rotation procedure documented

2. **Operational Hardening:**
   - Request timeouts on all external calls
   - Circuit breaker pattern for API failures
   - Comprehensive error telemetry

3. **Documentation:**
   - Runbook for LIVE Operator Acknowledgment
   - Incident response procedures
   - Rollback playbooks

---

## Sign-Off

**Phase 2 DRY-RUN:** CLEARED after blocker fixes  
**Next Review:** Phase 2 → LIVE transition (Phase 3 entry)

**Document Owner:** Execution Protocol Team  
**Review Date:** 2026-02-27
