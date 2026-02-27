/**
 * Pricing Configuration — Execution Protocol v2
 *
 * Versioned pricing config with drift control.
 * No in-place edits — new versions require new files.
 *
 * Phase 6 Monetization — Pluggable Settlement
 */
import * as fs from 'fs';
import * as path from 'path';
import { canonicalize, computeHash } from '../canonicalization/index.js';
/**
 * Default pricing config (v1.0.0)
 */
export const DEFAULT_PRICING = {
    version: '1.0.0',
    effective_date: new Date().toISOString(),
    tiers: [
        { name: 'micro', min_weight: 0, max_weight: 100, unit_rate: 1.0 },
        { name: 'small', min_weight: 100, max_weight: 500, unit_rate: 0.9 },
        { name: 'medium', min_weight: 500, max_weight: 1000, unit_rate: 0.8 },
        { name: 'large', min_weight: 1000, max_weight: 5000, unit_rate: 0.7 },
        { name: 'enterprise', min_weight: 5000, max_weight: Infinity, unit_rate: 0.5 }
    ],
    base_fee: 100,
    currency: 'EXEC',
    metadata: {
        description: 'Initial pricing for Phase 6 monetization',
        change_reason: 'Genesis pricing'
    }
};
/**
 * Load pricing config from versioned file
 */
export function loadPricingConfig(version = '1.0.0') {
    const configPath = path.join(__dirname, '../../pricing', `pricing.v${version}.json`);
    if (!fs.existsSync(configPath)) {
        console.warn(`Pricing config v${version} not found, using default`);
        return { ...DEFAULT_PRICING };
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}
/**
 * Compute pricing hash for drift detection
 */
export function computePricingHash(config) {
    // Canonicalize and hash the pricing config
    const canonical = canonicalize({
        version: config.version,
        tiers: config.tiers,
        base_fee: config.base_fee,
        currency: config.currency
        // Exclude metadata from hash (not part of pricing logic)
    });
    return computeHash(canonical);
}
/**
 * Get current pricing hash entry
 */
export function getCurrentPricingHash(version) {
    const config = loadPricingConfig(version);
    return {
        version: config.version,
        pricing_hash: computePricingHash(config),
        effective_date: config.effective_date
    };
}
/**
 * Validate pricing config integrity
 */
export function validatePricingConfig(config) {
    // Check required fields
    if (!config.version || !config.effective_date) {
        return false;
    }
    // Check tiers are valid
    if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
        return false;
    }
    // Check tier continuity
    let expectedMin = 0;
    for (const tier of config.tiers) {
        if (tier.min_weight !== expectedMin) {
            return false;
        }
        expectedMin = tier.max_weight;
    }
    // Check base fee is positive
    if (config.base_fee < 0) {
        return false;
    }
    // Check currency is valid
    if (!['EXEC', 'USDC', 'ETH'].includes(config.currency)) {
        return false;
    }
    return true;
}
/**
 * Calculate billable units from execution weight
 */
export function calculateBillableUnits(executionWeight, config = loadPricingConfig()) {
    // Find matching tier
    const tier = config.tiers.find(t => executionWeight >= t.min_weight && executionWeight < t.max_weight) || config.tiers[config.tiers.length - 1]; // Default to highest tier
    // Calculate units: base_fee + (weight * unit_rate)
    const billableUnits = Math.round(config.base_fee + (executionWeight * tier.unit_rate));
    return {
        tier: tier.name,
        billable_units: billableUnits
    };
}
/**
 * Save pricing config (creates new version file)
 */
export function savePricingConfig(config) {
    const pricingDir = path.join(__dirname, '../../pricing');
    if (!fs.existsSync(pricingDir)) {
        fs.mkdirSync(pricingDir, { recursive: true });
    }
    const configPath = path.join(pricingDir, `pricing.v${config.version}.json`);
    // Prevent overwriting existing config (drift control)
    if (fs.existsSync(configPath)) {
        throw new Error(`Pricing config v${config.version} already exists. ` +
            `Create new version instead of editing in-place.`);
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
