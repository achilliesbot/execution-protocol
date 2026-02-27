/**
 * Phase 5 Feature Flags — Execution Protocol v2
 *
 * All Phase 5 features require explicit opt-in.
 * Default: ALL FEATURES DISABLED
 */
/**
 * Global Phase 5 safety configuration
 * Modify ONLY via environment variables or explicit config
 */
export const PHASE5_FEATURES = {
    /**
     * ERC-8004 attestation on-chain integration
     * Default: false (stub mode only)
     */
    ATTESTATION_ENABLED: process.env.ENABLE_ATTESTATION === 'true',
    /**
     * Fee accounting and persistence
     * Default: false (dry-run only)
     */
    FEE_ACCOUNTING_ENABLED: process.env.ENABLE_FEE_ACCOUNTING === 'true',
    /**
     * Allowed networks for attestation
     * Default: none
     */
    ATTESTATION_NETWORK: process.env.ATTESTATION_NETWORK || 'none',
    /**
     * Hard gas limit per transaction
     * Default: 100000
     */
    MAX_GAS_PER_TX: parseInt(process.env.MAX_GAS_PER_TX || '100000', 10),
    /**
     * Daily fee accrual cap (in fee units)
     * Default: 10000
     */
    DAILY_FEE_ACCRUAL_CAP: parseInt(process.env.DAILY_FEE_ACCRUAL_CAP || '10000', 10)
};
/**
 * Valid attestation networks
 */
export const VALID_ATTESTATION_NETWORKS = ['none', 'devnet', 'testnet'];
/**
 * Check if attestation is enabled and configured
 */
export function isAttestationEnabled() {
    return (PHASE5_FEATURES.ATTESTATION_ENABLED &&
        PHASE5_FEATURES.ATTESTATION_NETWORK !== 'none' &&
        VALID_ATTESTATION_NETWORKS.includes(PHASE5_FEATURES.ATTESTATION_NETWORK));
}
/**
 * Check if fee accounting is enabled
 */
export function isFeeAccountingEnabled() {
    return PHASE5_FEATURES.FEE_ACCOUNTING_ENABLED;
}
/**
 * Validate Phase 5 configuration
 * Throws if configuration is invalid or unsafe
 */
export function validatePhase5Config() {
    // Verify attestation network is valid
    if (PHASE5_FEATURES.ATTESTATION_NETWORK !== 'none') {
        if (!VALID_ATTESTATION_NETWORKS.includes(PHASE5_FEATURES.ATTESTATION_NETWORK)) {
            throw new Error(`Invalid ATTESTATION_NETWORK: ${PHASE5_FEATURES.ATTESTATION_NETWORK}. ` +
                `Valid options: ${VALID_ATTESTATION_NETWORKS.join(', ')}`);
        }
    }
    // Warn if mainnet detected (should never happen in Phase 5)
    if (PHASE5_FEATURES.ATTESTATION_NETWORK === 'mainnet') {
        throw new Error('Mainnet attestation is NOT allowed in Phase 5');
    }
    // Verify gas limits are reasonable
    if (PHASE5_FEATURES.MAX_GAS_PER_TX > 500000) {
        throw new Error('MAX_GAS_PER_TX exceeds safe limit for Phase 5');
    }
    console.log('Phase 5 configuration validated:');
    console.log(`  ATTESTATION_ENABLED: ${PHASE5_FEATURES.ATTESTATION_ENABLED}`);
    console.log(`  FEE_ACCOUNTING_ENABLED: ${PHASE5_FEATURES.FEE_ACCOUNTING_ENABLED}`);
    console.log(`  ATTESTATION_NETWORK: ${PHASE5_FEATURES.ATTESTATION_NETWORK}`);
}
/**
 * Emergency kill switch
 * Disables all Phase 5 features immediately
 */
export function killSwitchPhase5() {
    PHASE5_FEATURES.ATTESTATION_ENABLED = false;
    PHASE5_FEATURES.FEE_ACCOUNTING_ENABLED = false;
    PHASE5_FEATURES.ATTESTATION_NETWORK = 'none';
    console.error('🛑 PHASE 5 KILL SWITCH ACTIVATED');
    console.error('All Phase 5 features disabled');
}
//# sourceMappingURL=Phase5Flags.js.map