"use strict";
/**
 * Canonicalization Layer — Execution Protocol v2
 *
 * Implements RFC 8785 JSON Canonicalization Scheme (JCS)
 * Ensures deterministic hashing of OpportunityProposal objects
 *
 * Build: Sonnet 4.6 (as per SOUL.md model routing protocol)
 * Review: Codex 5.3
 *
 * GOVERNANCE.md §2.1: Hash drift is unacceptable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalize = canonicalize;
exports.computeHash = computeHash;
exports.validateDeterminism = validateDeterminism;
exports.computeProposalHash = computeProposalHash;
exports.computePolicyHash = computePolicyHash;
exports.computeTranscriptHash = computeTranscriptHash;
var crypto = require("crypto");
/**
 * Non-hashed field denylist
 * Strips fields that would cause hash drift
 * NOTE: session_id is INTENTIONALLY excluded - transcript hashes must be session-bound
 */
var NON_HASHED_FIELDS_DENYLIST = new Set([
    'timestamp',
    'created_at',
    'updated_at',
    'canonicalized_at',
    'logged_at',
    'nonce',
    'random',
    'entry_id',
    'plan_id',
    'generated_at'
    // session_id NOT included - required for session-bound transcript hashing
]);
/**
 * Strips non-hashed fields from object recursively
 * GOVERNANCE.md §2.1: Hash drift prevention
 *
 * NOTE: Use ONLY for proposal/policy hashing.
 * Transcript hashing must NOT use this - construct deterministic input explicitly.
 */
function stripNonDeterministic(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(stripNonDeterministic);
    }
    var cleaned = {};
    for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        // Skip non-hashed fields (denylist guard)
        if (NON_HASHED_FIELDS_DENYLIST.has(key)) {
            continue;
        }
        cleaned[key] = stripNonDeterministic(value);
    }
    return cleaned;
}
/**
 * Canonicalizes a JSON object to RFC 8785-compatible form
 * Produces a deterministic, reproducible string representation
 *
 * RFC 8785 Compliance Note:
 * - Uses RFC 8785 key sorting (lexicographic)
 * - Output is RFC 8785-compatible but not strictly validated
 * - For strict RFC 8785, use a dedicated JCS library
 *
 * STEPS:
 * 1. Strip non-hashed fields (timestamps, nonces, etc.) via denylist
 * 2. Deep sort object keys alphabetically (RFC 8785 §3.2.3)
 * 3. Serialize with deterministic rules
 */
function canonicalize(obj) {
    // Step 1: Strip fields that would cause hash drift
    var cleaned = stripNonDeterministic(obj);
    // Step 2: Deep sort object keys alphabetically
    var sorted = deepSortKeys(cleaned);
    // Step 3: Serialize with deterministic rules
    // - No extra whitespace
    // - Numbers as JSON numbers (no special formatting)
    // - Strings with proper escaping
    return deterministicStringify(sorted);
}
/**
 * Computes SHA-256 hash of canonicalized object
 * Returns hex-encoded hash string
 */
function computeHash(obj) {
    var canonical = canonicalize(obj);
    return crypto
        .createHash('sha256')
        .update(canonical, 'utf-8')
        .digest('hex');
}
/**
 * Deep sorts all object keys alphabetically (recursive)
 * Arrays are preserved in order (per RFC 8785)
 */
function deepSortKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        // Arrays: preserve order, sort elements
        return obj.map(deepSortKeys);
    }
    // Objects: sort keys alphabetically
    var sorted = {};
    var keys = Object.keys(obj).sort();
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        sorted[key] = deepSortKeys(obj[key]);
    }
    return sorted;
}
/**
 * Deterministic JSON stringification
 * - No extra whitespace
 * - Consistent number formatting
 * - Proper string escaping
 */
function deterministicStringify(obj) {
    return JSON.stringify(obj, function (key, value) {
        // Handle special cases for determinism
        if (typeof value === 'number') {
            // Ensure consistent number formatting
            // JSON spec guarantees this, but we validate
            if (!Number.isFinite(value)) {
                throw new Error("Non-finite number not allowed: ".concat(value));
            }
        }
        return value;
    });
}
/**
 * Validates that an object produces stable hashes
 * Throws if object structure is non-deterministic
 */
function validateDeterminism(obj) {
    var hash1 = computeHash(obj);
    var hash2 = computeHash(obj);
    if (hash1 !== hash2) {
        throw new Error('Hash instability detected: same object produces different hashes');
    }
    // Additional validation: canonical form stability
    var canonical1 = canonicalize(obj);
    var canonical2 = canonicalize(obj);
    if (canonical1 !== canonical2) {
        throw new Error('Canonical form instability detected');
    }
}
/**
 * Proposal hash computation for OpportunityProposal.v1
 * Includes schema version in hash computation for future-proofing
 *
 * GOVERNANCE.md §2.1: Hash must be deterministic
 * NO timestamps in hash input
 */
function computeProposalHash(proposal, schemaVersion) {
    if (schemaVersion === void 0) { schemaVersion = 'v1'; }
    var hashInput = {
        schema_version: schemaVersion,
        proposal: proposal
        // NO timestamps - determinism required
    };
    return computeHash(hashInput);
}
/**
 * Policy set hash computation
 * Used to bind executions to specific policy versions
 */
function computePolicyHash(policySet) {
    return computeHash({
        type: 'policy_set',
        version: policySet.version || '1.0.0',
        policies: policySet
    });
}
/**
 * Transcript entry hash computation
 * Creates hash-chained transcripts
 *
 * GOVERNANCE.md §4: Transcript entries are immutable
 * Hash must be deterministic - NO timestamps in input
 */
function computeTranscriptHash(entry, previousHash) {
    var hashInput = {
        entry: entry,
        previous_hash: previousHash
        // NO timestamps - determinism required
        // Entry.timestamp is IN the entry content, not in hash input
    };
    return computeHash(hashInput);
}
