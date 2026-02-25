/**
 * State Machine - Deterministic session lifecycle
 *
 * INIT → RUNNING → [PAUSED] → COMPLETED/FAILED → [CRASH_RECOVERY]
 */
export class StateMachine {
    constructor() {
        this.transitions = [
            { from: 'INIT', to: 'RUNNING', allowed: true },
            { from: 'RUNNING', to: 'PAUSED', allowed: true },
            { from: 'RUNNING', to: 'COMPLETED', allowed: true },
            { from: 'RUNNING', to: 'FAILED', allowed: true },
            { from: 'PAUSED', to: 'RUNNING', allowed: true },
            { from: 'PAUSED', to: 'FAILED', allowed: true },
            { from: 'FAILED', to: 'CRASH_RECOVERY', allowed: true },
            { from: 'CRASH_RECOVERY', to: 'RUNNING', allowed: true, condition: 'recovery_success' },
            { from: 'CRASH_RECOVERY', to: 'FAILED', allowed: true, condition: 'recovery_failed' }
        ];
    }
    canTransition(from, to) {
        const transition = this.transitions.find(t => t.from === from && t.to === to);
        return transition?.allowed ?? false;
    }
    validateTransition(from, to) {
        if (!this.canTransition(from, to)) {
            throw new Error(`[StateMachine] Invalid transition: ${from} → ${to}`);
        }
    }
    getValidTransitions(from) {
        return this.transitions
            .filter(t => t.from === from && t.allowed)
            .map(t => t.to);
    }
}
export default StateMachine;
//# sourceMappingURL=StateMachine.js.map