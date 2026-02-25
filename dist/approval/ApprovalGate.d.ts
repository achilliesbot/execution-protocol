/**
 * Approval Gate - Capital safety protocol
 *
 * Integrates with DECISIONS/APPROVALS ledgers
 * Deterministic approval token validation
 */
export interface ApprovalRequest {
    sessionId: string;
    workflowId?: string;
    decisionId?: string;
    capitalAtRisk: number;
    nonce?: string;
}
export interface ApprovalResult {
    approved: boolean;
    token?: string;
    approver?: string;
    timestamp: number;
    autoApproved?: boolean;
    reason?: string;
}
export declare class ApprovalGate {
    private decisionsPath;
    private approvalsPath;
    constructor();
    /**
     * Request approval for capital deployment
     */
    requestApproval(request: ApprovalRequest): Promise<ApprovalResult>;
    /**
     * Validate approval token format (deterministic)
     */
    validateToken(token: string): boolean;
    /**
     * Check if decision already approved in ledger
     */
    private checkLedgerApproval;
    /**
     * Record approval in ledger
     */
    recordApproval(decisionId: string, token: string): Promise<void>;
    private generateNonce;
}
export default ApprovalGate;
//# sourceMappingURL=ApprovalGate.d.ts.map