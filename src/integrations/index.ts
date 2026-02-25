/**
 * Integrations — Execution Protocol v2
 * 
 * External verifier SDK and third-party integration adapters.
 * Allows external systems to validate transcripts without kernel access.
 * 
 * READ-ONLY: Consumes transcript outputs from kernel.
 * Does NOT modify canonicalization, transcript, or hash logic.
 * 
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */

export {
  validateTranscript,
  verifyHashChain,
  verifyEntryHashes,
  computeEntryHash,
  getTranscriptHead,
  verifyTranscriptHead,
  VerifierTranscriptEntry,
  VerifierTranscriptSession,
  VerificationResult
} from './VerifierSDK';
