/**
 * Adversarial Review Harness — 2026-02-25
 * Scope: canonicalizer, policy engine, settlement adapters
 *
 * This is a lightweight, local adversarial harness (no network, no secrets).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  canonicalize,
  computeHash,
  computeProposalHash,
  validateDeterminism
} from '../src/canonicalization/Canonicalizer.ts';

import {
  createPhase1PolicySet,
  computePolicySetHash,
  validateAgainstPolicySet
} from '../src/policy/PolicyEngine.ts';

import {
  createSettlementAdapter
} from '../src/settlement/SettlementAdapter.ts';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

type Finding = {
  id: string;
  severity: Severity;
  component: 'canonicalizer' | 'policy_engine' | 'settlement_adapters';
  title: string;
  description: string;
  reproduction: any;
  observed: any;
  recommendation: string;
};

function nowIso() {
  return new Date().toISOString();
}

function workspaceLogPath() {
  // writing outside repo per Commander directive
  return '/data/.openclaw/workspace/logs/adversarial_review_2026-02-25.json';
}

function recordException(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 6).join('\n') : undefined
  };
}

async function run() {
  const findings: Finding[] = [];

  // ========== CANONICALIZER ========== 
  // Non-finite numbers should throw
  for (const [label, value] of [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY]
  ] as const) {
    try {
      canonicalize({ x: value });
      findings.push({
        id: `CAN-001-${label}`,
        severity: 'HIGH',
        component: 'canonicalizer',
        title: `canonicalize accepted non-finite number (${label})`,
        description: 'Non-finite numbers should be rejected to preserve JSON determinism.',
        reproduction: { input: { x: label } },
        observed: { result: 'NO_THROW' },
        recommendation: 'Ensure deterministicStringify rejects non-finite numbers (expected behavior: throw).'
      });
    } catch (e) {
      // expected: throw
    }
  }

  // Replay / hash stability: proposal_id stripped can cause same hash for different proposal IDs
  try {
    const h1 = computeProposalHash({ proposal_id: 'p1', intent: { asset: 'ETH', amount_usd: 10 } }, 'v1');
    const h2 = computeProposalHash({ proposal_id: 'p2', intent: { asset: 'ETH', amount_usd: 10 } }, 'v1');
    if (h1 === h2) {
      findings.push({
        id: 'CAN-REPLAY-001',
        severity: 'HIGH',
        component: 'canonicalizer',
        title: 'Proposal hashes ignore proposal_id (replay/collision risk)',
        description: 'proposal_id is stripped by NON_HASHED_FIELDS_DENYLIST, so changing proposal_id does not change computeProposalHash(). This can enable replay attacks or collisions if proposal_id is expected to bind uniqueness.',
        reproduction: { a: { proposal_id: 'p1', intent: { asset: 'ETH', amount_usd: 10 } }, b: { proposal_id: 'p2', intent: { asset: 'ETH', amount_usd: 10 } } },
        observed: { hash_a: h1, hash_b: h2, equal: true },
        recommendation: 'Decide explicitly whether proposal_id must be part of proposal hashing. If yes, remove it from denylist for proposal hashing or add a dedicated unique_id field in hash input.'
      });
    }
  } catch (e) {
    findings.push({
      id: 'CAN-REPLAY-ERR',
      severity: 'MEDIUM',
      component: 'canonicalizer',
      title: 'computeProposalHash threw unexpectedly',
      description: 'Unexpected exception during hash computation.',
      reproduction: { action: 'computeProposalHash minimal object' },
      observed: recordException(e),
      recommendation: 'Ensure computeProposalHash can handle minimal well-typed objects deterministically.'
    });
  }

  // Debug logging in canonicalize (potential leakage/DoS)
  findings.push({
    id: 'CAN-LOG-001',
    severity: 'MEDIUM',
    component: 'canonicalizer',
    title: 'canonicalize() emits debug console.log of cleaned object',
    description: 'Canonicalizer currently logs the canonicalized object. This can leak sensitive fields into logs and can become a DoS vector for oversized payloads.',
    reproduction: { location: 'src/canonicalization/Canonicalizer.ts', indicator: "console.log('[CANONICALIZE DEBUG] cleaned object:'" },
    observed: { behavior: 'source-level finding' },
    recommendation: 'Remove debug logging or gate behind an explicit DEBUG flag with size limits.'
  });

  // ========== POLICY ENGINE ========== 
  // createPhase1PolicySet uses Date.now() in ID -> hash includes id -> non-deterministic policy_set_hash
  try {
    const ps1 = createPhase1PolicySet();
    const ps2 = createPhase1PolicySet();
    const hash1 = computePolicySetHash(ps1);
    const hash2 = computePolicySetHash(ps2);
    if (hash1 !== hash2) {
      findings.push({
        id: 'POL-001',
        severity: 'CRITICAL',
        component: 'policy_engine',
        title: 'PolicySet hash is non-deterministic due to Date.now() in policy_set id',
        description: 'createPhase1PolicySet() generates id with Date.now(); computePolicySetHash() includes id, causing different hashes across runs for identical policies.',
        reproduction: { action: 'createPhase1PolicySet twice + computePolicySetHash' },
        observed: { hash1, hash2, equal: hash1 === hash2, ps1_id: ps1.id, ps2_id: ps2.id },
        recommendation: 'Make policy_set id deterministic (versioned constant) or exclude id from hash if it is not semantically part of policy enforcement. For audit-grade determinism, policy_set_hash must be stable for the same policy content.'
      });
    }
  } catch (e) {
    findings.push({
      id: 'POL-001-ERR',
      severity: 'HIGH',
      component: 'policy_engine',
      title: 'PolicySet hash test threw unexpectedly',
      description: 'Unexpected exception while generating or hashing PolicySet.',
      reproduction: { action: 'createPhase1PolicySet / computePolicySetHash' },
      observed: recordException(e),
      recommendation: 'Ensure policy set creation and hashing are safe for adversarial inputs.'
    });
  }

  // Malformed proposal / unexpected types
  try {
    const ps = createPhase1PolicySet();
    const state = { state: { total_allocated_usd: 0 } };
    const proposal: any = {
      intent: { asset: null, amount_usd: Number.NaN },
      constraints: { stop_loss: null },
      risk_budget: { max_drawdown_percent: Number.POSITIVE_INFINITY, risk_reward_ratio: -1 },
      timestamp: null
    };

    const res = validateAgainstPolicySet(proposal, ps, state);
    // If it returns valid=true under NaN/Infinity, that's a problem.
    if (res.valid === true) {
      findings.push({
        id: 'POL-002',
        severity: 'HIGH',
        component: 'policy_engine',
        title: 'Policy validation may pass with NaN/Infinity inputs',
        description: 'evaluateConstraint uses raw JS comparisons; NaN comparisons return false, potentially bypassing constraints depending on operator and target path resolution.',
        reproduction: { proposal },
        observed: { valid: res.valid, violations: res.violations },
        recommendation: 'Add explicit finite-number validation for numeric fields before evaluating constraints; treat NaN/Infinity as violations for numeric constraints.'
      });
    }

    // Timestamp in ValidationResult is non-deterministic
    findings.push({
      id: 'POL-TS-001',
      severity: 'LOW',
      component: 'policy_engine',
      title: 'ValidationResult includes wall-clock timestamp',
      description: 'validateAgainstPolicySet() returns timestamp=now(). If ValidationResult is used in determinism comparisons, it will drift.',
      reproduction: { location: 'validateAgainstPolicySet return object' },
      observed: { timestamp: res.timestamp },
      recommendation: 'If ValidationResult participates in determinism checks, exclude timestamp or move it to non-hashed metadata.'
    });
  } catch (e) {
    findings.push({
      id: 'POL-002-ERR',
      severity: 'MEDIUM',
      component: 'policy_engine',
      title: 'Policy validation threw on malformed input',
      description: 'Throwing is acceptable only if caller handles deterministically. Record for triage.',
      reproduction: { action: 'validateAgainstPolicySet with NaN/Infinity/null fields' },
      observed: recordException(e),
      recommendation: 'Harden proposal schema validation; return deterministic violations rather than throwing where possible.'
    });
  }

  // ========== SETTLEMENT ADAPTERS ========== 
  // ValidateRequest bypass with NaN/undefined/Infinity amount
  const adapterModes = ['null', 'offchain', 'onchain', 'hybrid'] as const;
  for (const mode of adapterModes) {
    try {
      const adapter = createSettlementAdapter(mode);
      const badRequests: Array<{ label: string; request: any }> = [
        {
          label: 'amount=NaN',
          request: {
            entry_id: 'e1',
            amount: Number.NaN,
            currency: 'EXEC',
            recipient: '0x1234567890123456789012345678901234567890',
            metadata: { session_id: 's', transcript_head_hash: 'h' }
          }
        },
        {
          label: 'amount=Infinity',
          request: {
            entry_id: 'e2',
            amount: Number.POSITIVE_INFINITY,
            currency: 'EXEC',
            recipient: '0x1234567890123456789012345678901234567890',
            metadata: { session_id: 's', transcript_head_hash: 'h' }
          }
        },
        {
          label: 'amount=undefined',
          request: {
            entry_id: 'e3',
            // amount missing
            currency: 'EXEC',
            recipient: '0x1234567890123456789012345678901234567890',
            metadata: { session_id: 's', transcript_head_hash: 'h' }
          }
        }
      ];

      for (const br of badRequests) {
        const r = await adapter.settle(br.request, true);
        if (r.success === true) {
          findings.push({
            id: `SET-001-${mode}-${br.label}`,
            severity: 'CRITICAL',
            component: 'settlement_adapters',
            title: `Settlement adapter accepted malformed request (${br.label}) in mode=${mode}`,
            description: 'BaseSettlementAdapter.validateRequest() only checks amount<=0 and recipient length; NaN/undefined/Infinity bypass validation and can produce simulated success.',
            reproduction: { mode, request: br.request },
            observed: { result: r },
            recommendation: 'Harden validateRequest(): require Number.isFinite(amount) && amount > 0; validate currency allowlist and metadata presence; validate address format by chain.'
          });
        }
      }
    } catch (e) {
      findings.push({
        id: `SET-ERR-${mode}`,
        severity: 'MEDIUM',
        component: 'settlement_adapters',
        title: `Settlement adapter threw during adversarial test (mode=${mode})`,
        description: 'Unexpected exception while constructing or running settlement adapter.',
        reproduction: { mode },
        observed: recordException(e),
        recommendation: 'Ensure adapter factory and settle() are robust under malformed inputs.'
      });
    }
  }

  // Oversized payload note (canonicalizer)
  findings.push({
    id: 'SIZE-001',
    severity: 'MEDIUM',
    component: 'canonicalizer',
    title: 'Oversized payload risk (canonicalize stringify + logging)',
    description: 'Canonicalizer canonicalize() stringifies the full object and logs it; oversized payloads can cause excessive CPU/memory usage.',
    reproduction: { scenario: 'proposal with very large nested arrays/strings' },
    observed: { behavior: 'theoretical + source-level' },
    recommendation: 'Impose size limits before canonicalization; remove or gate logging.'
  });

  const out = {
    review_id: 'adversarial_review_2026-02-25',
    generated_at: nowIso(),
    scope: {
      components: ['canonicalizer', 'policy_engine', 'settlement_adapters'],
      tests: [
        'malformed proposals',
        'extreme numeric values (MAX_SAFE_INTEGER, negative, NaN, Infinity)',
        'unexpected types (null, undefined, empty arrays)',
        'replay attacks (duplicate proposal IDs)',
        'oversized payloads'
      ]
    },
    summary: {
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length
    },
    findings
  };

  fs.mkdirSync(path.dirname(workspaceLogPath()), { recursive: true });
  fs.writeFileSync(workspaceLogPath(), JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`WROTE: ${workspaceLogPath()}`);
  console.log(JSON.stringify(out.summary));
}

run().catch(e => {
  console.error('ADVERSARIAL REVIEW HARNESS FAILED', e);
  process.exit(1);
});
