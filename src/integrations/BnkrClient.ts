/**
 * BnkrClient — Bankr.bot REST API Integration
 * 
 * Handles:
 * - Asset discovery (tradeable assets list)
 * - Market data (prices, spreads)
 * - Order submission (DRY_RUN simulation, LIVE broadcast)
 * - Order status / settlement
 */

export interface BnkrAsset {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  tradeable: boolean;
}

export interface BnkrMarket {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread_bps: number;
}

export interface BnkrOrderRequest {
  asset: string;
  direction: 'buy' | 'sell';
  amount_usd: number;
  leverage?: number;
  stop_loss_price?: number;
  take_profit_price?: number;
}

export interface BnkrOrderResponse {
  order_id: string;
  status: 'pending' | 'filled' | 'partial' | 'rejected';
  filled_amount_usd: number;
  filled_price: number;
  timestamp: string;
  tx_hash?: string;
}

export interface BnkrDryRunResponse {
  order_id: string;
  simulated: true;
  would_be_price: number;
  would_be_slippage_bps: number;
  timestamp: string;
}

export class BnkrClient {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.BNKR_URL || 'https://bankr.bot/api';
    this.apiKey = process.env.BNKR_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('BNKR_API_KEY env var is required');
    }
  }

  /**
   * Verify API connection is live
   */
  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const resp = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (resp.ok) {
        return { ok: true, message: 'Bankr.bot API is live' };
      } else {
        return { ok: false, message: `API health check failed: ${resp.status}` };
      }
    } catch (err) {
      return { ok: false, message: `Connection error: ${err}` };
    }
  }

  /**
   * List all tradeable assets
   */
  async getTradeableAssets(): Promise<BnkrAsset[]> {
    try {
      const resp = await fetch(`${this.apiUrl}/assets`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (!resp.ok) {
        throw new Error(`Assets endpoint failed: ${resp.status}`);
      }

      const data = (await resp.json()) as { assets: BnkrAsset[] };
      return data.assets.filter(a => a.tradeable);
    } catch (err) {
      throw new Error(`Failed to fetch assets: ${err}`);
    }
  }

  /**
   * Get current market data for an asset
   */
  async getMarketData(symbol: string): Promise<BnkrMarket> {
    try {
      const resp = await fetch(`${this.apiUrl}/markets/${symbol}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (!resp.ok) {
        throw new Error(`Market data endpoint failed: ${resp.status}`);
      }

      return (await resp.json()) as BnkrMarket;
    } catch (err) {
      throw new Error(`Failed to fetch market data for ${symbol}: ${err}`);
    }
  }

  /**
   * Submit order for DRY_RUN (simulation, no broadcast)
   */
  async submitDryRunOrder(req: BnkrOrderRequest): Promise<BnkrDryRunResponse> {
    try {
      const resp = await fetch(`${this.apiUrl}/orders/dry-run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asset: req.asset,
          direction: req.direction,
          amount_usd: req.amount_usd,
          leverage: req.leverage || 1
        })
      });

      if (!resp.ok) {
        throw new Error(`Dry run order failed: ${resp.status}`);
      }

      return (await resp.json()) as BnkrDryRunResponse;
    } catch (err) {
      throw new Error(`Failed to submit dry run order: ${err}`);
    }
  }

  /**
   * Submit order for LIVE (only called when EXECUTION_MODE=LIVE + ACK set)
   * Requires operator signature / out-of-process confirmation
   */
  async submitLiveOrder(req: BnkrOrderRequest, operatorSig: string): Promise<BnkrOrderResponse> {
    try {
      const resp = await fetch(`${this.apiUrl}/orders/live`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Operator-Signature': operatorSig
        },
        body: JSON.stringify({
          asset: req.asset,
          direction: req.direction,
          amount_usd: req.amount_usd,
          leverage: req.leverage || 1,
          stop_loss_price: req.stop_loss_price,
          take_profit_price: req.take_profit_price
        })
      });

      if (!resp.ok) {
        throw new Error(`Live order submission failed: ${resp.status}`);
      }

      return (await resp.json()) as BnkrOrderResponse;
    } catch (err) {
      throw new Error(`Failed to submit live order: ${err}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<BnkrOrderResponse> {
    try {
      const resp = await fetch(`${this.apiUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (!resp.ok) {
        throw new Error(`Order status fetch failed: ${resp.status}`);
      }

      return (await resp.json()) as BnkrOrderResponse;
    } catch (err) {
      throw new Error(`Failed to fetch order status: ${err}`);
    }
  }
}

export default BnkrClient;
