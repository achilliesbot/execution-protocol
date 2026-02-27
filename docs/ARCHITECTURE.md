# Execution Protocol v2 — Architecture

## Design Philosophy

**Agent-Agnostic Infrastructure**

Execution Protocol is not built for Olympus agents. It is built for *any* AI agent that needs deterministic, verifiable, secure execution.

### Core Principles

1. **Zero Trust** — Every action validated at multiple checkpoints
2. **Deterministic** — Same input → Same output, always
3. **Verifiable** — Cryptographic proof of every execution step
4. **Composable** — Agents plug in, execute, export proof
5. **Capital-Safe** — Zero-loss tolerance in all modes

## Security Model

### Multi-Point Validation

```
Intent → Validate → Simulate → Approve → Execute → Verify → Log
         ↑________↑________↑________↑________↑________↑
              Security checkpoints at each stage
```

### Checkpoint Details

| Stage | Validation | Failure Action |
|-------|------------|----------------|
| 1. Intent | Schema validation | Reject, log error |
| 2. Constraints | Max loss, capital limits | Reject, alert |
| 3. Simulation | Dry-run execution | Reject if simulation fails |
| 4. Approval | Token/permission check | Queue for approval |
| 5. Execution | Atomic transaction | Rollback, log failure |
| 6. Verification | Hash chain validation | Alert, quarantine |
| 7. Logging | Immutable transcript | Continue (logging is best-effort) |

## Agent Interface

Any agent connects via:

```typescript
const session = ExecutionProtocol.createSession({
  agentId: 'any-agent-uuid',
  intent: { /* agent-defined schema */ },
  constraints: { maxLoss: 0.02, maxCapital: 100 }
});

const result = await session.execute();
// result.transcript contains cryptographic proof
```

## Canonicalization & RFC 8785

### Scope Clarification

The Execution Protocol v2 canonicalization layer provides **RFC 8785-compatible** deterministic JSON serialization:

- **Key sorting**: Lexicographic (RFC 8785 §3.2.3 compliant)
- **Number formatting**: Standard JSON (IEEE 754 binary64)
- **Unicode handling**: Standard JSON string escaping

**Note**: This is an RFC 8785-compatible implementation, not a strict JCS validator. For cryptographic applications requiring strict RFC 8785 conformance, validate output against a dedicated JCS library.

### Field Denylist (NON_HASHED_FIELDS_DENYLIST)

Fields stripped before hashing (to prevent hash drift):
- `timestamp`, `created_at`, `updated_at`, `logged_at`
- `nonce`, `random`, `generated_at`
- `entry_id`, `plan_id`

**Critical**: `session_id` is **INTENTIONALLY EXCLUDED** from the denylist. Transcript hashes must be session-bound for proper isolation.

### Transcript Hash Chain

**Transcript Head Definition** (GOVERNANCE.md §4):

```
final_hash = H(entry_n)

where each entry hash:
H(canonical({
  session_id,      // Session-bound (NOT stripped)
  previous_hash,   // Chain link
  entry_type,      // Entry classification
  content,         // Payload
  agent_id,        // Actor
  model            // LLM version
}))
```

**Invariants**:
- NO timestamps in hash input
- NO runtime-generated IDs (`entry_id`, `Date.now()`)
- NO random values
- Deterministic by construction, not mutation

## Component Architecture

See README.md for component details.

## Phase 4 Expansion Modules

Phase 4 adds read-only capabilities that consume kernel outputs:

| Module | Path | Purpose | Status |
|--------|------|---------|--------|
| Verifier SDK | `src/integrations/` | External transcript validation | [VerifierSDK.ts](../src/integrations/VerifierSDK.ts) |
| Attestation | `src/attestation/` | ERC-8004 attestation adapter | [ERC8004Adapter.ts](../src/attestation/ERC8004Adapter.ts) |
| Reputation | `src/reputation/` | Off-chain scoring engine | [ReputationEngine.ts](../src/reputation/ReputationEngine.ts) |
| Fee Metering | `src/fees/` | Execution weight calculation | [FeeMetering.ts](../src/fees/FeeMetering.ts) |

All Phase 4 modules are read-only consumers of Phase 3 kernel outputs.

## Security Checklist

- [ ] All inputs sanitized
- [ ] All outputs validated
- [ ] Hash chain unbroken
- [ ] Capital constraints enforced
- [ ] Approval gates respected
- [ ] No secrets in logs
- [ ] Rollback on failure
