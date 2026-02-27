/**
 * External Verifier SDK — Execution Protocol v2
 *
 * Pure function transcript validation for external verification.
 * No network calls. No external dependencies.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
/**
 * Transcript entry interface (subset for validation)
 */
export interface VerifierTranscriptEntry {
    entry_hash: string;
    previous_hash: string | null;
    session_id: string;
    entry_type: string;
    content: Record<string, unknown>;
    agent_id: string;
    model?: string;
}
/**
 * Transcript session interface
 */
export interface VerifierTranscriptSession {
    session_id: string;
    entries: VerifierTranscriptEntry[];
}
/**
 * Verification result
 */
export interface VerificationResult {
    valid: boolean;
    errors: string[];
    entry_count: number;
    chain_integrity: boolean;
    hash_validity: boolean;
}
/**
 * Validate entire transcript for integrity and correctness
 * Pure function — no side effects
 */
export declare function validateTranscript(session: VerifierTranscriptSession): VerificationResult;
/**
 * Verify hash chain linking (previous_hash → entry_hash)
 * Pure function — no side effects
 */
export declare function verifyHashChain(session: VerifierTranscriptSession, errorCollector?: string[]): boolean;
/**
 * Verify individual entry hashes match recomputed values
 * Pure function — no side effects
 */
export declare function verifyEntryHashes(session: VerifierTranscriptSession, errorCollector?: string[]): boolean;
/**
 * Compute entry hash (deterministic)
 * Matches kernel implementation exactly
 * Pure function — no side effects
 */
export declare function computeEntryHash(entry: VerifierTranscriptEntry): string;
/**
 * Get final transcript head hash
 * Pure function — no side effects
 */
export declare function getTranscriptHead(session: VerifierTranscriptSession): string | null;
/**
 * Verify transcript matches expected head hash
 * Pure function — no side effects
 */
export declare function verifyTranscriptHead(session: VerifierTranscriptSession, expectedHeadHash: string): boolean;
//# sourceMappingURL=VerifierSDK.d.ts.map