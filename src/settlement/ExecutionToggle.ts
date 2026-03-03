/**
 * Phase 7 — P7-4 Execution Toggle: SIM → DRY_RUN → LIVE
 *
 * Requirements:
 * - Default must be SIM
 * - DRY_RUN generates deterministic tx payloads + logs
 * - Broadcast must be impossible unless LIVE is explicitly toggled by Commander/operator
 */

import { getExecutionModeStatus, computeTxPayloadHash } from '../config/ExecutionMode';
import { SettlementAdapter, SettlementRequest, SettlementResult } from './BaseSettlementAdapter';

export interface TxPayload {
  to: string;
  data: string;
  value: string;
  gas_limit: number;
}

export interface ToggleSettlementResult extends SettlementResult {
  mode: 'SIM' | 'DRY_RUN' | 'LIVE';
  tx_payload?: TxPayload;
  tx_payload_hash?: string;
}

function deterministicPayloadFromRequest(req: SettlementRequest): TxPayload {
  // Deterministic placeholder payload for DRY_RUN proofing.
  // Real payload generation will be implemented when live Bankr/Base integration is added.
  const dataHash = computeTxPayloadHash({
    entry_id: req.entry_id,
    amount: req.amount,
    currency: req.currency,
    recipient: req.recipient,
    transcript_head_hash: req.metadata.transcript_head_hash
  });

  return {
    to: req.recipient,
    data: '0x' + dataHash.replace(/[^a-f0-9]/gi, '').slice(0, 64).padEnd(64, '0'),
    value: String(req.amount),
    gas_limit: 100_000
  };
}

/**
 * Settle according to execution mode.
 */
export async function settleWithExecutionToggle(
  adapter: SettlementAdapter,
  request: SettlementRequest
): Promise<ToggleSettlementResult> {
  const status = getExecutionModeStatus();

  // Default: SIM
  if (status.mode === 'SIM') {
    const r = await adapter.settle(request, true);
    return { ...r, mode: 'SIM' };
  }

  // DRY_RUN: deterministic payload + no broadcast
  if (status.mode === 'DRY_RUN') {
    const tx_payload = deterministicPayloadFromRequest(request);
    const tx_payload_hash = computeTxPayloadHash(tx_payload);

    return {
      success: true,
      transaction_hash: null,
      status: 'SIMULATED',
      timestamp: new Date().toISOString(),
      mode: 'DRY_RUN',
      tx_payload,
      tx_payload_hash
    };
  }

  // LIVE: broadcast allowed ONLY if explicitly enabled
  if (!status.liveBroadcastEnabled) {
    return {
      success: false,
      transaction_hash: null,
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      mode: 'LIVE',
      error: `LIVE broadcast disabled: ${status.reason || 'unknown'}`
    };
  }

  // LIVE enabled: attempt non-simulated settlement
  const liveResult = await adapter.settle(request, false);
  return { ...liveResult, mode: 'LIVE' };
}
