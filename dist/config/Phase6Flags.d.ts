/**
 * Phase 6 Feature Flags — Execution Protocol v2
 *
 * Monetization rails. All settlement modes behind one interface.
 * Default: ALL FEATURES DISABLED
 */
export interface Phase6Config {
    ENABLE_MONETIZATION: boolean;
    SETTLEMENT_MODE: 'null' | 'offchain' | 'onchain' | 'hybrid' | null;
    SETTLEMENT_SIMULATE: boolean;
    ALLOW_MAINNET: boolean;
}
/**
 * Global Phase 6 configuration
 * Modify ONLY via environment variables
 */
export declare const PHASE6_FEATURES: Phase6Config;
/**
 * Valid settlement modes
 */
export declare const VALID_SETTLEMENT_MODES: readonly ["null", "offchain", "onchain", "hybrid"];
/**
 * Check if monetization is enabled
 */
export declare function isMonetizationEnabled(): boolean;
/**
 * Check if settlement is enabled
 */
export declare function isSettlementEnabled(): boolean;
/**
 * Check if in simulation mode
 */
export declare function isSimulationMode(): boolean;
/**
 * Check if mainnet is allowed (should always be false in Phase 6)
 */
export declare function isMainnetAllowed(): boolean;
/**
 * Validate Phase 6 configuration
 */
export declare function validatePhase6Config(): void;
/**
 * Emergency kill switch for Phase 6
 */
export declare function killSwitchPhase6(): void;
//# sourceMappingURL=Phase6Flags.d.ts.map