/**
 * SignalEngine.ts
 * 
 * Phase 2: Agent-agnostic signal aggregation
 * 
 * Design Principles:
 * - Plugin architecture: Any signal source can register
 * - No hardcoded dependencies: All sources injected
 * - Deterministic scoring: Same signals → Same score
 * - Security: All signals validated before processing
 */

export interface Signal {
  id: string;
  source: string;           // Plugin identifier
  asset: string;            // ETH, BTC, etc.
  direction: 'LONG' | 'SHORT';
  confidence: number;       // 0-1
  timestamp: number;
  
  // Risk parameters (REQUIRED for safety)
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  
  // Optional metadata
  metadata?: {
    socialMentions?: number;
    whaleMovements?: boolean;
    technicalScore?: number;
    timeframe?: string;
    [key: string]: any;     // Extensible for any agent
  };
}

export interface SignalSource {
  id: string;
  name: string;
  weight: number;           // Scoring weight
  enabled: boolean;
  
  // Required: All sources must implement
  fetch(): Promise<Signal[]>;
  validate(signal: Signal): boolean;
}

export interface ScoredSignal {
  signal: Signal;
  
  // Risk calculations
  riskRewardRatio: number;
  potentialLoss: number;    // Absolute dollar amount
  potentialGain: number;    // Absolute dollar amount
  
  // Scoring
  weightedConfidence: number;
  finalScore: number;       // Composite 0-1
  
  // Safety checks
  passesConstraints: boolean;
  rejectionReason?: string;
}

/**
 * SignalEngine — Plugin-based signal aggregation
 * 
 * Agents register their signal sources, engine aggregates deterministically.
 */
export class SignalEngine {
  private sources: Map<string, SignalSource> = new Map();
  private signals: Signal[] = [];
  private scoredSignals: ScoredSignal[] = [];
  
  // Safety constraints (non-negotiable)
  private readonly MIN_CONFIDENCE = 0.7;
  private readonly MIN_RISK_REWARD = 2.0;  // 1:2 minimum
  private readonly MAX_SIGNAL_AGE = 3600000; // 1 hour

  /**
   * Register a signal source plugin
   * 
   * Any agent can register their own source:
   * - Twitter sentiment
   * - Whale watching
   * - Technical analysis
   * - On-chain metrics
   * - Custom agent logic
   */
  registerSource(source: SignalSource): void {
    // Security: Validate source structure
    if (!source.id || !source.name || typeof source.weight !== 'number') {
      throw new Error(`Invalid signal source: ${source.id}`);
    }
    
    this.sources.set(source.id, source);
    console.log(`[SignalEngine] Registered source: ${source.name} (weight: ${source.weight})`);
  }

  /**
   * Fetch signals from all enabled sources
   */
  async fetchAllSignals(): Promise<Signal[]> {
    this.signals = [];
    
    const promises = Array.from(this.sources.values())
      .filter(s => s.enabled)
      .map(async source => {
        try {
          const signals = await source.fetch();
          
          // Security: Validate each signal
          const valid = signals.filter(s => this.validateSignal(s, source));
          
          console.log(`[SignalEngine] ${source.name}: ${valid.length}/${signals.length} signals valid`);
          return valid;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[SignalEngine] ${source.name} failed:`, errorMessage);
          return [];
        }
      });
    
    const results = await Promise.all(promises);
    this.signals = results.flat();
    
    return this.signals;
  }

  /**
   * Score all signals with deterministic algorithm
   */
  scoreSignals(): ScoredSignal[] {
    this.scoredSignals = this.signals.map(signal => {
      const source = this.sources.get(signal.source);
      const weight = source?.weight || 1.0;
      
      // Risk calculations
      const risk = Math.abs(signal.entryPrice - signal.stopLoss);
      const reward = Math.abs(signal.takeProfit - signal.entryPrice);
      const riskRewardRatio = reward / risk;
      
      // Confidence weighting
      let weightedConfidence = signal.confidence * weight;
      
      // Metadata bonuses (deterministic)
      if (signal.metadata?.whaleMovements) {
        weightedConfidence += 0.05;
      }
      if (signal.metadata?.technicalScore) {
        weightedConfidence = (weightedConfidence + signal.metadata.technicalScore) / 2;
      }
      
      // Cap confidence
      weightedConfidence = Math.min(weightedConfidence, 0.95);
      
      // Final composite score
      const finalScore = weightedConfidence * Math.min(riskRewardRatio / 3, 1.0);
      
      // Constraint checks
      const passesConstraints = this.checkConstraints(
        signal, 
        riskRewardRatio, 
        weightedConfidence
      );
      
      return {
        signal,
        riskRewardRatio,
        potentialLoss: risk,
        potentialGain: reward,
        weightedConfidence,
        finalScore,
        passesConstraints,
        rejectionReason: passesConstraints ? undefined : this.getRejectionReason(signal, riskRewardRatio)
      };
    });
    
    // Sort by final score descending
    this.scoredSignals.sort((a, b) => b.finalScore - a.finalScore);
    
    return this.scoredSignals;
  }

  /**
   * Get top N signals that pass constraints
   */
  getTopSignals(n: number): ScoredSignal[] {
    return this.scoredSignals
      .filter(s => s.passesConstraints)
      .slice(0, n);
  }

  /**
   * Security: Validate signal structure
   */
  private validateSignal(signal: Signal, source: SignalSource): boolean {
    // Required fields
    if (!signal.id || !signal.asset || !signal.direction) {
      return false;
    }
    
    // Price validation
    if (signal.entryPrice <= 0 || signal.stopLoss <= 0 || signal.takeProfit <= 0) {
      return false;
    }
    
    // Confidence range
    if (signal.confidence < 0 || signal.confidence > 1) {
      return false;
    }
    
    // Age check
    if (Date.now() - signal.timestamp > this.MAX_SIGNAL_AGE) {
      return false;
    }
    
    // Source-specific validation
    if (source.validate && !source.validate(signal)) {
      return false;
    }
    
    return true;
  }

  /**
   * Security: Check all constraints
   */
  private checkConstraints(
    signal: Signal, 
    riskRewardRatio: number,
    confidence: number
  ): boolean {
    if (confidence < this.MIN_CONFIDENCE) return false;
    if (riskRewardRatio < this.MIN_RISK_REWARD) return false;
    return true;
  }

  private getRejectionReason(signal: Signal, riskReward: number): string {
    if (signal.confidence < this.MIN_CONFIDENCE) {
      return `Confidence ${signal.confidence} < ${this.MIN_CONFIDENCE}`;
    }
    if (riskReward < this.MIN_RISK_REWARD) {
      return `Risk:Reward ${riskReward.toFixed(2)} < ${this.MIN_RISK_REWARD}`;
    }
    return 'Unknown constraint violation';
  }

  getStats(): { sources: number; signals: number; valid: number } {
    return {
      sources: this.sources.size,
      signals: this.signals.length,
      valid: this.scoredSignals.filter(s => s.passesConstraints).length
    };
  }
}

export const signalEngine = new SignalEngine();