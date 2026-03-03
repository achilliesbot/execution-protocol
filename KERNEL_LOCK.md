# Phase 3 Kernel Lock — Phase 4 Expansion Rules

**Locked Commit:** `c7dc5dc`  
**Branch:** `phase4-expansion`  
**Effective Date:** 2026-02-23

---

## Frozen Directories (Phase 3 Kernel)

These directories are **FROZEN** except for critical bug fixes:

| Directory | Contents | Status |
|-----------|----------|--------|
| `/src/canonicalization/` | Hash computation, RFC 8785 canonicalization | 🔒 FROZEN |
| `/src/transcript/` | Transcript logging, hash chain integrity | 🔒 FROZEN |
| `/src/policy/` | Policy engine, constraint validation | 🔒 FROZEN |
| `/src/execution/` | ExecutionPlan generator | 🔒 FROZEN |
| `/src/schema/` | OpportunityProposal schema | 🔒 FROZEN |

### What "Frozen" Means

**ALLOWED:**
- Critical bug fixes (with explicit approval)
- Logging improvements
- Documentation corrections
- Test additions (non-breaking)

**NOT ALLOWED:**
- Schema changes
- Hash format changes
- Transcript structure changes
- Policy model changes
- API signature changes

---

## Phase 4 Expansion Directories

These directories are **ACTIVE** for Phase 4 development:

| Directory | Purpose | Status |
|-----------|---------|--------|
| `/src/attestation/` | ERC-8004 attestation adapter | 🟢 ACTIVE |
| `/src/reputation/` | Off-chain reputation scoring | 🟢 ACTIVE |
| `/src/fees/` | Execution weight metering | 🟢 ACTIVE |
| `/src/integrations/` | External verifier SDK | 🟢 ACTIVE |

### Phase 4 Rules

1. **Read-Only to Kernel:** Phase 4 systems consume kernel outputs only
2. **No Kernel Edits:** If a feature requires modifying frozen directories, STOP and request override
3. **Dry-Run Mode:** Fee metering runs in dry-run (no real charges) until Phase 4 complete
4. **Off-Chain First:** Reputation scoring is off-chain until attestation layer validates

---

## Guardrail Protocol

If any Phase 4 feature requires editing frozen directories:

```
1. STOP work immediately
2. Document the dependency
3. Request explicit override with justification
4. Do NOT proceed without approval
```

---

## Verification Checklist

Before each commit to `phase4-expansion`:

- [ ] No files in frozen directories modified
- [ ] New code only in Phase 4 directories
- [ ] Phase 4 code uses kernel outputs (read-only)
- [ ] No schema changes to OpportunityProposal
- [ ] No changes to hash computation logic
- [ ] Documentation updated for new features

---

## Emergency Override Process

If a critical bug requires editing frozen directories:

1. Create emergency branch from `master`
2. Apply minimal fix
3. Request expedited review
4. Merge to `master` AND `phase4-expansion`
5. Document in KERNEL_LOCK.md

---

## Contact

Override requests: File issue with `OVERRIDE-REQUEST` label
