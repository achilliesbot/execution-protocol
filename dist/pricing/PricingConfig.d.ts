/**
 * Pricing Configuration — Execution Protocol v2
 *
 * Versioned pricing config with drift control.
 * No in-place edits — new versions require new files.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
/**
 * Pricing tier definition
 */
export interface PricingTier {
    name: string;
    min_weight: number;
    max_weight: number;
    unit_rate: number;
}
/**
 * Pricing configuration
 */
export interface PricingConfig {
    version: string;
    effective_date: string;
    tiers: PricingTier[];
    base_fee: number;
    currency: 'EXEC' | 'USDC' | 'ETH';
    metadata: {
        description: string;
        change_reason?: string;
        previous_version?: string;
    };
}
/**
 * Pricing hash entry for STATE.json
 */
export interface PricingHash {
    version: string;
    pricing_hash: string;
    effective_date: string;
}
/**
 * Default pricing config (v1.0.0)
 */
export declare const DEFAULT_PRICING: PricingConfig;
/**
 * Load pricing config from versioned file
 */
export declare function loadPricingConfig(version?: string): PricingConfig;
/**
 * Compute pricing hash for drift detection
 */
export declare function computePricingHash(config: PricingConfig): string;
/**
 * Get current pricing hash entry
 */
export declare function getCurrentPricingHash(version?: string): PricingHash;
/**
 * Validate pricing config integrity
 */
export declare function validatePricingConfig(config: PricingConfig): boolean;
/**
 * Calculate billable units from execution weight
 */
export declare function calculateBillableUnits(executionWeight: number, config?: PricingConfig): {
    tier: string;
    billable_units: number;
};
/**
 * Save pricing config (creates new version file)
 */
export declare function savePricingConfig(config: PricingConfig): void;
//# sourceMappingURL=PricingConfig.d.ts.map