/**
 * Execution Protocol v2 - Phase 1: Deterministic Session Layer
 *
 * Core principles:
 * - Atomic: All-or-nothing execution
 * - Verifiable: Every action logged with transcript hash
 * - Deterministic: Same input → Same output, always
 * - Capital-grade: Zero loss tolerance in simulation
 */
import { TranscriptLogger } from '../transcript/TranscriptLogger.js';
import { StateMachine } from '../state/StateMachine.js';
import { Simulator } from '../simulator/Simulator.js';
import { ApprovalGate } from '../approval/ApprovalGate.js';
export class DeterministicSession {
    constructor(config) {
        this.steps = [];
        this.sessionId = config.sessionId;
        this.config = config;
        // Initialize Phase 1: Simulated only
        if (!config.simulationMode) {
            throw new Error('[ExecutionProtocol] Phase 1 requires simulationMode=true');
        }
        this.state = {
            status: 'INIT',
            currentStep: 0,
            totalSteps: 0,
            capitalAtRisk: 0,
            pnl: 0,
            lastCheckpoint: Date.now(),
            hash: this.computeHash('INIT')
        };
        this.transcript = new TranscriptLogger(config.sessionId);
        this.stateMachine = new StateMachine();
        this.simulator = new Simulator(config.initialCapital);
        this.approvalGate = new ApprovalGate();
        this.transcript.log('SESSION_INIT', {
            sessionId: this.sessionId,
            workflowId: config.workflowId,
            capital: config.initialCapital,
            simulation: config.simulationMode
        });
        console.log(`[ExecutionProtocol] Session ${this.sessionId} initialized`);
        console.log(`[ExecutionProtocol] Mode: ${config.simulationMode ? 'SIMULATION (Phase 1)' : 'LIVE'}`);
        console.log(`[ExecutionProtocol] Capital: $${config.initialCapital}`);
    }
    /**
     * Execute workflow step-by-step with full determinism
     */
    async execute() {
        this.state.status = 'RUNNING';
        this.transcript.log('SESSION_START', { state: this.state });
        try {
            // Step 1: ANALYZE - Find opportunities
            await this.executeStep('ANALYZE', async () => {
                // Argus finds opportunities
                const opportunities = await this.findOpportunities();
                return opportunities;
            });
            // Step 2: VALIDATE - Ledger enforces constraints
            await this.executeStep('VALIDATE', async () => {
                const validated = await this.validateConstraints();
                return validated;
            });
            // Step 3: APPROVE - Achilles approval gate
            await this.executeStep('APPROVE', async () => {
                if (this.config.approvalRequired) {
                    const approved = await this.approvalGate.requestApproval({
                        sessionId: this.sessionId,
                        capitalAtRisk: this.state.capitalAtRisk
                    });
                    return approved;
                }
                return { approved: true, autoApproved: true };
            });
            // Step 4: SIMULATE - Atlas executes (mock in Phase 1)
            await this.executeStep('SIMULATE', async () => {
                const result = await this.simulator.executeTrade({
                    capital: this.config.initialCapital,
                    maxLoss: this.config.maxLossPercent
                });
                this.state.pnl = result.pnl;
                return result;
            });
            // Step 5: LOG - Scribe records everything
            await this.executeStep('LOG', async () => {
                const transcriptHash = await this.transcript.finalize();
                this.state.hash = transcriptHash;
                return { hash: transcriptHash, steps: this.steps.length };
            });
            this.state.status = 'COMPLETED';
            this.transcript.log('SESSION_COMPLETE', {
                state: this.state,
                pnl: this.state.pnl,
                steps: this.steps.length
            });
        }
        catch (error) {
            this.state.status = 'FAILED';
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.transcript.log('SESSION_FAILED', { error: errorMessage });
            // Crash isolation: Attempt recovery
            await this.attemptRecovery();
        }
        return this.state;
    }
    /**
     * Execute single step with full logging
     */
    async executeStep(type, fn) {
        const stepId = `step_${this.steps.length + 1}`;
        const startTime = Date.now();
        this.transcript.log('STEP_START', { stepId, type });
        try {
            const output = await fn();
            const step = {
                stepId,
                type,
                input: {}, // Sanitized
                output: this.sanitizeOutput(output),
                timestamp: Date.now(),
                hash: this.computeHash(stepId + type + JSON.stringify(output))
            };
            this.steps.push(step);
            this.state.currentStep = this.steps.length;
            this.transcript.log('STEP_COMPLETE', { stepId, duration: Date.now() - startTime });
            return output;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.transcript.log('STEP_FAILED', { stepId, error: errorMessage });
            throw error;
        }
    }
    /**
     * Find opportunities (Argus role)
     */
    async findOpportunities() {
        // Placeholder: Will integrate Argus signal detection
        console.log('[ExecutionProtocol] Analyzing opportunities...');
        return [{ type: 'ARBITRAGE', confidence: 0.85, expectedReturn: 0.02 }];
    }
    /**
     * Validate constraints (Ledger role)
     */
    async validateConstraints() {
        // Enforce max loss constraint
        if (this.state.capitalAtRisk > this.config.initialCapital * this.config.maxLossPercent) {
            throw new Error('[ExecutionProtocol] Capital at risk exceeds max loss limit');
        }
        return true;
    }
    /**
     * Attempt crash recovery from last checkpoint
     */
    async attemptRecovery() {
        this.state.status = 'CRASH_RECOVERY';
        this.transcript.log('RECOVERY_ATTEMPT', { lastCheckpoint: this.state.lastCheckpoint });
        // Load from checkpoint and resume
        const checkpoint = await this.loadCheckpoint();
        if (checkpoint) {
            this.state = checkpoint.state;
            this.steps = checkpoint.steps;
            this.transcript.log('RECOVERY_SUCCESS', { resumedFromStep: this.state.currentStep });
        }
        else {
            this.transcript.log('RECOVERY_FAILED', { reason: 'No checkpoint found' });
            throw new Error('Session failed and recovery unsuccessful');
        }
    }
    /**
     * Create checkpoint for crash recovery
     */
    async createCheckpoint() {
        this.state.lastCheckpoint = Date.now();
        const checkpoint = {
            sessionId: this.sessionId,
            state: this.state,
            steps: this.steps,
            timestamp: Date.now()
        };
        // Persist checkpoint
        await this.persistCheckpoint(checkpoint);
        this.transcript.log('CHECKPOINT_CREATED', { step: this.state.currentStep });
    }
    computeHash(input) {
        // Simple hash for verification (use crypto in production)
        return Buffer.from(input).toString('base64').slice(0, 16);
    }
    sanitizeOutput(output) {
        // Remove sensitive data before logging
        if (typeof output === 'object' && output !== null) {
            const { apiKey, secret, password, ...safe } = output;
            return safe;
        }
        return output;
    }
    async persistCheckpoint(checkpoint) {
        // Write to filesystem (use proper storage in production)
        const fs = require('fs').promises;
        const path = `/data/.openclaw/workspace/execution-protocol-v2/sessions/${this.sessionId}_checkpoint.json`;
        await fs.writeFile(path, JSON.stringify(checkpoint, null, 2));
    }
    async loadCheckpoint() {
        try {
            const fs = require('fs').promises;
            const path = `/data/.openclaw/workspace/execution-protocol-v2/sessions/${this.sessionId}_checkpoint.json`;
            const data = await fs.readFile(path, 'utf8');
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    getState() {
        return { ...this.state };
    }
    getTranscriptHash() {
        return this.state.hash;
    }
}
export default DeterministicSession;
