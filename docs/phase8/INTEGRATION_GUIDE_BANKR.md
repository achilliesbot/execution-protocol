# Integration Guide — Bankr Skill

**For:** AI agents running on Bankr.bot  
**Purpose:** Integrate Execution Protocol validation into Bankr trading workflows  
**Prerequisites:** Bankr bot account, EP agent key

---

## Overview

This guide shows how to add **Execution Protocol validation** to your Bankr bot, ensuring every trade is policy-checked before execution.

**Why EP + Bankr?**
- Bankr provides **trade execution** on Base
- EP provides **policy validation** and **proof-of-risk-checking**
- Together: validated, auditable, deterministic trading

---

## Architecture

```
┌─────────────────┐
│  Signal Source  │  Twitter, on-chain, custom logic
│  (Your Agent)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     POST /ep/validate     ┌─────────────────┐
│   Your Logic    │ ─────────────────────────> │  Execution      │
│  (Evaluate      │    OpportunityProposal     │  Protocol       │
│   Opportunity)  │                            │  (Validation)   │
└────────┬────────┘                            └────────┬────────┘
         │                                              │
         │         VerificationResult                    │
         │         (valid? risk_score? violations?)      │
         │<──────────────────────────────────────────────┘
         │
         ▼ (if valid)
┌─────────────────┐
│   Bankr Client  │  Execute trade via Bankr.bot
│  (Settlement)   │  (Only if EP validation passed)
└─────────────────┘
```

---

## Quick Integration (Copy-Paste)

### Step 1: Install Dependencies

```bash
npm install axios dotenv
```

### Step 2: Environment Variables

Create `.env`:

```bash
# Execution Protocol
EP_BASE_URL=https://api.execution-protocol.ai
EP_AGENT_KEY=your_ep_agent_key_here

# Bankr
BANKR_API_KEY=your_bankr_api_key_here
BANKR_BASE_URL=https://api.bankr.bot
```

### Step 3: EP Validation Module

Create `ep-client.js`:

```javascript
const axios = require('axios');

const EP_BASE_URL = process.env.EP_BASE_URL;
const EP_AGENT_KEY = process.env.EP_AGENT_KEY;

/**
 * Validate a trade proposal through Execution Protocol
 */
async function validateTrade(proposal) {
  try {
    const response = await axios.post(
      `${EP_BASE_URL}/ep/validate`,
      proposal,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': EP_AGENT_KEY
        },
        timeout: 5000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response) {
      // EP returned an error response
      throw new Error(`EP validation failed: ${error.response.data.error || error.message}`);
    }
    // Network or other error
    throw new Error(`EP request failed: ${error.message}`);
  }
}

/**
 * Check if a validation result passes all constraints
 */
function isValid(result) {
  return result.valid === true && result.violations.length === 0;
}

/**
 * Format risk score for logging
 */
function formatRisk(result) {
  const emoji = {
    'LOW': '🟢',
    'MEDIUM': '🟡',
    'HIGH': '🟠',
    'CRITICAL': '🔴'
  };
  return `${emoji[result.risk_score] || '⚪'} ${result.risk_score}`;
}

module.exports = {
  validateTrade,
  isValid,
  formatRisk
};
```

### Step 4: Bankr Integration

Create `bankr-client.js`:

```javascript
const axios = require('axios');

const BANKR_BASE_URL = process.env.BANKR_BASE_URL;
const BANKR_API_KEY = process.env.BANKR_API_KEY;

/**
 * Execute a trade via Bankr (only call this AFTER EP validation)
 */
async function executeTrade(tradeParams) {
  const {
    asset,
    direction,
    amount,
    entryPrice,
    stopLoss,
    takeProfit
  } = tradeParams;
  
  try {
    const response = await axios.post(
      `${BANKR_BASE_URL}/v1/trade`,
      {
        token: asset,
        side: direction,  // 'buy' or 'sell'
        amount: amount.toString(),
        slippage: '0.5',  // 0.5%
        // Optional: add stop loss / take profit if Bankr supports
      },
      {
        headers: {
          'Authorization': `Bearer ${BANKR_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return {
      success: true,
      jobId: response.data.job_id,
      txHash: response.data.tx_hash,
      status: response.data.status
    };
  } catch (error) {
    throw new Error(`Bankr execution failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Check trade status
 */
async function getTradeStatus(jobId) {
  const response = await axios.get(
    `${BANKR_BASE_URL}/v1/trade/${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${BANKR_API_KEY}`
      }
    }
  );
  
  return response.data;
}

module.exports = {
  executeTrade,
  getTradeStatus
};
```

### Step 5: Combined Trading Logic

Create `trading-bot.js`:

```javascript
require('dotenv').config();
const { validateTrade, isValid, formatRisk } = require('./ep-client');
const { executeTrade, getTradeStatus } = require('./bankr-client');

/**
 * Main trading function: EP validation + Bankr execution
 */
async function processTradeOpportunity(opportunity) {
  console.log(`\n🎯 Processing opportunity: ${opportunity.asset} ${opportunity.direction}`);
  
  // Step 1: Build EP proposal
  const proposal = {
    proposal_id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    asset: opportunity.asset,
    direction: opportunity.direction,
    amount_usd: opportunity.amount,
    entry_price: opportunity.entryPrice,
    stop_loss: opportunity.stopLoss,
    take_profit: opportunity.takeProfit,
    leverage: 1,  // Conservative default
    rationale: opportunity.rationale || `Bankr trade for ${opportunity.asset}`,
    agent_id: 'bankr_trader_bot',
    policy_set_id: 'olympus-v1'
  };
  
  // Step 2: Validate with EP
  console.log('🔍 Validating with Execution Protocol...');
  let validationResult;
  
  try {
    validationResult = await validateTrade(proposal);
  } catch (error) {
    console.error(`❌ EP validation error: ${error.message}`);
    return { executed: false, reason: 'validation_error', error: error.message };
  }
  
  console.log(`   Result: ${validationResult.valid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`   Risk: ${formatRisk(validationResult)}`);
  console.log(`   Proof: ${validationResult.proof_hash}`);
  
  // Log violations if any
  if (validationResult.violations.length > 0) {
    console.log('   Violations:');
    validationResult.violations.forEach(v => {
      console.log(`     - ${v.type}: ${v.message}`);
    });
  }
  
  // Step 3: Check if valid
  if (!isValid(validationResult)) {
    console.log('🛑 Trade blocked by policy. Not executing.');
    return {
      executed: false,
      reason: 'policy_violation',
      violations: validationResult.violations,
      proof_hash: validationResult.proof_hash
    };
  }
  
  // Step 4: Execute via Bankr (only if EP validation passed)
  console.log('💰 Executing via Bankr...');
  
  try {
    const execution = await executeTrade({
      asset: opportunity.asset,
      direction: opportunity.direction,
      amount: opportunity.amount,
      entryPrice: opportunity.entryPrice,
      stopLoss: opportunity.stopLoss,
      takeProfit: opportunity.takeProfit
    });
    
    console.log(`✅ Trade executed! Job ID: ${execution.jobId}`);
    
    return {
      executed: true,
      proof_hash: validationResult.proof_hash,
      bankr_job_id: execution.jobId,
      tx_hash: execution.txHash,
      validation: validationResult
    };
    
  } catch (error) {
    console.error(`❌ Bankr execution failed: ${error.message}`);
    
    // Note: EP validation passed, but execution failed
    // This is a settlement failure, not a validation failure
    return {
      executed: false,
      reason: 'execution_failed',
      proof_hash: validationResult.proof_hash,  // Still have proof of validation
      error: error.message
    };
  }
}

// Example usage
async function main() {
  const opportunity = {
    asset: 'BNKR',
    direction: 'buy',
    amount: 50,
    entryPrice: 0.042,
    stopLoss: 0.038,
    takeProfit: 0.05,
    rationale: 'Test trade with EP validation'
  };
  
  const result = await processTradeOpportunity(opportunity);
  console.log('\n📊 Final Result:', JSON.stringify(result, null, 2));
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processTradeOpportunity };
```

### Step 6: Run It

```bash
node trading-bot.js
```

---

## Bankr Skill Prompt Directive

Add this to your Bankr bot's system prompt:

```
You are a trading agent integrated with Execution Protocol (EP).

BEFORE executing any trade:
1. Call POST /ep/validate with an OpportunityProposal
2. Check the VerificationResult:
   - If valid === true AND violations === []: proceed with trade
   - If valid === false OR violations.length > 0: reject trade and explain why
3. Log the proof_hash for every validation (success or failure)
4. Only call Bankr execution APIs if EP validation passed

Policy constraints (olympus-v1):
- Allowed assets: BNKR, ETH, USDC
- Max position: $100 per trade
- Max leverage: 1x (no leverage)
- Stop loss required: true
- Take profit required: true

Your job is to find opportunities, validate them through EP, and only execute if validation passes.
```

---

## Free Tier Integration

EP's free tier provides:
- ✅ Full validation logic
- ✅ Risk scoring (LOW/MEDIUM/HIGH/CRITICAL)
- ✅ Violation details
- ✅ Proof hash
- ⚠️ Coarse output (no detailed plan summary in free tier)

**For Bankr bots:** Free tier is sufficient for basic policy enforcement.

---

## Error Handling

### EP Validation Errors

```javascript
// Network error
if (error.code === 'ECONNABORTED') {
  // EP timeout — retry once, then fail closed
  return { executed: false, reason: 'ep_timeout' };
}

// 401 Unauthorized
if (error.response?.status === 401) {
  // Agent key invalid — notify operator
  return { executed: false, reason: 'auth_failed' };
}

// 429 Rate Limited
if (error.response?.status === 429) {
  // Backoff and retry
  await sleep(60000);
  return processTradeOpportunity(opportunity);  // Retry
}
```

### Bankr Execution Errors

```javascript
// If EP passed but Bankr failed
try {
  const execution = await executeTrade(tradeParams);
} catch (error) {
  // Log for manual review
  // EP proof_hash is still valid — we tried to execute a valid trade
  await logFailedExecution({
    proof_hash: validationResult.proof_hash,
    bankr_error: error.message,
    timestamp: new Date().toISOString()
  });
}
```

---

## Testing

### Dry Run Mode (No Real Trades)

```javascript
// Set environment
process.env.EP_MODE = 'DRY_RUN';  // Won't execute, just validate

// Run bot
const result = await processTradeOpportunity(testOpportunity);
console.log('Validation passed:', result.executed === false && result.reason === 'dry_run');
```

### Integration Test

```javascript
const assert = require('assert');

async function testIntegration() {
  // Test 1: Valid proposal should pass
  const valid = await validateTrade({
    proposal_id: 'prop_test_1',
    session_id: 'sess_test_1',
    asset: 'BNKR',
    direction: 'buy',
    amount_usd: 50,
    entry_price: 0.042,
    stop_loss: 0.038,
    take_profit: 0.05,
    leverage: 1,
    rationale: 'Test',
    agent_id: 'test_bot',
    policy_set_id: 'olympus-v1'
  });
  
  assert(valid.valid === true, 'Valid proposal should pass');
  assert(valid.violations.length === 0, 'Valid proposal should have no violations');
  assert(valid.proof_hash, 'Should have proof hash');
  
  // Test 2: Oversized position should fail
  const invalid = await validateTrade({
    ...validProposal,
    amount_usd: 999999,  // Way over limit
    proposal_id: 'prop_test_2'
  });
  
  assert(invalid.valid === false, 'Invalid proposal should fail');
  assert(invalid.violations.some(v => v.type === 'position_oversized'), 'Should have position size violation');
  
  console.log('✅ All tests passed');
}
```

---

## Production Checklist

Before deploying your Bankr + EP integration:

- [ ] **EP agent key** obtained and stored securely
- [ ] **Bankr API key** obtained and stored securely
- [ ] **Environment variables** configured (no hardcoded keys)
- [ ] **Error handling** implemented for all EP error cases
- [ ] **Rate limiting** respected (implement backoff)
- [ ] **Proof hashes logged** for audit trail
- [ ] **Dry run testing** completed
- [ ] **Policy alignment** verified (assets, limits match your strategy)
- [ ] **Monitoring** in place (alert on repeated violations)

---

## Support

- **EP Issues:** Contact EP operator
- **Bankr Issues:** Contact Bankr support
- **Integration Questions:** See [API Quickstart](API_QUICKSTART.md)

---

**Trade safe. Validate first. Execute second.**
