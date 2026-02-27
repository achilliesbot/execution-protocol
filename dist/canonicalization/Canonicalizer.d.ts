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
export declare function canonicalize(obj: unknown): string;
/**
 * Computes SHA-256 hash of canonicalized object
 * Returns hex-encoded hash string
 */
export declare function computeHash(obj: unknown): string;
/**
 * Validates that an object produces stable hashes
 * Throws if object structure is non-deterministic
 */
export declare function validateDeterminism(obj: unknown): void;
/**
 * Proposal hash computation for OpportunityProposal.v1
 * Includes schema version in hash computation for future-proofing
 *
 * GOVERNANCE.md §2.1: Hash must be deterministic
 * NO timestamps in hash input
 */
export declare function computeProposalHash(proposal: Record<string, unknown> | unknown, schemaVersion?: string): string;
/**
 * Policy set hash computation
 * Used to bind executions to specific policy versions
 */
export declare function computePolicyHash(policySet: Record<string, unknown>): string;
/**
 * Transcript entry hash computation
 * Creates hash-chained transcripts
 *
 * GOVERNANCE.md §4: Transcript entries are immutable
 * Hash must be deterministic - NO timestamps in input
 */
export declare function computeTranscriptHash(entry: Record<string, unknown>, previousHash: string | null): string;
//# sourceMappingURL=Canonicalizer.d.ts.map