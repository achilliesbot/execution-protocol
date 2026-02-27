"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptLogger = void 0;
var canonicalization_1 = require("../canonicalization");
var crypto = require("crypto");
/**
 * Transcript Logger
 *
 * Maintains append-only, hash-chained transcript of all execution activity.
 * GOVERNANCE.md §4: Immutable, replay-safe.
 */
var TranscriptLogger = /** @class */ (function () {
    function TranscriptLogger(sessionId, storagePath) {
        if (storagePath === void 0) { storagePath = '~/.openclaw/transcripts'; }
        this.sessions = new Map();
        this.currentSessionId = null;
        this.storagePath = storagePath;
        if (sessionId) {
            this.currentSessionId = sessionId;
        }
    }
    /**
     * Start a new execution session
     */
    TranscriptLogger.prototype.startSession = function (sessionId, agentId, policySetId) {
        this.currentSessionId = sessionId;
        var session = {
            session_id: sessionId,
            started_at: new Date().toISOString(),
            status: 'active',
            agent_id: agentId,
            policy_set_id: policySetId,
            entries: []
        };
        this.sessions.set(sessionId, session);
        return session;
    };
    /**
     * Log a proposal receipt
     */
    TranscriptLogger.prototype.logProposal = function (sessionId, proposalId, proposalHash, intentSummary, confidence, agentId, model) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
            session_id: sessionId,
            entry_hash: '', // Computed below
            previous_hash: previousHash,
            entry_type: 'proposal_received',
            timestamp: new Date().toISOString(),
            content: {
                proposal_id: proposalId,
                proposal_hash: proposalHash,
                intent_summary: intentSummary,
                confidence: confidence
            },
            agent_id: agentId,
            model: model
        };
        // Compute hash after entry is complete
        entry.entry_hash = this.computeEntryHash(entry);
        session.entries.push(entry);
        this.persistSession(session);
        return entry;
    };
    /**
     * Log validation completion
     */
    TranscriptLogger.prototype.logValidation = function (sessionId, proposalId, validationResult) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
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
    };
    /**
     * Log execution plan generation
     */
    TranscriptLogger.prototype.logPlanGenerated = function (sessionId, proposalId, plan) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
            session_id: sessionId,
            entry_hash: '',
            previous_hash: previousHash,
            entry_type: 'plan_generated',
            timestamp: new Date().toISOString(),
            content: {
                proposal_id: proposalId,
                plan_id: plan.plan_id,
                plan_hash: (0, canonicalization_1.computeHash)(plan),
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
    };
    /**
     * Log execution attempt
     */
    TranscriptLogger.prototype.logExecutionAttempt = function (sessionId, planId, stepNumber) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
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
    };
    /**
     * Log execution confirmation (on-chain success)
     */
    TranscriptLogger.prototype.logExecutionConfirmed = function (sessionId, planId, stepNumber, transactionHash, blockNumber, gasUsed, actualResult) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
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
    };
    /**
     * Log execution failure
     */
    TranscriptLogger.prototype.logExecutionFailed = function (sessionId, planId, stepNumber, error) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
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
    };
    /**
     * Log proposal rejection
     */
    TranscriptLogger.prototype.logRejection = function (sessionId, proposalId, reason, violations, canRetry) {
        var session = this.getSession(sessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
            session_id: sessionId,
            entry_hash: '',
            previous_hash: previousHash,
            entry_type: 'rejected',
            timestamp: new Date().toISOString(),
            content: {
                proposal_id: proposalId,
                rejection_reason: reason,
                violations: violations,
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
    };
    /**
     * Complete a session successfully
     */
    TranscriptLogger.prototype.completeSession = function (sessionId, pnlUsd) {
        var session = this.getSession(sessionId);
        session.status = 'completed';
        session.ended_at = new Date().toISOString();
        session.final_outcome = 'success';
        if (pnlUsd !== undefined) {
            session.pnl_usd = pnlUsd;
        }
        this.persistSession(session);
    };
    /**
     * Verify transcript integrity (hash chain)
     */
    TranscriptLogger.prototype.verifyTranscript = function (sessionId) {
        var session = this.getSession(sessionId);
        for (var i = 0; i < session.entries.length; i++) {
            var entry = session.entries[i];
            // Verify entry hash
            var computedHash = this.computeEntryHash(entry);
            if (computedHash !== entry.entry_hash) {
                console.error("Hash mismatch at entry ".concat(i));
                return false;
            }
            // Verify chain linking (skip first entry)
            if (i > 0) {
                var previousEntry = session.entries[i - 1];
                if (entry.previous_hash !== previousEntry.entry_hash) {
                    console.error("Chain break at entry ".concat(i));
                    return false;
                }
            }
        }
        return true;
    };
    /**
     * Replay a session (deterministic replay)
     */
    TranscriptLogger.prototype.replaySession = function (sessionId) {
        var session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error("Session not found: ".concat(sessionId));
        }
        // Verify integrity before replay
        if (!this.verifyTranscript(sessionId)) {
            throw new Error("Transcript integrity check failed for ".concat(sessionId));
        }
        return session;
    };
    // Private helpers
    TranscriptLogger.prototype.getSession = function (sessionId) {
        var session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error("Session not found: ".concat(sessionId));
        }
        return session;
    };
    TranscriptLogger.prototype.getLastHash = function (session) {
        if (session.entries.length === 0) {
            return null;
        }
        return session.entries[session.entries.length - 1].entry_hash;
    };
    /**
     * Generic log method for simple entry logging
     * Used for status updates and generic events
     */
    TranscriptLogger.prototype.log = function (entryType, content) {
        if (!this.currentSessionId) {
            throw new Error('No active session. Call startSession() first.');
        }
        var session = this.getSession(this.currentSessionId);
        var previousHash = this.getLastHash(session);
        var entry = {
            entry_id: "entry_".concat(Date.now()),
            session_id: this.currentSessionId,
            entry_hash: '',
            previous_hash: previousHash,
            entry_type: entryType,
            timestamp: new Date().toISOString(),
            content: content, // Generic content
            agent_id: session.agent_id
        };
        entry.entry_hash = this.computeEntryHash(entry);
        session.entries.push(entry);
        this.persistSession(session);
        return entry;
    };
    /**
     * Finalize transcript and return head hash
     * Marks session as complete
     */
    TranscriptLogger.prototype.finalize = function () {
        if (!this.currentSessionId) {
            throw new Error('No active session to finalize.');
        }
        var session = this.getSession(this.currentSessionId);
        var finalHash = this.getLastHash(session) || '';
        session.status = 'completed';
        session.ended_at = new Date().toISOString();
        this.persistSession(session);
        return Promise.resolve(finalHash);
    };
    TranscriptLogger.prototype.computeEntryHash = function (entry) {
        // Hash ONLY deterministic fields (GOVERNANCE.md §4)
        // Metadata (entry_id, timestamp) stored but NOT hashed
        var hashInput = {
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
        var canonical = (0, canonicalization_1.canonicalize)(hashInput);
        return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
    };
    TranscriptLogger.prototype.estimateGas = function (plan) {
        // Rough estimate based on step types
        return plan.steps.reduce(function (total, step) {
            switch (step.type) {
                case 'approve_token': return total + 50000;
                case 'swap': return total + 200000;
                case 'bridge': return total + 300000;
                case 'validate_balance': return total + 0;
                default: return total + 100000;
            }
        }, 0);
    };
    TranscriptLogger.prototype.persistSession = function (session) {
        // In production, write to persistent storage
        // For now, keep in memory
        this.sessions.set(session.session_id, session);
        // TODO: Write to ~/.openclaw/transcripts/${sessionId}.json
    };
    return TranscriptLogger;
}());
exports.TranscriptLogger = TranscriptLogger;
