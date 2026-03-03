/**
 * Bankr API Live Verification Test
 * 
 * Validates:
 * 1. API is reachable
 * 2. Authentication works
 * 3. $BNKR, $CLAWD, $BNKRW are tradeable
 */

import { BankrClient } from '../src/bankr/index.js';

async function verifyBankrIntegration(): Promise<void> {
  console.log('🔍 Bankr.bot Integration Verification\n');

  try {
    // 1. Initialize client
    const client = new BankrClient();
    console.log('✅ Client initialized');

    // 2. Health check
    const health = await client.health();
    console.log(`✅ API Live: ${health.status} (v${health.version})`);

    // 3. List tokens
    const tokens = await client.listTokens();
    console.log(`✅ Listed ${tokens.length} tokens`);

    // 4. Verify required tokens
    const required = ['BNKR', 'CLAWD', 'BNKRW'];
    const verified = await client.verifyTokens(required);

    console.log('\n📊 Token Tradeability:');
    let allTradeable = true;
    for (const symbol of required) {
      const status = verified[symbol] ? '✅' : '❌';
      console.log(`  ${status} $${symbol}: ${verified[symbol] ? 'TRADEABLE' : 'NOT TRADEABLE'}`);
      if (!verified[symbol]) allTradeable = false;
    }

    // 5. Get quote (DRY-RUN test)
    console.log('\n💰 Testing Quote (DRY-RUN):');
    const quote = await client.getQuote({
      from: 'BNKR',
      to: 'CLAWD',
      amount: '100',
      slippage: 1.0,
    });
    console.log(`  ✅ Quote received: ${quote.amountIn} ${quote.from} → ${quote.amountOut} ${quote.to}`);
    console.log(`     Price: ${quote.price}, Slippage: ${quote.slippage}%`);

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTradeable) {
      console.log('✅ ALL CHECKS PASS - Ready for Phase 2 DRY-RUN');
    } else {
      console.log('⚠️  Some tokens not tradeable - review required');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  verifyBankrIntegration();
}

export { verifyBankrIntegration };
