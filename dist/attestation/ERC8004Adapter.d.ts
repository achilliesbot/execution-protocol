/**
 * ERC-8004 Attestation Adapter — Execution Protocol v2
 *
 * Interface and stub for ERC-8004 transcript attestation.
 * No on-chain calls. Interface only.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
import { VerifierTranscriptSession } from '../integrations';
/**
 * ERC-8004 Attestation request
 */
export interface AttestationRequest {
    transcript_hash: string;
    session_id: string;
    chain_id: number;
    timestamp: string;
}
/**
 * ERC-8004 Attestation response (off-chain stub)
 */
export interface AttestationResponse {
    attestation_id: string;
    transcript_hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    proof_data: AttestationProof | null;
    created_at: string;
}
/**
 * Attestation proof structure (ERC-8004 compatible)
 */
export interface AttestationProof {
    format: 'erc8004-v1';
    transcript_hash: string;
    merkle_root: string | null;
    signatures: AttestationSignature[];
    metadata: Record<string, unknown>;
}
/**
 * Attestation signature
 */
export interface AttestationSignature {
    signer_type: 'validator' | 'sequencer' | 'oracle';
    public_key: string;
    signature: string;
    timestamp: string;
}
/**
 * Attestation status
 */
export type AttestationStatus = 'pending' | 'confirmed' | 'failed' | 'expired';
/**
 * Create attestation request from transcript
 * Pure function — no side effects, no network calls
 */
export declare function createAttestationRequest(session: VerifierTranscriptSession, chainId?: number): AttestationRequest;
/**
 * Compute transcript hash for attestation
 * Pure function — deterministic
 */
export declare function computeTranscriptHash(session: VerifierTranscriptSession): string;
/**
 * Generate attestation (STUB — no on-chain calls)
 * Returns off-chain attestation with pending status
 * Pure function — no side effects
 */
export declare function generateAttestation(request: AttestationRequest): AttestationResponse;
/**
 * Generate mock attestation proof (for testing)
 * Pure function — no side effects
 */
export declare function generateMockProof(request: AttestationRequest): AttestationProof;
/**
 * Check attestation status (STUB)
 * Pure function — returns cached status
 */
export declare function checkAttestationStatus(attestationId: string): AttestationStatus;
/**
 * Verify attestation proof format (off-chain validation)
 * Pure function — no side effects
 */
export declare function verifyAttestationFormat(proof: AttestationProof): boolean;
//# sourceMappingURL=ERC8004Adapter.d.ts.map