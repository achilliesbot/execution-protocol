/**
 * Reputation Engine — Execution Protocol v2
 *
 * Pure function reputation scoring over transcript history.
 * Off-chain only. No external dependencies.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
import { VerifierTranscriptSession } from '../integrations';
/**
 * Reputation score (0-100)
 */
export interface ReputationScore {
    agent_id: string;
    score: number;
    confidence: number;
    factors: ReputationFactor[];
    computed_at: string;
    session_count: number;
}
/**
 * Individual reputation factor
 */
export interface ReputationFactor {
    name: string;
    weight: number;
    value: number;
    raw_count?: number;
}
/**
 * Session outcome for reputation calculation
 */
export type SessionOutcome = 'success' | 'rejected' | 'failed' | 'pending';
/**
 * Extract session outcome from transcript entries
 * Pure function — no side effects
 */
export declare function extractSessionOutcome(session: VerifierTranscriptSession): SessionOutcome;
/**
 * Calculate base reputation from session outcome
 * Pure function — no side effects
 */
export declare function calculateBaseReputation(outcome: SessionOutcome): number;
/**
 * Calculate execution quality score
 * Based on gas efficiency, step count, error rate
 * Pure function — no side effects
 */
export declare function calculateExecutionQuality(sessions: VerifierTranscriptSession[]): ReputationFactor;
/**
 * Calculate consistency score
 * Based on variance in outcomes
 * Pure function — no side effects
 */
export declare function calculateConsistency(sessions: VerifierTranscriptSession[]): ReputationFactor;
/**
 * Calculate volume score
 * Based on number of completed sessions
 * Pure function — no side effects
 */
export declare function calculateVolume(sessions: VerifierTranscriptSession[]): ReputationFactor;
/**
 * Calculate policy compliance score
 * Based on ratio of rejections vs failures
 * Pure function — no side effects
 */
export declare function calculatePolicyCompliance(sessions: VerifierTranscriptSession[]): ReputationFactor;
/**
 * Calculate recency score
 * Based on time since last successful session
 * Pure function — no side effects
 */
export declare function calculateRecency(sessions: VerifierTranscriptSession[]): ReputationFactor;
/**
 * Compute final reputation score
 * Pure function — no side effects
 */
export declare function computeReputation(agentId: string, sessions: VerifierTranscriptSession[]): ReputationScore;
/**
 * Compare two reputation scores
 * Pure function — no side effects
 */
export declare function compareReputation(scoreA: ReputationScore, scoreB: ReputationScore): number;
//# sourceMappingURL=ReputationEngine.d.ts.map