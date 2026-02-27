/**
 * Phase 6 Feature Flags — Execution Protocol v2
 *
 * Monetization rails. All settlement modes behind one interface.
 * Default: ALL FEATURES DISABLED
 */
/**
 * Global Phase 6 configuration
 * Modify ONLY via environment variables
 */
export const PHASE6_FEATURES = {
    /**
     * Global monetization kill switch
     * Default: false (Phase 5 behavior unchanged)
     */
    ENABLE_MONETIZATION: process.env.ENABLE_MONETIZATION === 'true',
    /**
     * Settlement mode
     * Default: null (no settlement)
     * Options: null, offchain, onchain, hybrid
     */
    SETTLEMENT_MODE: process.env.SETTLEMENT_MODE || null,
    /**
     * Simulation mode
     * Default: true (no real charges)
     * Must be explicitly set to false for live charging
     */
    SETTLEMENT_SIMULATE: process.env.SETTLEMENT_SIMULATE !== 'false',
    /**
     * Mainnet allowlist
     * Default: false (BLOCKED)
     * Must remain false in Phase 6
     */
    ALLOW_MAINNET: process.env.ALLOW_MAINNET === 'true'
};
/**
 * Valid settlement modes
 */
export const VALID_SETTLEMENT_MODES = ['null', 'offchain', 'onchain', 'hybrid'];
/**
 * Check if monetization is enabled
 */
export function isMonetizationEnabled() {
    return PHASE6_FEATURES.ENABLE_MONETIZATION;
}
/**
 * Check if settlement is enabled
 */
export function isSettlementEnabled() {
    return (PHASE6_FEATURES.ENABLE_MONETIZATION &&
        PHASE6_FEATURES.SETTLEMENT_MODE !== null &&
        VALID_SETTLEMENT_MODES.includes(PHASE6_FEATURES.SETTLEMENT_MODE));
}
/**
 * Check if in simulation mode
 */
export function isSimulationMode() {
    return PHASE6_FEATURES.SETTLEMENT_SIMULATE;
}
/**
 * Check if mainnet is allowed (should always be false in Phase 6)
 */
export function isMainnetAllowed() {
    return PHASE6_FEATURES.ALLOW_MAINNET;
}
/**
 * Validate Phase 6 configuration
 */
export function validatePhase6Config() {
    // Check settlement mode validity
    if (PHASE6_FEATURES.SETTLEMENT_MODE !== null) {
        if (!VALID_SETTLEMENT_MODES.includes(PHASE6_FEATURES.SETTLEMENT_MODE)) {
            throw new Error(`Invalid SETTLEMENT_MODE: ${PHASE6_FEATURES.SETTLEMENT_MODE}. ` +
                `Valid: ${VALID_SETTLEMENT_MODES.join(', ')}`);
        }
    }
    // Mainnet must be blocked in Phase 6
    if (PHASE6_FEATURES.ALLOW_MAINNET) {
        throw new Error('ALLOW_MAINNET=true is NOT permitted in Phase 6');
    }
    // Warn if monetization enabled without simulate mode
    if (PHASE6_FEATURES.ENABLE_MONETIZATION && !PHASE6_FEATURES.SETTLEMENT_SIMULATE) {
        console.warn('⚠️  WARNING: Monetization enabled with SETTLEMENT_SIMULATE=false');
        console.warn('   Live charging may occur. Ensure this is intentional.');
    }
    console.log('Phase 6 configuration validated:');
    console.log(`  ENABLE_MONETIZATION: ${PHASE6_FEATURES.ENABLE_MONETIZATION}`);
    console.log(`  SETTLEMENT_MODE: ${PHASE6_FEATURES.SETTLEMENT_MODE}`);
    console.log(`  SETTLEMENT_SIMULATE: ${PHASE6_FEATURES.SETTLEMENT_SIMULATE}`);
    console.log(`  ALLOW_MAINNET: ${PHASE6_FEATURES.ALLOW_MAINNET}`);
}
/**
 * Emergency kill switch for Phase 6
 */
export function killSwitchPhase6() {
    PHASE6_FEATURES.ENABLE_MONETIZATION = false;
    PHASE6_FEATURES.SETTLEMENT_MODE = null;
    PHASE6_FEATURES.SETTLEMENT_SIMULATE = true;
    console.error('🛑 PHASE 6 KILL SWITCH ACTIVATED');
    console.error('All monetization features disabled');
}
//# sourceMappingURL=Phase6Flags.js.map