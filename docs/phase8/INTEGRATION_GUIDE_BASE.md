# Integration Guide — Base Official Skills

**For:** Developers building Base ecosystem agents  
**Purpose:** Integrate Execution Protocol as an official Base skill  
**Prerequisites:** Base developer account, EP agent key, Base Pay (optional)

---

## Overview

This guide explains how to integrate Execution Protocol as an **official Base skill**, enabling any Base agent to validate trades through EP before settlement.

**Key Concepts:**
- **Base Skills:** Reusable agent capabilities in the Base ecosystem
- **Execution Protocol:** Policy validation layer for trade proposals
- **Base Pay:** Optional payment rail for premium EP features

---

## Base Skill Structure

A Base skill follows this structure:

```
skill-execution-protocol/
├── skill.json          # Skill manifest
├── icon.png            # 256x256 icon
├── README.md           # Public documentation
├── src/
│   ├── index.ts        # Main entry point
│   ├── validate.ts     # EP validation logic
│   └── schemas.ts      # TypeScript types
├── tests/
│   └── validate.test.ts
└── examples/
    └── basic-usage.ts
```

---

## Skill Manifest

Create `skill.json`:

```json
{
  "name": "execution-protocol",
  "version": "1.0.0",
  "description": "Deterministic policy validation for trading agents. Validate every opportunity before execution.",
  "author": "Achilles Labs",
  "license": "MIT",
  "keywords": ["trading", "validation", "policy", "risk", "audit"],
  "entrypoint": "src/index.ts",
  "base_pay": {
    "enabled": true,
    "tiers": [
      {
        "name": "free",
        "description": "Basic validation with coarse output",
        "price": 0
      },
      {
        "name": "standard",
        "description": "Full validation with detailed output",
        "price": 0.001
      },
      {
        "name": "premium",
        "description": "Validation + simulation + multi-envelope",
        "price": 0.005
      }
    ]
  },
  "endpoints": {
    "validate": {
      "method": "POST",
      "path": "/ep/validate",
      "description": "Validate a trade proposal against policy"
    }
  },
  "schemas": {
    "opportunity_proposal": "https://execution-protocol.base.io/schemas/opportunity-proposal.v1.json",
    "verification_result": "https://execution-protocol.base.io/schemas/verification-result.v1.json"
  }
}
```

---

## TypeScript Types

Create `src/schemas.ts`:

```typescript
/**
 * Execution Protocol v1.0 TypeScript Types
 * For Base skill integration
 */

export type Direction = 'buy' | 'sell';
export type RiskScore = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PricingVersion = 'free-v1' | 'standard-v1' | 'premium-v1';

export interface OpportunityProposal {
  proposal_id: string;
  session_id: string;
  asset: string;
  direction: Direction;
  amount_usd: number;
  entry_price: number;
  leverage?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  rationale?: string | null;
  agent_id: string;
  policy_set_id: string;
  metadata?: Record<string, unknown>;
}

export interface Violation {
  type: string;
  field: string;
  constraint: string;
  actual: unknown;
  limit: unknown;
  message: string;
}

export interface VerificationResult {
  valid: boolean;
  risk_score: RiskScore;
  violations: Violation[];
  proof_hash: string;
  plan_summary: string;
  policy_set_hash: string;
  session_id: string | null;
  timestamp: string;
  pricing_version: PricingVersion;
  payment_receipt: string | null;
  base_pay_ready: boolean;
}

export interface ValidationConfig {
  epBaseUrl: string;
  agentKey: string;
  defaultPolicySetId: string;
}
```

---

## Core Validation Module

Create `src/validate.ts`:

```typescript
import { OpportunityProposal, VerificationResult, ValidationConfig } from './schemas';

const DEFAULT_CONFIG: Partial<ValidationConfig> = {
  epBaseUrl: 'https://execution-protocol.base.io',
  defaultPolicySetId: 'base-v1'
};

/**
 * Validate a trade proposal through Execution Protocol
 */
export async function validateProposal(
  proposal: OpportunityProposal,
  config: ValidationConfig
): Promise<VerificationResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const response = await fetch(`${mergedConfig.epBaseUrl}/ep/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Key': mergedConfig.agentKey
    },
    body: JSON.stringify(proposal)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`EP validation failed: ${error.message || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Check if a proposal is valid (convenience function)
 */
export function isValid(result: VerificationResult): boolean {
  return result.valid === true && result.violations.length === 0;
}

/**
 * Build a proposal with sensible defaults
 */
export function buildProposal(
  params: Omit<OpportunityProposal, 'proposal_id' | 'session_id'>,
  config: ValidationConfig
): OpportunityProposal {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  
  return {
    proposal_id: `prop_${timestamp}_${random}`,
    session_id: `sess_${timestamp}_${random}`,
    leverage: 1,
    stop_loss: null,
    take_profit: null,
    rationale: null,
    ...params,
    policy_set_id: params.policy_set_id || config.defaultPolicySetId
  };
}
```

---

## Base Pay Integration

Create `src/payment.ts`:

```typescript
import { VerificationResult } from './schemas';

/**
 * Check if a verification result supports Base Pay settlement
 */
export function isBasePayReady(result: VerificationResult): boolean {
  return result.base_pay_ready === true;
}

/**
 * Get the appropriate Base Pay tier for a validation
 */
export function getPayTier(result: VerificationResult): 'free' | 'standard' | 'premium' {
  switch (result.pricing_version) {
    case 'premium-v1':
      return 'premium';
    case 'standard-v1':
      return 'standard';
    case 'free-v1':
    default:
      return 'free';
  }
}

/**
 * Calculate Base Pay amount for a verification
 */
export function calculatePayAmount(result: VerificationResult): bigint {
  const tier = getPayTier(result);
  
  // Prices in wei (ETH)
  const PRICES = {
    free: 0n,
    standard: 1000000000000000n,  // 0.001 ETH
    premium: 5000000000000000n     // 0.005 ETH
  };
  
  return PRICES[tier];
}
```

---

## Main Entry Point

Create `src/index.ts`:

```typescript
/**
 * Execution Protocol Skill for Base
 * 
 * Provides deterministic policy validation for trading agents.
 */

export {
  validateProposal,
  isValid,
  buildProposal
} from './validate';

export {
  isBasePayReady,
  getPayTier,
  calculatePayAmount
} from './payment';

export type {
  OpportunityProposal,
  VerificationResult,
  Violation,
  RiskScore,
  Direction,
  PricingVersion,
  ValidationConfig
} from './schemas';

// Skill metadata
export const SKILL_NAME = 'execution-protocol';
export const SKILL_VERSION = '1.0.0';
export const SKILL_DESCRIPTION = 'Deterministic policy validation for trading agents';
```

---

## Usage Example

Create `examples/basic-usage.ts`:

```typescript
import {
  validateProposal,
  isValid,
  buildProposal,
  isBasePayReady,
  ValidationConfig
} from '../src';

const config: ValidationConfig = {
  epBaseUrl: 'https://execution-protocol.base.io',
  agentKey: process.env.EP_AGENT_KEY!,
  defaultPolicySetId: 'base-v1'
};

async function main() {
  // Step 1: Build proposal
  const proposal = buildProposal({
    asset: 'USDC',
    direction: 'buy',
    amount_usd: 100,
    entry_price: 1.0,
    stop_loss: 0.95,
    take_profit: 1.1,
    rationale: 'Stablecoin accumulation strategy',
    agent_id: 'base_trader_001'
  }, config);
  
  console.log('Proposal:', proposal);
  
  // Step 2: Validate
  const result = await validateProposal(proposal, config);
  
  console.log('Validation Result:');
  console.log('  Valid:', result.valid);
  console.log('  Risk:', result.risk_score);
  console.log('  Proof:', result.proof_hash);
  
  // Step 3: Check validity
  if (isValid(result)) {
    console.log('✅ Trade is valid! Proceed with execution.');
    
    // Step 4: Check Base Pay eligibility
    if (isBasePayReady(result)) {
      console.log('💰 Base Pay ready — can settle on Base');
    }
  } else {
    console.log('❌ Trade blocked by policy:');
    result.violations.forEach(v => {
      console.log(`   - ${v.type}: ${v.message}`);
    });
  }
}

main().catch(console.error);
```

---

## Base Agent Prompt Directive

Add this to Base agent system prompts:

```
You have access to the Execution Protocol skill for trade validation.

Before executing any trade:
1. Build an OpportunityProposal with:
   - proposal_id: unique ID (prop_{timestamp}_{random})
   - session_id: unique session ID
   - asset: token symbol (e.g., "USDC", "ETH")
   - direction: "buy" or "sell"
   - amount_usd: position size in USD
   - entry_price: current or proposed entry price
   - stop_loss: price at which to exit if trade goes against you
   - take_profit: price at which to exit for profit
   - agent_id: your agent identifier
   - policy_set_id: "base-v1" (default)

2. Call execution_protocol.validateProposal()

3. Check the VerificationResult:
   - If valid === true: proceed with trade execution
   - If valid === false: reject trade and report violations

4. Log the proof_hash for audit purposes

Policy constraints (base-v1):
- Max position: $500 per trade
- Stop loss required: true
- Take profit required: true
- Allowed assets: USDC, ETH, cbBTC, BASE

You MUST validate through EP before executing any trade.
```

---

## Testing

Create `tests/validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateProposal, isValid, buildProposal } from '../src';
import { ValidationConfig } from '../src/schemas';

const TEST_CONFIG: ValidationConfig = {
  epBaseUrl: 'http://localhost:3000',
  agentKey: 'test_key',
  defaultPolicySetId: 'test-v1'
};

describe('Execution Protocol Skill', () => {
  it('should build a valid proposal', () => {
    const proposal = buildProposal({
      asset: 'USDC',
      direction: 'buy',
      amount_usd: 100,
      entry_price: 1.0,
      agent_id: 'test_agent'
    }, TEST_CONFIG);
    
    expect(proposal.proposal_id).toMatch(/^prop_\d+_[a-z0-9]+$/);
    expect(proposal.session_id).toMatch(/^sess_\d+_[a-z0-9]+$/);
    expect(proposal.policy_set_id).toBe('test-v1');
  });
  
  it('should validate a proposal (integration)', async () => {
    const proposal = buildProposal({
      asset: 'USDC',
      direction: 'buy',
      amount_usd: 50,
      entry_price: 1.0,
      stop_loss: 0.95,
      take_profit: 1.1,
      agent_id: 'test_agent'
    }, TEST_CONFIG);
    
    const result = await validateProposal(proposal, TEST_CONFIG);
    
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('risk_score');
    expect(result).toHaveProperty('proof_hash');
    expect(result.violations).toBeInstanceOf(Array);
  });
  
  it('should detect valid results', () => {
    const validResult = {
      valid: true,
      violations: [],
      // ... other fields
    } as any;
    
    expect(isValid(validResult)).toBe(true);
  });
  
  it('should detect invalid results', () => {
    const invalidResult = {
      valid: false,
      violations: [{ type: 'test', message: 'Test violation' }],
      // ... other fields
    } as any;
    
    expect(isValid(invalidResult)).toBe(false);
  });
});
```

---

## Deployment to Base Skills Repo

### 1. Package the Skill

```bash
npm run build
npm pack
```

### 2. Submit to Base

Follow Base's skill submission process:

1. Fork `base/skills` repository
2. Add your skill to `skills/execution-protocol/`
3. Submit PR with:
   - `skill.json` manifest
   - Working examples
   - Test coverage
   - Documentation

### 3. Base Review Checklist

- [ ] No proprietary dependencies (EP is the only external API)
- [ ] `base_pay_ready` field implemented
- [ ] Base Pay pricing configured in `skill.json`
- [ ] Free tier works without payment
- [ ] Schema URLs are public and accessible
- [ ] TypeScript types exported
- [ ] Tests pass
- [ ] Example code runs

---

## Free Tier Requirements

Base skills must provide value without payment:

```typescript
// Free tier validation
const result = await validateProposal(proposal, {
  ...config,
  // No payment required for basic validation
});

// result.pricing_version will be "free-v1"
// All validation logic still runs
// Output may be coarser than paid tiers
```

**Free tier includes:**
- ✅ Full policy validation
- ✅ Risk scoring
- ✅ Violation details
- ✅ Proof hash
- ⚠️ Simplified plan summary

---

## Support

- **EP Documentation:** See [API Quickstart](API_QUICKSTART.md)
- **Base Skills:** See Base developer documentation
- **Integration Issues:** Contact EP operator

---

**Build safely on Base. Validate first.**
