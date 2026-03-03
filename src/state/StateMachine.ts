/**
 * State Machine - Deterministic session lifecycle
 * 
 * INIT → RUNNING → [PAUSED] → COMPLETED/FAILED → [CRASH_RECOVERY]
 */

export type SessionStatus = 
  | 'INIT' 
  | 'RUNNING' 
  | 'PAUSED' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CRASH_RECOVERY';

export interface StateTransition {
  from: SessionStatus;
  to: SessionStatus;
  condition?: string;
  allowed: boolean;
}

export class StateMachine {
  private transitions: StateTransition[] = [
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

  canTransition(from: SessionStatus, to: SessionStatus): boolean {
    const transition = this.transitions.find(t => t.from === from && t.to === to);
    return transition?.allowed ?? false;
  }

  validateTransition(from: SessionStatus, to: SessionStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`[StateMachine] Invalid transition: ${from} → ${to}`);
    }
  }

  getValidTransitions(from: SessionStatus): SessionStatus[] {
    return this.transitions
      .filter(t => t.from === from && t.allowed)
      .map(t => t.to);
  }
}

export default StateMachine;
