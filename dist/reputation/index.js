/**
 * Reputation Engine — Execution Protocol v2
 *
 * Off-chain reputation scoring based on transcript history.
 * Scores agents based on execution quality, not capital outcomes.
 *
 * READ-ONLY: Consumes transcript outputs from kernel.
 * Does NOT modify canonicalization, transcript, or hash logic.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
export { extractSessionOutcome, calculateBaseReputation, calculateExecutionQuality, calculateConsistency, calculateVolume, calculatePolicyCompliance, calculateRecency, computeReputation, compareReputation } from './ReputationEngine.js';
//# sourceMappingURL=index.js.map