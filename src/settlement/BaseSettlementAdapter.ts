/**
 * Settlement Base Types — Execution Protocol v2
 *
 * NOTE: This file is intentionally split out to avoid ESM circular deps:
 * - Adapters import BaseSettlementAdapter from here
 * - Factory can import adapters without adapters importing the factory module
 */

/**
 * Settlement request
 */
export interface SettlementRequest {
  entry_id: string;
  amount: number;
  currency: string;
  recipient: string; // Agent wallet address
  metadata: {
    session_id: string;
    transcript_head_hash: string;
  };
}

/**
 * Settlement result
 */
export interface SettlementResult {
  success: boolean;
  transaction_hash: string | null;
  status: 'SIMULATED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
  error?: string;
  timestamp: string;
}

/**
 * Settlement adapter interface
 */
export interface SettlementAdapter {
  readonly mode: 'null' | 'offchain' | 'onchain' | 'hybrid';
  readonly name: string;

  settle(request: SettlementRequest, simulate: boolean): Promise<SettlementResult>;
  isReady(): boolean;

  getStatus(): {
    ready: boolean;
    mode: string;
    simulate: boolean;
    network?: string;
  };
}

/**
 * Abstract base class for settlement adapters
 */
export abstract class BaseSettlementAdapter implements SettlementAdapter {
  abstract readonly mode: 'null' | 'offchain' | 'onchain' | 'hybrid';
  abstract readonly name: string;
  protected simulate: boolean = true;

  abstract settle(request: SettlementRequest, simulate: boolean): Promise<SettlementResult>;
  abstract isReady(): boolean;

  getStatus() {
    return {
      ready: this.isReady(),
      mode: this.mode,
      simulate: this.simulate
    };
  }

  /**
   * Validate settlement request (fail-closed)
   */
  protected validateRequest(request: SettlementRequest): boolean {
    if (!request.entry_id) return false;
    if (typeof request.amount !== 'number' || !Number.isFinite(request.amount) || request.amount <= 0) return false;
    if (!request.currency || typeof request.currency !== 'string') return false;
    if (!request.recipient || typeof request.recipient !== 'string' || request.recipient.length < 10) return false;
    if (!request.metadata || typeof request.metadata.session_id !== 'string' || typeof request.metadata.transcript_head_hash !== 'string') return false;
    return true;
  }

  protected createSimulatedResult(request: SettlementRequest): SettlementResult {
    return {
      success: true,
      transaction_hash: `sim_${Date.now()}_${request.entry_id.substring(0, 8)}`,
      status: 'SIMULATED',
      timestamp: new Date().toISOString()
    };
  }

  protected createFailedResult(error: string): SettlementResult {
    return {
      success: false,
      transaction_hash: null,
      status: 'FAILED',
      error,
      timestamp: new Date().toISOString()
    };
  }
}
