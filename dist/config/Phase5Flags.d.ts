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
export declare const PHASE5_FEATURES: {
    /**
     * ERC-8004 attestation on-chain integration
     * Default: false (stub mode only)
     */
    ATTESTATION_ENABLED: boolean;
    /**
     * Fee accounting and persistence
     * Default: false (dry-run only)
     */
    FEE_ACCOUNTING_ENABLED: boolean;
    /**
     * Allowed networks for attestation
     * Default: none
     */
    ATTESTATION_NETWORK: string;
    /**
     * Hard gas limit per transaction
     * Default: 100000
     */
    MAX_GAS_PER_TX: number;
    /**
     * Daily fee accrual cap (in fee units)
     * Default: 10000
     */
    DAILY_FEE_ACCRUAL_CAP: number;
};
/**
 * Valid attestation networks
 */
export declare const VALID_ATTESTATION_NETWORKS: readonly ["none", "devnet", "testnet"];
/**
 * Type for valid networks
 */
export type AttestationNetwork = typeof VALID_ATTESTATION_NETWORKS[number];
/**
 * Check if attestation is enabled and configured
 */
export declare function isAttestationEnabled(): boolean;
/**
 * Check if fee accounting is enabled
 */
export declare function isFeeAccountingEnabled(): boolean;
/**
 * Validate Phase 5 configuration
 * Throws if configuration is invalid or unsafe
 */
export declare function validatePhase5Config(): void;
/**
 * Emergency kill switch
 * Disables all Phase 5 features immediately
 */
export declare function killSwitchPhase5(): void;
//# sourceMappingURL=Phase5Flags.d.ts.map