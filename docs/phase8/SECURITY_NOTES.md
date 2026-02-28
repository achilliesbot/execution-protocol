# Security Notes — Execution Protocol v1.0

**Classification:** Public — For External Developers  
**Last Updated:** February 2026

---

## Security Model Overview

Execution Protocol operates on a **fail-closed, defense-in-depth** security model. Every operation requires explicit validation, and defaults reject rather than accept.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Fail Closed** | Missing auth, invalid schema, or policy violation → rejection |
| **Determinism** | Same inputs always produce same outputs (no randomness in validation) |
| **Proof Not Trust** | Cryptographic hashes replace trust assumptions |
| **Minimal Attack Surface** | No database, no complex state, no external dependencies for core validation |
| **Audit Everything** | Every validation is logged with transcript hash |

---

## Authentication & Authorization

### X-Agent-Key Header

All validation endpoints require the `X-Agent-Key` header:

```
X-Agent-Key: ep_key_{agent}_{hash}
```

**Security Properties:**
- Keys are **opaque strings** — no encoding of privileges or identity
- Keys are **provisioned out-of-band** — no registration API to attack
- Keys are **environment-bound** — production keys don't work in staging
- Failed auth returns **generic 401** — no enumeration of valid keys

### Key Rotation

- Keys can be rotated by the EP operator without code changes
- Old keys are invalidated immediately upon rotation
- No grace period (agents must handle 401 and request new key)

---

## Input Validation

### Schema Enforcement

All proposals are validated against strict JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["proposal_id", "asset", "amount_usd", ...],
  "properties": { ... },
  "additionalProperties": false
}
```

**Security Impact:**
- `additionalProperties: false` prevents injection of unexpected fields
- Type enforcement prevents type confusion attacks
- Pattern validation on IDs prevents format-based attacks

### Size Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Request body | 100KB | Prevent memory exhaustion |
| String fields | 2KB each | Prevent log injection |
| Violations array | 50 items max | Prevent DoS via error amplification |
| Rationale field | 2,000 chars | Prevent abuse of text fields |

---

## Policy Enforcement

### Policy as Code

Policies are JSON files loaded at startup:

```json
{
  "constraints": {
    "allowed_assets": ["BNKR", "ETH", "USDC"],
    "max_single_position": 100,
    "max_leverage": 2,
    "stop_loss_required": true,
    "take_profit_required": true
  }
}
```

**Security Properties:**
- Policies are **immutable at runtime** — no runtime policy changes
- Policy hash is **included in verification result** — tampering detectable
- Multiple policy sets can coexist — agents validated against their assigned set

### Constraint Types

| Constraint | Attack Prevented |
|------------|------------------|
| `allowed_assets` | Unauthorized asset injection |
| `max_single_position` | Capital drain via oversized positions |
| `max_leverage` | Liquidation cascade risk |
| `stop_loss_required` | Uncapped downside exposure |
| `take_profit_required` | Runaway greed (no exit plan) |

---

## Determinism & Replay Attacks

### Deterministic Output

EP guarantees that the same inputs produce:
- Identical validation results
- Identical proof hashes
- Identical violation lists

**Security Benefit:**
- Attackers cannot manipulate validation by timing or randomness
- Third parties can replay and verify any proof hash
- Disputes resolved by re-running validation

### Replay Attack Prevention

While validation is deterministic, **ephemeral state prevents replays:**

```javascript
// Proof hash includes timestamp
const hashInput = {
  proposal,
  violations,
  agentId,
  timestamp: Date.now()  // Always unique
};
```

**Important:** `timestamp` is metadata, not part of determinism proof. The core validation logic remains deterministic.

---

## Proof Hash Security

### Hash Construction

```javascript
proof_hash = SHA256(
  canonical_json(proposal) +
  canonical_json(violations) +
  agent_id
).slice(0, 32)
```

**Security Properties:**
- **SHA-256** — collision-resistant, preimage-resistant
- **Canonical JSON** — no key-order attacks
- **Truncated to 32 chars** — sufficient entropy, readable logs

### Verification

Anyone can verify a proof:

```javascript
const expectedHash = SHA256(
  canonical_json(proposal),
  canonical_json(violations),
  agent_id
).slice(0, 32);

assert(proof_hash === expectedHash);
```

---

## Network Security

### Transport

- **TLS 1.3** required in production
- **HSTS** headers enforced
- No plaintext HTTP endpoints (except `/ep/health` on internal networks)

### Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| Free | 100 req/min | Per agent key |
| Standard | 1,000 req/min | Per agent key |
| Premium | 10,000 req/min | Per agent key |

**Rate limit headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1740751800
```

### IP Allowlisting (Optional)

Enterprise deployments can configure IP allowlists per agent key:

```json
{
  "agent_id": "enterprise_trader",
  "allowed_ips": ["203.0.113.0/24", "198.51.100.10"]
}
```

---

## Threat Model

### Threats EP Prevents

| Threat | Mitigation |
|--------|------------|
| **Unauthorized trading** | X-Agent-Key auth + policy enforcement |
| **Oversized positions** | `max_single_position` constraint |
| **High-leverage blowups** | `max_leverage` constraint |
| **Missing stop losses** | `stop_loss_required` constraint |
| **Replay attacks** | Ephemeral timestamps in hash input |
| **Log injection** | Size limits + sanitization |
| **DoS via large payloads** | 100KB body limit |
| **Enumeration attacks** | Generic error messages |

### Threats EP Does NOT Prevent

| Threat | Responsibility |
|--------|----------------|
| **Compromised agent key** | Agent operator — rotate immediately |
| **Front-running** | Settlement layer (not EP's scope) |
| **Smart contract bugs** | Contract audit (EP validates intent, not code) |
| **Oracle manipulation** | Price feed security (outside EP) |
| **Social engineering** | Human processes (not technical) |

---

## Security Checklist for Integrators

Before deploying an EP integration:

- [ ] **Store agent keys securely** — environment variables, never code
- [ ] **Handle 401 errors gracefully** — key rotation is normal
- [ ] **Validate responses** — check `valid` field before acting
- [ ] **Log proof hashes** — audit trail for compliance
- [ ] **Implement retry with backoff** — respect rate limits
- [ ] **Use TLS for all requests** — never HTTP in production
- [ ] **Monitor violation patterns** — repeated violations may indicate bugs

---

## Incident Response

### Suspected Key Compromise

1. **Immediately** notify EP operator
2. **Revoke** compromised key
3. **Audit** logs for unauthorized validations
4. **Rotate** to new key
5. **Review** agent code for credential leakage

### Proof Hash Discrepancy

If re-running validation produces different hash:

1. **Capture** exact request/response
2. **Verify** timestamp handling (should differ, that's expected)
3. **Check** policy version (hash changes if policy changes)
4. **Report** to EP operator if unexplained

---

## Compliance Notes

EP supports compliance frameworks requiring:

- **Audit trails** — Every validation logged with hash
- **Policy enforcement** — Immutable constraint rules
- **Deterministic proof** — Reproducible verification
- **Access controls** — Per-agent key authentication

Not a substitute for legal/compliance review. Consult counsel for regulatory requirements.

---

## Security Contacts

- **Vulnerability Reports:** Contact EP operator
- **Security Questions:** See integration guides
- **Incident Reports:** Include proof hashes and timestamps

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-28 | Initial release |
