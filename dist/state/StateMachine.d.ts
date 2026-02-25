/**
 * State Machine - Deterministic session lifecycle
 *
 * INIT → RUNNING → [PAUSED] → COMPLETED/FAILED → [CRASH_RECOVERY]
 */
export type SessionStatus = 'INIT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CRASH_RECOVERY';
export interface StateTransition {
    from: SessionStatus;
    to: SessionStatus;
    condition?: string;
    allowed: boolean;
}
export declare class StateMachine {
    private transitions;
    canTransition(from: SessionStatus, to: SessionStatus): boolean;
    validateTransition(from: SessionStatus, to: SessionStatus): void;
    getValidTransitions(from: SessionStatus): SessionStatus[];
}
export default StateMachine;
//# sourceMappingURL=StateMachine.d.ts.map