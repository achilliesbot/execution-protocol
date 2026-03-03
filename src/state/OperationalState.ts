/**
 * Operational State Writer — Execution Protocol v2
 * 
 * Writes STATE.json for unified operational telemetry.
 * Dashboard and cron both read this file.
 * 
 * GOVERNANCE.md §4: Operational telemetry only. NOT protocol proofs.
 */

import * as fs from 'fs';
import * as path from 'path';

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

const DEFAULT_STATE: OperationalState = {
  schema_version: '1.0.0',
  build: {
    git_hash: 'unknown',
    timestamp: new Date().toISOString()
  },
  runtime: {
    uptime_seconds: 0,
    last_updated: new Date().toISOString()
  },
  sessions: {
    last_session_id: null,
    last_session_status: null,
    last_transcript_head_hash: null,
    count_24h: 0,
    count_total: 0
  },
  policy: {
    active_set_hash: 'unknown',
    version: 'unknown'
  },
  agents: {
    achilles: 'ACTIVE',
    sentinel: 'ACTIVE',
    atlas: 'DORMANT',
    argus: 'DORMANT'
  },
  alerts: [],
  health: {
    status: 'HEALTHY',
    checks_passed: 9,
    checks_total: 10
  },
  phase5: {
    attestation_status: 'disabled',
    fee_accrual_total: 0,
    reputation_score_latest: 0,
    enabled_features: {
      attestation: false,
      fee_accounting: false
    }
  }
};

/**
 * Read current operational state from STATE.json
 * Returns default state if file missing or corrupt
 */
export function readOperationalState(statePath: string = 'STATE.json'): OperationalState {
  try {
    if (!fs.existsSync(statePath)) {
      return { ...DEFAULT_STATE };
    }
    const content = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as OperationalState;
  } catch (error) {
    console.error('Failed to read STATE.json:', error);
    return { ...DEFAULT_STATE };
  }
}

/**
 * Write operational state to STATE.json
 */
export function writeOperationalState(
  state: Partial<OperationalState>,
  statePath: string = 'STATE.json'
): void {
  const currentState = readOperationalState(statePath);
  const newState: OperationalState = {
    ...currentState,
    ...state,
    runtime: {
      ...currentState.runtime,
      ...state.runtime,
      last_updated: new Date().toISOString()
    }
  };
  
  fs.writeFileSync(statePath, JSON.stringify(newState, null, 2));
}

/**
 * Check if state is fresh, stale, or unavailable
 */
export function checkStateFreshness(state: OperationalState): 'FRESH' | 'STALE' | 'UNAVAILABLE' {
  if (!state.runtime?.last_updated) {
    return 'UNAVAILABLE';
  }
  
  const lastUpdated = new Date(state.runtime.last_updated).getTime();
  const now = Date.now();
  const ageMinutes = (now - lastUpdated) / 1000 / 60;
  
  if (ageMinutes < 5) return 'FRESH';
  if (ageMinutes < 15) return 'STALE';
  return 'UNAVAILABLE';
}

/**
 * Get git hash from current repo
 */
export function getGitHash(): string {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Initialize STATE.json with current system state
 */
export function initializeState(statePath: string = 'STATE.json'): void {
  const state: OperationalState = {
    ...DEFAULT_STATE,
    build: {
      git_hash: getGitHash(),
      timestamp: new Date().toISOString()
    }
  };
  
  writeOperationalState(state, statePath);
}
