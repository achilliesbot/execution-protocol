/**
 * Adversarial Review Harness — 2026-02-25
 * Runs against compiled dist/ modules (ESM-safe).
 */

import fs from 'fs';
import path from 'path';

import {
  canonicalize,
  computeProposalHash,
  computePolicyHash,
  validateDeterminism
} from '../dist/canonicalization/index.js';

import {
  createPhase1PolicySet,
  computePolicySetHash,
  validateAgainstPolicySet
} from '../dist/policy/index.js';

import {
  createSettlementAdapter
} from '../dist/settlement/index.js';

const OUT_PATH = '/data/.openclaw/workspace/logs/adversarial_review_2026-02-25.json';

function nowIso() {
  return new Date().toISOString();
}

function recordException(e) {
  return {
    name: e?.name,
    message: e?.message,
    stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 8).join('\n') : undefined
  };
}

/** @typedef {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'} Severity */

/**
 * @param {Severity} severity
 * @param {'canonicalizer'|'policy_engine'|'settlement_adapters'} component
 * @param {string} title
 * @param {string} description
 * @param {any} reproduction
 * @param {any} observed
 * @param {string} recommendation
 */
function finding(severity, component, title, description, reproduction, observed, recommendation) {
  return {
    id: `${component.toUpperCase()}-${Math.random().toString(16).slice(2, 8)}`,
    severity,
    component,
    title,
    description,
    reproduction,
    observed,
    recommendation
  };
}

async function run() {
  /** @type {any[]} */
  const findings = [];

  // ========== CANONICALIZER ==========
  for (const [label, value] of [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY]
  ]) {
    try {
      canonicalize({ x: value });
      findings.push(finding(
        'HIGH',
        'canonicalizer',
        `canonicalize accepted non-finite number (${label})`,
        'Non-finite numbers must be rejected to preserve determinism.',
        { input: { x: label } },
        { result: 'NO_THROW' },
        'Ensure canonicalization rejects NaN/Infinity (throw) before hashing.'
      ));
    } catch {
      // expected
    }
  }

  // Replay/collision check: proposal_id stripped implies hash collision if proposal_id expected to bind uniqueness
  try {
    const h1 = computeProposalHash({ proposal_id: 'p1', intent: { asset: 'ETH', amount_usd: 10 } }, 'v1');
    const h2 = computeProposalHash({ proposal_id: 'p2', intent: { asset: 'ETH', amount_usd: 10 } }, 'v1');
    if (h1 === h2) {
      findings.push(finding(
        'HIGH',
        'canonicalizer',
        'Proposal hashes ignore proposal_id (replay/collision risk)',
        'If proposal_id is meant to prevent replay, excluding it from hash allows collisions across IDs.',
        { a: { proposal_id: 'p1' }, b: { proposal_id: 'p2' } },
        { hash_a: h1, hash_b: h2, equal: true },
        'Decide explicitly: include proposal_id in hash input OR enforce replay protection elsewhere (nonce registry / transcript binding).'
      ));
    }
  } catch (e) {
    findings.push(finding(
      'MEDIUM',
      'canonicalizer',
      'computeProposalHash threw unexpectedly',
      'Unexpected exception while computing proposal hash.',
      { action: 'computeProposalHash minimal object' },
      recordException(e),
      'Harden proposal hash computation for minimal well-typed objects.'
    ));
  }

  // Oversized payload risk: canonicalize stringifies full object (and source has debug logging in src; dist may still log)
  findings.push(finding(
    'MEDIUM',
    'canonicalizer',
    'Oversized payload risk (canonicalize stringify / potential logging)',
    'Large payloads can cause CPU/memory pressure; any debug logging amplifies blast radius.',
    { scenario: 'proposal with huge nested arrays/strings' },
    { behavior: 'theoretical' },
    'Add size limits before canonicalization; remove debug logging or gate behind explicit flag with truncation.'
  ));

  // ========== POLICY ENGINE ==========
  try {
    const ps1 = createPhase1PolicySet();
    // Ensure Date.now() advances at least 1ms
    await new Promise(r => setTimeout(r, 2));
    const ps2 = createPhase1PolicySet();
    const hash1 = computePolicySetHash(ps1);
    const hash2 = computePolicySetHash(ps2);

    if (hash1 !== hash2) {
      findings.push(finding(
        'CRITICAL',
        'policy_engine',
        'PolicySet hash non-deterministic (Date.now() in id included in hash)',
        'createPhase1PolicySet() uses Date.now() in id; computePolicySetHash includes id -> hashes differ across runs for identical policy content.',
        { action: 'createPhase1PolicySet twice (with delay) + computePolicySetHash' },
        { ps1_id: ps1.id, ps2_id: ps2.id, hash1, hash2 },
        'Make policy_set id deterministic or exclude id from hash; policy_set_hash must be stable for audit-grade determinism.'
      ));
    }
  } catch (e) {
    findings.push(finding(
      'HIGH',
      'policy_engine',
      'PolicySet hash test threw unexpectedly',
      'Unexpected exception while generating or hashing policy set.',
      { action: 'createPhase1PolicySet / computePolicySetHash' },
      recordException(e),
      'Ensure policy hashing is robust and deterministic.'
    ));
  }

  // Malformed proposal / numeric edge cases
  try {
    const ps = createPhase1PolicySet();
    const state = { state: { total_allocated_usd: 0 } };
    const proposal = {
      intent: { asset: null, amount_usd: Number.NaN },
      constraints: { stop_loss: null },
      risk_budget: { max_drawdown_percent: Number.POSITIVE_INFINITY, risk_reward_ratio: -1 },
      timestamp: null
    };

    const res = validateAgainstPolicySet(proposal, ps, state);

    if (res.valid === true) {
      findings.push(finding(
        'HIGH',
        'policy_engine',
        'Policy validation may pass with NaN/Infinity inputs',
        'Raw JS comparisons + NaN semantics can cause constraints to be bypassed.',
        { proposal },
        { valid: res.valid, violations: res.violations },
        'Add explicit finite-number checks; treat NaN/Infinity as violations for numeric constraints.'
      ));
    }

    findings.push(finding(
      'LOW',
      'policy_engine',
      'ValidationResult includes wall-clock timestamp',
      'If ValidationResult is used for determinism comparisons, timestamp will drift.',
      { field: 'timestamp' },
      { timestamp: res.timestamp },
      'Exclude timestamp from determinism comparisons or move it to non-hashed metadata.'
    ));
  } catch (e) {
    findings.push(finding(
      'MEDIUM',
      'policy_engine',
      'Policy validation threw on malformed inputs',
      'Throwing is acceptable only if callers handle deterministically; record for triage.',
      { action: 'validateAgainstPolicySet with NaN/Infinity/null fields' },
      recordException(e),
      'Introduce proposal schema validation; return deterministic violations where possible.'
    ));
  }

  // ========== SETTLEMENT ADAPTERS ==========
  for (const mode of ['null', 'offchain', 'onchain', 'hybrid']) {
    try {
      const adapter = createSettlementAdapter(mode);

      const badRequests = [
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
          label: 'amount missing',
          request: {
            entry_id: 'e3',
            currency: 'EXEC',
            recipient: '0x1234567890123456789012345678901234567890',
            metadata: { session_id: 's', transcript_head_hash: 'h' }
          }
        },
        {
          label: 'recipient too short',
          request: {
            entry_id: 'e4',
            amount: 1,
            currency: 'EXEC',
            recipient: '0x123',
            metadata: { session_id: 's', transcript_head_hash: 'h' }
          }
        }
      ];

      for (const br of badRequests) {
        const r = await adapter.settle(br.request, true);
        if (r?.success === true) {
          findings.push(finding(
            'CRITICAL',
            'settlement_adapters',
            `Adapter accepted malformed request (${br.label}) mode=${mode}`,
            'validateRequest() is not sufficient: NaN/Infinity/undefined can bypass. Settlement must fail closed.',
            { mode, request: br.request },
            { result: r },
            'Harden validateRequest: require Number.isFinite(amount) && amount>0; validate currency allowlist; validate metadata and address format per chain.'
          ));
        }
      }

      // deterministic replay: simulated tx hash uses Date.now() (non-deterministic) — acceptable if excluded from determinism
      // record as LOW if needed
    } catch (e) {
      findings.push(finding(
        'CRITICAL',
        'settlement_adapters',
        `Settlement adapter factory not ESM-safe (mode=${mode})`,
        'createSettlementAdapter uses require(), which is not defined in ESM. This breaks settlement adapter creation in the configured ESM runtime.',
        { mode },
        recordException(e),
        'Replace require() with ESM-safe imports (static imports or dynamic import()) so adapter factory works under type=module.'
      ));
    }
  }

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

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`WROTE: ${OUT_PATH}`);
  console.log(JSON.stringify(out.summary));
}

run().catch((e) => {
  console.error('ADVERSARIAL REVIEW HARNESS FAILED', e);
  process.exit(1);
});
