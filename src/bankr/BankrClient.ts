/**
 * Bankr.bot API Client
 * Execution Protocol Integration Layer
 * 
 * Environment:
 * - BNKR_API_KEY: API key for authentication
 * - BNKR_URL: Base URL (default: https://bankr.bot/api)
 */

export interface BankrConfig {
  apiKey: string;
  baseUrl: string;
}

export interface TradeRequest {
  from: string;      // Token symbol (e.g., "BNKR", "ETH", "USDC")
  to: string;        // Token symbol (e.g., "CLAWD", "BNKRW")
  amount: string;    // Amount as string (decimal)
  slippage?: number; // Max slippage % (default: 1.0)
}

export interface TradeQuote {
  id: string;
  from: string;
  to: string;
  amountIn: string;
  amountOut: string;
  price: string;
  slippage: number;
  expiry: number;    // Unix timestamp
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  tradeable: boolean;
}

export class BankrClient {
  private config: BankrConfig;

  constructor(config?: Partial<BankrConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.BNKR_API_KEY || '',
      baseUrl: config?.baseUrl || process.env.BNKR_URL || 'https://bankr.bot/api',
    };

    if (!this.config.apiKey) {
      throw new Error('BNKR_API_KEY required');
    }
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bankr API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Health check - verify API is live
   */
  async health(): Promise<{ status: string; version: string }> {
    return this.fetch('/health');
  }

  /**
   * List available tokens
   */
  async listTokens(): Promise<TokenInfo[]> {
    return this.fetch('/tokens');
  }

  /**
   * Get quote for a trade (DRY-RUN compatible)
   */
  async getQuote(request: TradeRequest): Promise<TradeQuote> {
    return this.fetch('/quote', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Execute a trade (LIVE mode only)
   */
  async executeTrade(request: TradeRequest & { quoteId: string }): Promise<{
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
  }> {
    return this.fetch('/trade', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Check if specific tokens are tradeable
   */
  async verifyTokens(symbols: string[]): Promise<Record<string, boolean>> {
    const tokens = await this.listTokens();
    const result: Record<string, boolean> = {};
    
    for (const symbol of symbols) {
      const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      result[symbol] = token?.tradeable || false;
    }
    
    return result;
  }
}

export default BankrClient;
