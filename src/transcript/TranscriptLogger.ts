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

import { computeHash, computeTranscriptHash, canonicalize } from '../canonicalization';
import * as crypto from 'crypto';
import { ExecutionPlan } from '../execution';
import { ValidationResult } from '../policy';

/**
 * Transcript Entry
 * 
 * Single unit of execution history.
 * Each entry links to previous via hash chain.
 */
export interface TranscriptEntry {
  entry_id: string;              // UUID
  session_id: string;            // Execution session
  
  // Hash chain linking
  entry_hash: string;            // Hash of this entry
  previous_hash: string | null;  // Hash of previous entry
  
  // What happened
  entry_type: EntryType;
  timestamp: string;             // ISO 8601
  
  // Content (varies by type)
  content: ProposalContent | ValidationContent | PlanContent | ExecutionContent | RejectionContent;
  
  // Actors
  agent_id: string;              // Who initiated
  model?: string;                // Which LLM (if applicable)
  
  // Verification
  signature?: string;            // Optional cryptographic signature
}

export type EntryType = 
  | 'proposal_received'      // OpportunityProposal submitted
  | 'validation_complete'    // Policy validation finished
  | 'plan_generated'         // ExecutionPlan created
  | 'execution_attempted'    // Transaction submitted
  | 'execution_confirmed'    // On-chain confirmation
  | 'execution_failed'       // Transaction failed
  | 'rejected'               // Proposal rejected by policy
  | 'SESSION_INIT'           // Session initialized
  | 'SESSION_START'          // Session execution started
  | 'SESSION_COMPLETE'       // Session completed successfully
  | 'SESSION_FAILED'         // Session failed
  | 'STEP_START'             // Step started
  | 'STEP_COMPLETE'          // Step completed
  | 'STEP_FAILED'            // Step failed
  | 'RECOVERY_ATTEMPT'       // Recovery attempt
  | 'RECOVERY_SUCCESS'       // Recovery succeeded
  | 'RECOVERY_FAILED'        // Recovery failed
  | 'CHECKPOINT_CREATED';    // Checkpoint created

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
  transaction_hash?: string;     // On-chain tx hash
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
  
  // Participants
  agent_id: string;
  policy_set_id: string;
  
  // Entries
  entries: TranscriptEntry[];
  
  // Final state
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
export class TranscriptLogger {
  private sessions: Map<string, TranscriptSession> = new Map();
  private storagePath: string;
  private currentSessionId: string | null = null;
  
  constructor(sessionId?: string, storagePath: string = '~/.openclaw/transcripts') {
    this.storagePath = storagePath;
    if (sessionId) {
      this.currentSessionId = sessionId;
    }
  }
  
  /**
   * Start a new execution session
   */
  startSession(
    sessionId: string,
    agentId: string,
    policySetId: string
  ): TranscriptSession {
    this.currentSessionId = sessionId;
    const session: TranscriptSession = {
      session_id: sessionId,
      started_at: new Date().toISOString(),
      status: 'active',
      agent_id: agentId,
      policy_set_id: policySetId,
      entries: []
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  /**
   * Log a proposal receipt
   */
  logProposal(
    sessionId: string,
    proposalId: string,
    proposalHash: string,
    intentSummary: string,
    confidence: number,
    agentId: string,
    model?: string
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '', // Computed below
      previous_hash: previousHash,
      entry_type: 'proposal_received',
      timestamp: new Date().toISOString(),
      content: {
        proposal_id: proposalId,
        proposal_hash: proposalHash,
        intent_summary: intentSummary,
        confidence
      },
      agent_id: agentId,
      model
    };
    
    // Compute hash after entry is complete
    entry.entry_hash = this.computeEntryHash(entry);
    
    session.entries.push(entry);
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log validation completion
   */
  logValidation(
    sessionId: string,
    proposalId: string,
    validationResult: ValidationResult
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'validation_complete',
      timestamp: new Date().toISOString(),
      content: {
        proposal_id: proposalId,
        validation_result: validationResult,
        passed: validationResult.valid,
        violations_count: validationResult.violations.length
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log execution plan generation
   */
  logPlanGenerated(
    sessionId: string,
    proposalId: string,
    plan: ExecutionPlan
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'plan_generated',
      timestamp: new Date().toISOString(),
      content: {
        proposal_id: proposalId,
        plan_id: plan.plan_id,
        plan_hash: computeHash(plan),
        steps_count: plan.steps.length,
        estimated_gas: this.estimateGas(plan),
        risk_flags: plan.execution_risk.flags
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log execution attempt
   */
  logExecutionAttempt(
    sessionId: string,
    planId: string,
    stepNumber: number
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'execution_attempted',
      timestamp: new Date().toISOString(),
      content: {
        plan_id: planId,
        step_number: stepNumber,
        status: 'pending'
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log execution confirmation (on-chain success)
   */
  logExecutionConfirmed(
    sessionId: string,
    planId: string,
    stepNumber: number,
    transactionHash: string,
    blockNumber: number,
    gasUsed: number,
    actualResult: ExecutionContent['actual_result']
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'execution_confirmed',
      timestamp: new Date().toISOString(),
      content: {
        plan_id: planId,
        step_number: stepNumber,
        transaction_hash: transactionHash,
        block_number: blockNumber,
        gas_used: gasUsed,
        status: 'confirmed',
        actual_result: actualResult
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    
    // Update session with gas used
    session.total_gas_used = (session.total_gas_used || 0) + gasUsed;
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log execution failure
   */
  logExecutionFailed(
    sessionId: string,
    planId: string,
    stepNumber: number,
    error: string
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'execution_failed',
      timestamp: new Date().toISOString(),
      content: {
        plan_id: planId,
        step_number: stepNumber,
        status: 'failed'
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    
    session.status = 'failed';
    session.ended_at = new Date().toISOString();
    session.final_outcome = 'failure';
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Log proposal rejection
   */
  logRejection(
    sessionId: string,
    proposalId: string,
    reason: string,
    violations: string[],
    canRetry: boolean
  ): TranscriptEntry {
    const session = this.getSession(sessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: sessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: 'rejected',
      timestamp: new Date().toISOString(),
      content: {
        proposal_id: proposalId,
        rejection_reason: reason,
        violations,
        can_retry: canRetry
      },
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    
    session.status = 'completed';
    session.ended_at = new Date().toISOString();
    session.final_outcome = 'rejected';
    this.persistSession(session);
    
    return entry;
  }
  
  /**
   * Complete a session successfully
   */
  completeSession(sessionId: string, pnlUsd?: number): void {
    const session = this.getSession(sessionId);
    session.status = 'completed';
    session.ended_at = new Date().toISOString();
    session.final_outcome = 'success';
    if (pnlUsd !== undefined) {
      session.pnl_usd = pnlUsd;
    }
    this.persistSession(session);
  }
  
  /**
   * Verify transcript integrity (hash chain)
   */
  verifyTranscript(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    
    for (let i = 0; i < session.entries.length; i++) {
      const entry = session.entries[i];
      
      // Verify entry hash
      const computedHash = this.computeEntryHash(entry);
      if (computedHash !== entry.entry_hash) {
        console.error(`Hash mismatch at entry ${i}`);
        return false;
      }
      
      // Verify chain linking (skip first entry)
      if (i > 0) {
        const previousEntry = session.entries[i - 1];
        if (entry.previous_hash !== previousEntry.entry_hash) {
          console.error(`Chain break at entry ${i}`);
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Replay a session (deterministic replay)
   */
  replaySession(sessionId: string): TranscriptSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Verify integrity before replay
    if (!this.verifyTranscript(sessionId)) {
      throw new Error(`Transcript integrity check failed for ${sessionId}`);
    }
    
    return session;
  }
  
  // Private helpers
  
  private getSession(sessionId: string): TranscriptSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
  
  private getLastHash(session: TranscriptSession): string | null {
    if (session.entries.length === 0) {
      return null;
    }
    return session.entries[session.entries.length - 1].entry_hash;
  }
  
  /**
   * Generic log method for simple entry logging
   * Used for status updates and generic events
   */
  log(
    entryType: EntryType,
    content: Record<string, unknown>
  ): TranscriptEntry {
    if (!this.currentSessionId) {
      throw new Error('No active session. Call startSession() first.');
    }
    const session = this.getSession(this.currentSessionId);
    const previousHash = this.getLastHash(session);
    
    const entry: TranscriptEntry = {
      entry_id: `entry_${Date.now()}`,
      session_id: this.currentSessionId,
      entry_hash: '',
      previous_hash: previousHash,
      entry_type: entryType,
      timestamp: new Date().toISOString(),
      content: content as any, // Generic content
      agent_id: session.agent_id
    };
    
    entry.entry_hash = this.computeEntryHash(entry);
    session.entries.push(entry);
    this.persistSession(session);
    
    return entry;
  }

  /**
   * Finalize transcript and return head hash
   * Marks session as complete
   */
  finalize(): Promise<string> {
    if (!this.currentSessionId) {
      throw new Error('No active session to finalize.');
    }
    const session = this.getSession(this.currentSessionId);
    const finalHash = this.getLastHash(session) || '';
    
    session.status = 'completed';
    session.ended_at = new Date().toISOString();
    this.persistSession(session);
    
    return Promise.resolve(finalHash);
  }

  private computeEntryHash(entry: TranscriptEntry): string {
    // Hash ONLY deterministic fields (GOVERNANCE.md §4)
    // Metadata (entry_id, timestamp) stored but NOT hashed
    const hashInput = {
      session_id: entry.session_id,
      previous_hash: entry.previous_hash,
      entry_type: entry.entry_type,
      content: entry.content,
      agent_id: entry.agent_id,
      model: entry.model
      // EXCLUDED from hash (determinism required):
      // - entry_id: uses Date.now(), non-deterministic
      // - timestamp: runtime value, non-deterministic
      // - entry_hash: circular reference
    };
    // CRITICAL: Use direct canonicalization without field stripping
    // Transcript hash input must be deterministic BY CONSTRUCTION, not mutation
    const canonical = canonicalize(hashInput);
    return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
  }
  
  private estimateGas(plan: ExecutionPlan): number {
    // Rough estimate based on step types
    return plan.steps.reduce((total, step) => {
      switch (step.type) {
        case 'approve_token': return total + 50000;
        case 'swap': return total + 200000;
        case 'bridge': return total + 300000;
        case 'validate_balance': return total + 0;
        default: return total + 100000;
      }
    }, 0);
  }
  
  private persistSession(session: TranscriptSession): void {
    // In production, write to persistent storage
    // For now, keep in memory
    this.sessions.set(session.session_id, session);
    
    // TODO: Write to ~/.openclaw/transcripts/${sessionId}.json
  }
}