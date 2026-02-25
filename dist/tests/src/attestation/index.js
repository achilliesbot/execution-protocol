/**
 * Attestation Layer — Execution Protocol v2
 *
 * ERC-8004 transcript attestation integration.
 * Provides cryptographic proof of execution for external verification.
 *
 * READ-ONLY: Consumes transcript outputs from kernel.
 * Does NOT modify canonicalization, transcript, or hash logic.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
export { createAttestationRequest, computeTranscriptHash, generateAttestation, generateMockProof, checkAttestationStatus, verifyAttestationFormat, AttestationRequest, AttestationResponse, AttestationProof, AttestationSignature, AttestationStatus } from './ERC8004Adapter.js';
export { submitAttestationOnChain, pollAttestationStatus, verifyAttestationOnChain, getRpcEndpoint, getAttestationContract, isClientReady, OnChainAttestationRequest, OnChainAttestationResponse } from './OnChainClient.js';
