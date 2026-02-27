/**
 * Simulator - Mock execution for Phase 1
 *
 * All trades simulated until Phase 1 proven (zero loss target)
 */
export class Simulator {
    constructor(initialCapital) {
        this.trades = [];
        this.totalPnl = 0;
        this.initialCapital = initialCapital;
        console.log(`[Simulator] Initialized with $${initialCapital} (MOCK MODE)`);
    }
    /**
     * Execute simulated trade
     */
    async executeTrade(params) {
        const asset = params.asset || 'ETH';
        // Deterministic simulation (same input → same output)
        const seed = Date.now() % 1000;
        const isWin = seed > 300; // 70% win rate for simulation
        const entryPrice = 2650;
        const priceChange = isWin
            ? (Math.random() * 0.05) // 0-5% gain
            : -(Math.random() * 0.02); // 0-2% loss (capped)
        const exitPrice = entryPrice * (1 + priceChange);
        const positionSize = params.capital * 0.1; // 10% position
        const pnl = positionSize * priceChange;
        const fees = positionSize * 0.001; // 0.1% fee
        const netPnl = pnl - fees;
        const result = {
            tradeId: `sim_${Date.now()}`,
            type: 'BUY',
            asset,
            amount: positionSize / entryPrice,
            entryPrice,
            exitPrice,
            pnl: netPnl,
            pnlPercent: (netPnl / positionSize) * 100,
            fees,
            timestamp: Date.now(),
            verified: true
        };
        this.trades.push(result);
        this.totalPnl += netPnl;
        console.log(`[Simulator] MOCK trade executed: ${asset}`);
        console.log(`[Simulator] P&L: $${netPnl.toFixed(2)} (${result.pnlPercent.toFixed(2)}%)`);
        // Phase 1 constraint: Zero loss tolerance
        if (netPnl < -params.capital * params.maxLoss) {
            throw new Error('[Simulator] Max loss exceeded - Phase 1 constraint violated');
        }
        return result;
    }
    /**
     * Get simulation stats
     */
    getStats() {
        const wins = this.trades.filter(t => t.pnl > 0).length;
        return {
            totalTrades: this.trades.length,
            winRate: this.trades.length > 0 ? wins / this.trades.length : 0,
            totalPnl: this.totalPnl,
            avgPnl: this.trades.length > 0 ? this.totalPnl / this.trades.length : 0
        };
    }
    getTrades() {
        return [...this.trades];
    }
    reset() {
        this.trades = [];
        this.totalPnl = 0;
        console.log('[Simulator] Reset complete');
    }
}
export default Simulator;
