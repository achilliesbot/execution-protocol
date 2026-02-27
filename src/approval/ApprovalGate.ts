/**
 * Approval Gate - Capital safety protocol
 * 
 * Integrates with DECISIONS/APPROVALS ledgers
 * Deterministic approval token validation
 */

import * as fs from 'fs';
import * as path from 'path';

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

export class ApprovalGate {
  private decisionsPath: string;
  private approvalsPath: string;

  constructor() {
    this.decisionsPath = '/data/.openclaw/workspace/ledgers/DECISIONS.ndjson';
    this.approvalsPath = '/data/.openclaw/workspace/ledgers/APPROVALS.ndjson';
  }

  /**
   * Request approval for capital deployment
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    // Check if auto-approval allowed (small amounts in simulation)
    if (request.capitalAtRisk <= 10 && !request.decisionId) {
      return {
        approved: true,
        autoApproved: true,
        timestamp: Date.now(),
        reason: 'Auto-approved: simulation mode, amount below threshold'
      };
    }

    // Check for existing approval in ledger
    if (request.decisionId) {
      const approved = await this.checkLedgerApproval(request.decisionId);
      if (approved) {
        return {
          approved: true,
          token: `APPROVED:${request.decisionId}`,
          approver: 'LEDGER',
          timestamp: Date.now()
        };
      }
    }

    // Generate approval token request
    const nonce = this.generateNonce();
    const token = `APPROVE:${request.workflowId || 'WF_EXEC'}:${request.decisionId || 'D_NEW'}:${nonce}`;

    console.log(`[ApprovalGate] Approval required: ${token}`);
    console.log(`[ApprovalGate] Capital at risk: $${request.capitalAtRisk}`);

    // In Phase 1 with simulation: auto-approve after logging
    // In Phase 2+: Wait for Commander token
    return {
      approved: true, // Phase 1: auto-approve in simulation
      token,
      autoApproved: true,
      timestamp: Date.now(),
      reason: 'Phase 1 simulation: auto-approved with token logged'
    };
  }

  /**
   * Validate approval token format (deterministic)
   */
  validateToken(token: string): boolean {
    // Format: APPROVE:<workflow_id>:<decision_id>:<nonce>
    const pattern = /^APPROVE:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9]{6,}$/;
    return pattern.test(token);
  }

  /**
   * Check if decision already approved in ledger
   */
  private async checkLedgerApproval(decisionId: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.approvalsPath)) {
        return false;
      }

      const content = fs.readFileSync(this.approvalsPath, 'utf8');
      const approvals = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      return approvals.some(a => a.decision_id === decisionId);
    } catch {
      return false;
    }
  }

  /**
   * Record approval in ledger
   */
  async recordApproval(decisionId: string, token: string): Promise<void> {
    const approval = {
      decision_id: decisionId,
      token,
      timestamp: new Date().toISOString(),
      approved: true
    };

    fs.appendFileSync(this.approvalsPath, JSON.stringify(approval) + '\n');
    console.log(`[ApprovalGate] Approval recorded: ${decisionId}`);
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}

export default ApprovalGate;
