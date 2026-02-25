/**
 * On-Chain Client — Execution Protocol v2
 *
 * Sandboxed RPC client for ERC-8004 attestation.
 * Devnet/testnet only. Mainnet blocked.
 *
 * Phase 5 Activation — Network Layer (Sandboxed)
 */
/**
 * On-chain attestation request
 */
export interface OnChainAttestationRequest {
    transcript_hash: string;
    session_id: string;
    metadata: string;
}
/**
 * On-chain attestation response
 */
export interface OnChainAttestationResponse {
    transaction_hash: string | null;
    block_number: number | null;
    gas_used: number | null;
    status: 'pending' | 'confirmed' | 'failed';
    error?: string;
}
/**
 * Submit attestation on-chain (SANDBOXED)
 *
 * SAFETY RULES:
 * 1. Only executes if ENABLE_ATTESTATION=true
 * 2. Only connects to devnet/testnet (mainnet blocked)
 * 3. Respects MAX_GAS_PER_TX limit
 * 4. Returns error if any safety check fails
 */
export declare function submitAttestationOnChain(request: OnChainAttestationRequest): Promise<OnChainAttestationResponse>;
/**
 * Poll attestation status on-chain (SANDBOXED)
 */
export declare function pollAttestationStatus(transactionHash: string): Promise<OnChainAttestationResponse>;
/**
 * Verify attestation on-chain (SANDBOXED)
 */
export declare function verifyAttestationOnChain(attestationId: string): Promise<boolean>;
/**
 * Get RPC endpoint for current network
 */
export declare function getRpcEndpoint(): string | null;
/**
 * Get attestation contract address for current network
 */
export declare function getAttestationContract(): string | null;
/**
 * Check if client is ready for on-chain operations
 */
export declare function isClientReady(): boolean;
//# sourceMappingURL=OnChainClient.d.ts.map