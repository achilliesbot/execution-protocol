/**
 * BnkrAdapter — Bridge between Execution Protocol and Bankr.bot
 * 
 * Maps ExecutionPlan artifacts → BnkrOrderRequest
 * Handles DRY_RUN vs LIVE mode switching
 */

import BnkrClient, { BnkrOrderRequest, BnkrDryRunResponse, BnkrOrderResponse } from './BnkrClient.js';
import { getExecutionMode } from '../config/ExecutionMode.js';

export interface BnkrSettlement {
  mode: 'SIM' | 'DRY_RUN' | 'LIVE';
  bnkr_order_id?: string;
  bnkr_price?: number;
  bnkr_slippage_bps?: number;
  bnkr_tx_hash?: string;
  error?: string;
}

export class BnkrAdapter {
  private client: BnkrClient;

  constructor() {
    this.client = new BnkrClient();
  }

  /**
   * Settle a trade via Bankr.bot
   * 
   * Flow:
   * - SIM: return placeholder
   * - DRY_RUN: call dry-run endpoint, get simulation
   * - LIVE: broadcast to Bankr, get tx_hash + settlement
   */
  async settle(
    asset: string,
    direction: 'buy' | 'sell',
    amount_usd: number,
    stop_loss?: number,
    take_profit?: number
  ): Promise<BnkrSettlement> {
    const mode = getExecutionMode();

    if (mode === 'SIM') {
      return {
        mode: 'SIM',
        bnkr_price: 0, // placeholder
        bnkr_slippage_bps: 0
      };
    }

    if (mode === 'DRY_RUN') {
      try {
        const dryRun = await this.client.submitDryRunOrder({
          asset,
          direction,
          amount_usd,
          stop_loss_price: stop_loss,
          take_profit_price: take_profit
        });

        return {
          mode: 'DRY_RUN',
          bnkr_order_id: dryRun.order_id,
          bnkr_price: dryRun.would_be_price,
          bnkr_slippage_bps: dryRun.would_be_slippage_bps
        };
      } catch (err) {
        return {
          mode: 'DRY_RUN',
          error: `Dry run failed: ${err}`
        };
      }
    }

    if (mode === 'LIVE') {
      // LIVE requires explicit operator acknowledgment (fail-closed)
      const ack = process.env.LIVE_OPERATOR_ACK;
      if (ack !== 'I_UNDERSTAND_LIVE') {
        return {
          mode: 'LIVE',
          error: 'LIVE mode requires LIVE_OPERATOR_ACK=I_UNDERSTAND_LIVE'
        };
      }

      try {
        // In production, operatorSig would be from HSMS / hardware signer
        const operatorSig = process.env.OPERATOR_SIGNATURE || 'unsigned';

        const liveOrder = await this.client.submitLiveOrder(
          {
            asset,
            direction,
            amount_usd,
            stop_loss_price: stop_loss,
            take_profit_price: take_profit
          },
          operatorSig
        );

        return {
          mode: 'LIVE',
          bnkr_order_id: liveOrder.order_id,
          bnkr_price: liveOrder.filled_price,
          bnkr_tx_hash: liveOrder.tx_hash
        };
      } catch (err) {
        return {
          mode: 'LIVE',
          error: `Live order failed: ${err}`
        };
      }
    }

    return {
      mode: 'SIM',
      error: 'Unknown execution mode'
    };
  }

  /**
   * Verify that required Phase 2 assets are tradeable on Bnkr
   */
  async verifyPhase2Assets(): Promise<{
    ok: boolean;
    assets: Record<string, boolean>;
    message: string;
  }> {
    const required = ['BNKR', 'CLAWD', 'BNKRW'];
    const assets: Record<string, boolean> = {};

    try {
      const tradeableAssets = await this.client.getTradeableAssets();
      const symbols = new Set(tradeableAssets.map(a => a.symbol));

      for (const asset of required) {
        assets[asset] = symbols.has(asset);
      }

      const allPresent = required.every(a => assets[a]);
      return {
        ok: allPresent,
        assets,
        message: allPresent
          ? 'All Phase 2 assets (BNKR, CLAWD, BNKRW) are tradeable on Bnkr.bot'
          : `Missing assets: ${required.filter(a => !assets[a]).join(', ')}`
      };
    } catch (err) {
      return {
        ok: false,
        assets: {},
        message: `Asset verification failed: ${err}`
      };
    }
  }
}

export default BnkrAdapter;
