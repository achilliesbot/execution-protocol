/**
 * Transcript Module — Execution Protocol v2
 *
 * Immutable, hash-chained execution audit trail
 * GOVERNANCE.md §4: Transcript integrity is core
 */
export { TranscriptEntry, EntryType, TranscriptSession, ProposalContent, ValidationContent, PlanContent, ExecutionContent, RejectionContent, TranscriptLogger } from './TranscriptLogger.js';
// Transcript querying and replay utilities will be added here
