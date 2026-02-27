/**
 * Phase 2 Policy Set — DRY-RUN Configuration
 * 
 * Capital: $200
 * Allowed Assets: $BNKR, $CLAWD, $BNKRW only
 * Max Single Position: $40
 * Stop Loss: REQUIRED
 * Take Profit: REQUIRED
 */

export interface PolicyConstraint {
  type: 'max_position' | 'stop_loss_required' | 'take_profit_required' | 'allowed_assets' | 'max_leverage' | 'daily_loss_limit';
  value: any;
  hard: boolean; // If true, cannot be overridden
}

export interface PolicySet {
  phase: string;
  capital_total: number;
  capital_available: number;
  constraints: PolicyConstraint[];
  allowed_assets: string[];
  max_single_position: number;
  stop_loss_required: boolean;
  take_profit_required: boolean;
  daily_loss_limit: number;
  max_leverage: number;
  max_slippage: number;
  max_open_positions: number;
  autonomy_threshold: number; // Below this, auto-execute; above, require approval
}

export const PHASE2_POLICY_SET: PolicySet = {
  phase: 'phase2-dry-run',
  capital_total: 200,
  capital_available: 200,
  constraints: [
    { type: 'max_position', value: 40, hard: true },
    { type: 'stop_loss_required', value: true, hard: true },
    { type: 'take_profit_required', value: true, hard: true },
    { type: 'allowed_assets', value: ['BNKR', 'CLAWD', 'BNKRW'], hard: true },
    { type: 'max_leverage', value: 2, hard: true },
    { type: 'daily_loss_limit', value: 20, hard: true },
  ],
  allowed_assets: ['BNKR', 'CLAWD', 'BNKRW'],
  max_single_position: 40,
  stop_loss_required: true,
  take_profit_required: true,
  daily_loss_limit: 20,
  max_leverage: 2,
  max_slippage: 1, // 1%
  max_open_positions: 3,
  autonomy_threshold: 20, // $20 and above requires approval
};

export function validateAgainstPolicy(
  proposal: {
    asset: string;
    direction: 'LONG' | 'SHORT';
    amount: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
  },
  policy: PolicySet = PHASE2_POLICY_SET
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check allowed assets
  if (!policy.allowed_assets.includes(proposal.asset)) {
    errors.push(`Asset $${proposal.asset} not in allowed list: ${policy.allowed_assets.join(', ')}`);
  }

  // Check max position
  if (proposal.amount > policy.max_single_position) {
    errors.push(`Position $${proposal.amount} exceeds max $${policy.max_single_position}`);
  }

  // Check total capital
  if (proposal.amount > policy.capital_available) {
    errors.push(`Position $${proposal.amount} exceeds available capital $${policy.capital_available}`);
  }

  // Check stop loss
  if (policy.stop_loss_required && proposal.stopLoss === undefined) {
    errors.push('Stop loss required but not provided');
  }

  // Check take profit
  if (policy.take_profit_required && proposal.takeProfit === undefined) {
    errors.push('Take profit required but not provided');
  }

  // Check leverage
  const leverage = proposal.leverage || 1;
  if (leverage > policy.max_leverage) {
    errors.push(`Leverage ${leverage}x exceeds max ${policy.max_leverage}x`);
  }

  // Check approval requirement
  if (proposal.amount >= policy.autonomy_threshold) {
    errors.push(`APPROVAL REQUIRED: Position $${proposal.amount} >= $${policy.autonomy_threshold} autonomy threshold`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default PHASE2_POLICY_SET;
