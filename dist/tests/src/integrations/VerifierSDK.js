/**
 * External Verifier SDK — Execution Protocol v2
 *
 * Pure function transcript validation for external verification.
 * No network calls. No external dependencies.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
import { computeHash } from '../canonicalization/index.js';
/**
 * Validate entire transcript for integrity and correctness
 * Pure function — no side effects
 */
export function validateTranscript(session) {
    const errors = [];
    // Check for empty transcript
    if (!session.entries || session.entries.length === 0) {
        return {
            valid: false,
            errors: ['Empty transcript: no entries'],
            entry_count: 0,
            chain_integrity: false,
            hash_validity: false
        };
    }
    // Verify hash chain integrity
    const chainValid = verifyHashChain(session, errors);
    // Verify individual entry hashes
    const hashesValid = verifyEntryHashes(session, errors);
    return {
        valid: chainValid && hashesValid && errors.length === 0,
        errors,
        entry_count: session.entries.length,
        chain_integrity: chainValid,
        hash_validity: hashesValid
    };
}
/**
 * Verify hash chain linking (previous_hash → entry_hash)
 * Pure function — no side effects
 */
export function verifyHashChain(session, errorCollector) {
    const errors = errorCollector || [];
    for (let i = 0; i < session.entries.length; i++) {
        const entry = session.entries[i];
        // First entry: previous_hash must be null
        if (i === 0) {
            if (entry.previous_hash !== null) {
                errors.push(`Entry ${i}: First entry must have previous_hash=null`);
                return false;
            }
            continue;
        }
        // Subsequent entries: previous_hash must match previous entry_hash
        const previousEntry = session.entries[i - 1];
        if (entry.previous_hash !== previousEntry.entry_hash) {
            errors.push(`Entry ${i}: Chain break. ` +
                `Expected previous_hash=${previousEntry.entry_hash.substring(0, 16)}..., ` +
                `got ${entry.previous_hash?.substring(0, 16) || 'null'}...`);
            return false;
        }
    }
    return true;
}
/**
 * Verify individual entry hashes match recomputed values
 * Pure function — no side effects
 */
export function verifyEntryHashes(session, errorCollector) {
    const errors = errorCollector || [];
    let allValid = true;
    for (let i = 0; i < session.entries.length; i++) {
        const entry = session.entries[i];
        const recomputedHash = computeEntryHash(entry);
        if (entry.entry_hash !== recomputedHash) {
            errors.push(`Entry ${i}: Hash mismatch. ` +
                `Stored=${entry.entry_hash.substring(0, 16)}..., ` +
                `Computed=${recomputedHash.substring(0, 16)}...`);
            allValid = false;
        }
    }
    return allValid;
}
/**
 * Compute entry hash (deterministic)
 * Matches kernel implementation exactly
 * Pure function — no side effects
 */
export function computeEntryHash(entry) {
    // Must match TranscriptLogger.computeEntryHash exactly
    const hashInput = {
        session_id: entry.session_id,
        previous_hash: entry.previous_hash,
        entry_type: entry.entry_type,
        content: entry.content,
        agent_id: entry.agent_id,
        model: entry.model
        // EXCLUDED: entry_id, timestamp (runtime values)
    };
    return computeHash(hashInput);
}
/**
 * Get final transcript head hash
 * Pure function — no side effects
 */
export function getTranscriptHead(session) {
    if (!session.entries || session.entries.length === 0) {
        return null;
    }
    return session.entries[session.entries.length - 1].entry_hash;
}
/**
 * Verify transcript matches expected head hash
 * Pure function — no side effects
 */
export function verifyTranscriptHead(session, expectedHeadHash) {
    const actualHead = getTranscriptHead(session);
    return actualHead === expectedHeadHash;
}
