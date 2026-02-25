/**
 * Simulator - Mock execution for Phase 1
 *
 * All trades simulated until Phase 1 proven (zero loss target)
 */
export interface SimulationResult {
    tradeId: string;
    type: 'BUY' | 'SELL';
    asset: string;
    amount: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    fees: number;
    timestamp: number;
    verified: boolean;
}
export declare class Simulator {
    private initialCapital;
    private trades;
    private totalPnl;
    constructor(initialCapital: number);
    /**
     * Execute simulated trade
     */
    executeTrade(params: {
        asset?: string;
        capital: number;
        maxLoss: number;
    }): Promise<SimulationResult>;
    /**
     * Get simulation stats
     */
    getStats(): {
        totalTrades: number;
        winRate: number;
        totalPnl: number;
        avgPnl: number;
    };
    getTrades(): SimulationResult[];
    reset(): void;
}
export default Simulator;
//# sourceMappingURL=Simulator.d.ts.map