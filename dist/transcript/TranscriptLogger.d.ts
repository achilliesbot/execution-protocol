/**
 * Transcript Logger — Execution Protocol v2
 *
 * GOVERNANCE.md §4: Transcript Integrity
 * - Hash-chained, immutable, replay-safe
 * - Transcript mutation is forbidden
 *
 * Creates permanent audit trail of all execution decisions.
 *
 * Build: Sonnet 4.6
 * Review: Codex 5.3
 */
import { ExecutionPlan } from '../execution';
import { ValidationResult } from '../policy';
/**
 * Transcript Entry
 *
 * Single unit of execution history.
 * Each entry links to previous via hash chain.
 */
export interface TranscriptEntry {
    entry_id: string;
    session_id: string;
    entry_hash: string;
    previous_hash: string | null;
    entry_type: EntryType;
    timestamp: string;
    content: ProposalContent | ValidationContent | PlanContent | ExecutionContent | RejectionContent;
    agent_id: string;
    model?: string;
    signature?: string;
}
export type EntryType = 'proposal_received' | 'validation_complete' | 'plan_generated' | 'execution_attempted' | 'execution_confirmed' | 'execution_failed' | 'rejected' | 'SESSION_INIT' | 'SESSION_START' | 'SESSION_COMPLETE' | 'SESSION_FAILED' | 'STEP_START' | 'STEP_COMPLETE' | 'STEP_FAILED' | 'RECOVERY_ATTEMPT' | 'RECOVERY_SUCCESS' | 'RECOVERY_FAILED' | 'CHECKPOINT_CREATED';
export interface ProposalContent {
    proposal_id: string;
    proposal_hash: string;
    intent_summary: string;
    confidence: number;
}
export interface ValidationContent {
    proposal_id: string;
    validation_result: ValidationResult;
    passed: boolean;
    violations_count: number;
}
export interface PlanContent {
    proposal_id: string;
    plan_id: string;
    plan_hash: string;
    steps_count: number;
    estimated_gas?: number;
    risk_flags: string[];
}
export interface ExecutionContent {
    plan_id: string;
    step_number: number;
    transaction_hash?: string;
    block_number?: number;
    gas_used?: number;
    effective_gas_price?: string;
    status: 'pending' | 'confirmed' | 'failed';
    actual_result?: {
        asset_in?: string;
        asset_out?: string;
        amount_in?: string;
        amount_out?: string;
    };
}
export interface RejectionContent {
    proposal_id: string;
    rejection_reason: string;
    violations: string[];
    can_retry: boolean;
}
/**
 * Transcript Session
 *
 * A complete execution session from proposal to final state.
 */
export interface TranscriptSession {
    session_id: string;
    started_at: string;
    ended_at?: string;
    status: 'active' | 'completed' | 'failed';
    agent_id: string;
    policy_set_id: string;
    entries: TranscriptEntry[];
    final_outcome?: 'success' | 'failure' | 'rejected';
    total_gas_used?: number;
    pnl_usd?: number;
}
/**
 * Transcript Logger
 *
 * Maintains append-only, hash-chained transcript of all execution activity.
 * GOVERNANCE.md §4: Immutable, replay-safe.
 */
export declare class TranscriptLogger {
    private sessions;
    private storagePath;
    private currentSessionId;
    constructor(sessionId?: string, storagePath?: string);
    /**
     * Start a new execution session
     */
    startSession(sessionId: string, agentId: string, policySetId: string): TranscriptSession;
    /**
     * Log a proposal receipt
     */
    logProposal(sessionId: string, proposalId: string, proposalHash: string, intentSummary: string, confidence: number, agentId: string, model?: string): TranscriptEntry;
    /**
     * Log validation completion
     */
    logValidation(sessionId: string, proposalId: string, validationResult: ValidationResult): TranscriptEntry;
    /**
     * Log execution plan generation
     */
    logPlanGenerated(sessionId: string, proposalId: string, plan: ExecutionPlan): TranscriptEntry;
    /**
     * Log execution attempt
     */
    logExecutionAttempt(sessionId: string, planId: string, stepNumber: number): TranscriptEntry;
    /**
     * Log execution confirmation (on-chain success)
     */
    logExecutionConfirmed(sessionId: string, planId: string, stepNumber: number, transactionHash: string, blockNumber: number, gasUsed: number, actualResult: ExecutionContent['actual_result']): TranscriptEntry;
    /**
     * Log execution failure
     */
    logExecutionFailed(sessionId: string, planId: string, stepNumber: number, error: string): TranscriptEntry;
    /**
     * Log proposal rejection
     */
    logRejection(sessionId: string, proposalId: string, reason: string, violations: string[], canRetry: boolean): TranscriptEntry;
    /**
     * Complete a session successfully
     */
    completeSession(sessionId: string, pnlUsd?: number): void;
    /**
     * Verify transcript integrity (hash chain)
     */
    verifyTranscript(sessionId: string): boolean;
    /**
     * Replay a session (deterministic replay)
     */
    replaySession(sessionId: string): TranscriptSession;
    private getSession;
    private getLastHash;
    /**
     * Generic log method for simple entry logging
     * Used for status updates and generic events
     */
    log(entryType: EntryType, content: Record<string, unknown>): TranscriptEntry;
    /**
     * Finalize transcript and return head hash
     * Marks session as complete
     */
    finalize(): Promise<string>;
    private computeEntryHash;
    private estimateGas;
    private persistSession;
}
//# sourceMappingURL=TranscriptLogger.d.ts.map