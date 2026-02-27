/**
 * Operational State Writer — Execution Protocol v2
 *
 * Writes STATE.json for unified operational telemetry.
 * Dashboard and cron both read this file.
 *
 * GOVERNANCE.md §4: Operational telemetry only. NOT protocol proofs.
 */
export interface OperationalState {
    schema_version: string;
    build: {
        git_hash: string;
        timestamp: string;
    };
    runtime: {
        uptime_seconds: number;
        last_updated: string;
    };
    sessions: {
        last_session_id: string | null;
        last_session_status: 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'PENDING' | null;
        last_transcript_head_hash: string | null;
        count_24h: number;
        count_total: number;
    };
    policy: {
        active_set_hash: string;
        version: string;
    };
    agents: Record<string, 'ACTIVE' | 'DORMANT' | 'ERROR'>;
    alerts: string[];
    health: {
        status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
        checks_passed: number;
        checks_total: number;
    };
    phase5?: {
        attestation_status: 'pending' | 'confirmed' | 'failed' | 'disabled';
        fee_accrual_total: number;
        reputation_score_latest: number;
        enabled_features: {
            attestation: boolean;
            fee_accounting: boolean;
        };
    };
}
/**
 * Read current operational state from STATE.json
 * Returns default state if file missing or corrupt
 */
export declare function readOperationalState(statePath?: string): OperationalState;
/**
 * Write operational state to STATE.json
 */
export declare function writeOperationalState(state: Partial<OperationalState>, statePath?: string): void;
/**
 * Check if state is fresh, stale, or unavailable
 */
export declare function checkStateFreshness(state: OperationalState): 'FRESH' | 'STALE' | 'UNAVAILABLE';
/**
 * Get git hash from current repo
 */
export declare function getGitHash(): string;
/**
 * Initialize STATE.json with current system state
 */
export declare function initializeState(statePath?: string): void;
//# sourceMappingURL=OperationalState.d.ts.map