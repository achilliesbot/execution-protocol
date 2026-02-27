/**
 * Canonicalization Module — Execution Protocol v2
 *
 * Core determinism layer. All proposal hashing goes through here.
 * GOVERNANCE.md §2.1: Canonicalization anchors the stack
 */
export { canonicalize, computeHash, validateDeterminism, computeProposalHash, computePolicyHash, computeTranscriptHash } from './Canonicalizer.js';
// Schema validation will be imported from ../schema once built
// Policy binding will be imported from ../policy once built
//# sourceMappingURL=index.js.map