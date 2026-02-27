/**
 * Execution Protocol v2 - Phase 1: Deterministic Session Layer
 *
 * Core principles:
 * - Atomic: All-or-nothing execution
 * - Verifiable: Every action logged with transcript hash
 * - Deterministic: Same input → Same output, always
 * - Capital-grade: Zero loss tolerance in simulation
 */
export interface SessionConfig {
    sessionId: string;
    workflowId: string;
    initialCapital: number;
    maxLossPercent: number;
    approvalRequired: boolean;
    simulationMode: boolean;
}
export interface SessionState {
    status: 'INIT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CRASH_RECOVERY';
    currentStep: number;
    totalSteps: number;
    capitalAtRisk: number;
    pnl: number;
    lastCheckpoint: number;
    hash: string;
}
export interface ExecutionStep {
    stepId: string;
    type: 'ANALYZE' | 'VALIDATE' | 'APPROVE' | 'SIMULATE' | 'LOG';
    input: any;
    output?: any;
    timestamp: number;
    hash: string;
    approved?: boolean;
    approver?: string;
}
export declare class DeterministicSession {
    private sessionId;
    private config;
    private state;
    private transcript;
    private stateMachine;
    private simulator;
    private approvalGate;
    private steps;
    constructor(config: SessionConfig);
    /**
     * Execute workflow step-by-step with full determinism
     */
    execute(): Promise<SessionState>;
    /**
     * Execute single step with full logging
     */
    private executeStep;
    /**
     * Find opportunities (Argus role)
     */
    private findOpportunities;
    /**
     * Validate constraints (Ledger role)
     */
    private validateConstraints;
    /**
     * Attempt crash recovery from last checkpoint
     */
    private attemptRecovery;
    /**
     * Create checkpoint for crash recovery
     */
    createCheckpoint(): Promise<void>;
    private computeHash;
    private sanitizeOutput;
    private persistCheckpoint;
    private loadCheckpoint;
    getState(): SessionState;
    getTranscriptHash(): string;
}
export default DeterministicSession;
//# sourceMappingURL=DeterministicSession.d.ts.map