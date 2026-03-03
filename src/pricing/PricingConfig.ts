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
import { canonicalize, computeHash } from '../canonicalization';

/**
 * Pricing tier definition
 */
export interface PricingTier {
  name: string;
  min_weight: number;
  max_weight: number;
  unit_rate: number; // Fee units per execution weight unit
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
export const DEFAULT_PRICING: PricingConfig = {
  version: '1.0.0',
  effective_date: new Date().toISOString(),
  tiers: [
    { name: 'micro', min_weight: 0, max_weight: 100, unit_rate: 1.0 },
    { name: 'small', min_weight: 100, max_weight: 500, unit_rate: 0.9 },
    { name: 'medium', min_weight: 500, max_weight: 1000, unit_rate: 0.8 },
    { name: 'large', min_weight: 1000, max_weight: 5000, unit_rate: 0.7 },
    { name: 'enterprise', min_weight: 5000, max_weight: Number.MAX_SAFE_INTEGER, unit_rate: 0.5 }
  ],
  base_fee: 100,
  currency: 'EXEC',
  metadata: {
    description: 'Initial pricing for Phase 6 monetization',
    change_reason: 'Genesis pricing'
  }
};

/**
 * Minimal JSON-schema style validation helpers
 */
function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isNonNegativeFiniteNumber(x: unknown): x is number {
  return isFiniteNumber(x) && x >= 0;
}

function normalizeMaxWeight(maxWeight: unknown): number {
  // Disallow Infinity/NaN/null in persisted JSON; enforce sentinel.
  if (!isFiniteNumber(maxWeight)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return maxWeight;
}

/**
 * Parse + validate pricing config from JSON text.
 * Returns null on any schema violation.
 */
function parsePricingConfigJson(jsonText: string): PricingConfig | null {
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as any;

  if (typeof o.version !== 'string' || typeof o.effective_date !== 'string') return null;
  if (!Array.isArray(o.tiers) || o.tiers.length === 0) return null;
  if (!isNonNegativeFiniteNumber(o.base_fee)) return null;
  if (o.currency !== 'EXEC' && o.currency !== 'USDC' && o.currency !== 'ETH') return null;
  if (typeof o.metadata !== 'object' || o.metadata === null || typeof o.metadata.description !== 'string') return null;

  const tiers: PricingTier[] = [];
  for (const t of o.tiers) {
    if (typeof t !== 'object' || t === null) return null;
    if (typeof t.name !== 'string') return null;
    if (!isNonNegativeFiniteNumber(t.min_weight)) return null;
    if (!isNonNegativeFiniteNumber(t.unit_rate)) return null;

    const maxW = normalizeMaxWeight(t.max_weight);
    if (!isNonNegativeFiniteNumber(maxW)) return null;

    tiers.push({
      name: t.name,
      min_weight: t.min_weight,
      max_weight: maxW,
      unit_rate: t.unit_rate
    });
  }

  const cfg: PricingConfig = {
    version: o.version,
    effective_date: o.effective_date,
    tiers,
    base_fee: o.base_fee,
    currency: o.currency,
    metadata: {
      description: o.metadata.description,
      change_reason: typeof o.metadata.change_reason === 'string' ? o.metadata.change_reason : undefined,
      previous_version: typeof o.metadata.previous_version === 'string' ? o.metadata.previous_version : undefined
    }
  };

  return validatePricingConfig(cfg) ? cfg : null;
}

/**
 * Load pricing config from versioned file
 */
export function loadPricingConfig(version: string = '1.0.0'): PricingConfig {
  const configPath = path.join(__dirname, '../../pricing', `pricing.v${version}.json`);

  if (!fs.existsSync(configPath)) {
    console.warn(`Pricing config v${version} not found, using default`);
    return { ...DEFAULT_PRICING };
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const parsed = parsePricingConfigJson(content);

  if (!parsed) {
    console.warn(`Pricing config v${version} failed validation, using default`);
    return { ...DEFAULT_PRICING };
  }

  return parsed;
}

/**
 * Compute pricing hash for drift detection
 */
export function computePricingHash(config: PricingConfig): string {
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
export function getCurrentPricingHash(version?: string): PricingHash {
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
export function validatePricingConfig(config: PricingConfig): boolean {
  // Required fields
  if (!config.version || !config.effective_date) return false;

  // Tiers
  if (!Array.isArray(config.tiers) || config.tiers.length === 0) return false;

  // Base fee
  if (!Number.isFinite(config.base_fee) || config.base_fee < 0) return false;

  // Currency
  if (!['EXEC', 'USDC', 'ETH'].includes(config.currency)) return false;

  // Tier integrity
  let expectedMin = 0;
  for (const tier of config.tiers) {
    if (!Number.isFinite(tier.min_weight) || tier.min_weight < 0) return false;
    if (!Number.isFinite(tier.max_weight) || tier.max_weight < 0) return false;
    if (!Number.isFinite(tier.unit_rate) || tier.unit_rate < 0) return false;

    // Enforce continuity + monotonicity
    if (tier.min_weight !== expectedMin) return false;
    if (tier.max_weight <= tier.min_weight) return false;

    expectedMin = tier.max_weight;
  }

  return true;
}

/**
 * Calculate billable units from execution weight
 */
export function calculateBillableUnits(
  executionWeight: number,
  config: PricingConfig = loadPricingConfig()
): { tier: string; billable_units: number } {
  if (!Number.isFinite(executionWeight) || executionWeight < 0) {
    throw new Error('Invalid executionWeight: must be finite and >= 0');
  }
  if (!Array.isArray(config.tiers) || config.tiers.length === 0) {
    throw new Error('Invalid pricing config: tiers must be non-empty');
  }

  // Find matching tier
  const tier =
    config.tiers.find(t => executionWeight >= t.min_weight && executionWeight < t.max_weight) ||
    config.tiers[config.tiers.length - 1];

  // Calculate units: base_fee + (weight * unit_rate)
  const billableUnits = Math.round(config.base_fee + executionWeight * tier.unit_rate);

  if (!Number.isFinite(billableUnits) || billableUnits < 0) {
    throw new Error('Billing calculation produced invalid billable units');
  }

  return {
    tier: tier.name,
    billable_units: billableUnits
  };
}

/**
 * Save pricing config (creates new version file)
 */
export function savePricingConfig(config: PricingConfig): void {
  const pricingDir = path.join(__dirname, '../../pricing');
  
  if (!fs.existsSync(pricingDir)) {
    fs.mkdirSync(pricingDir, { recursive: true });
  }
  
  const configPath = path.join(pricingDir, `pricing.v${config.version}.json`);
  
  // Prevent overwriting existing config (drift control)
  if (fs.existsSync(configPath)) {
    throw new Error(
      `Pricing config v${config.version} already exists. ` +
      `Create new version instead of editing in-place.`
    );
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
