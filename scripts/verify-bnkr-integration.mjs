#!/usr/bin/env node

/**
 * Verify Bnkr.bot Integration
 *
 * Checks:
 * 1. API connection is live
 * 2. BNKR, CLAWD, BNKRW are tradeable assets
 */

import { BnkrClient } from '../dist/integrations/BnkrClient.js';
import { BnkrAdapter } from '../dist/integrations/BnkrAdapter.js';

async function main() {
  console.log('🔗 Bnkr.bot Integration Verification\n');

  // Verify env vars
  if (!process.env.BNKR_API_KEY) {
    console.error('❌ BNKR_API_KEY env var is not set');
    process.exit(1);
  }

  if (!process.env.BNKR_URL) {
    console.error('❌ BNKR_URL env var is not set');
    process.exit(1);
  }

  console.log('✓ Environment variables present');
  console.log(`  BNKR_URL: ${process.env.BNKR_URL}`);
  console.log(`  BNKR_API_KEY: ${process.env.BNKR_API_KEY.substring(0, 10)}...\n`);

  // 1) Health check
  console.log('1️⃣  Checking API connection...');
  const client = new BnkrClient();
  const health = await client.healthCheck();

  if (!health.ok) {
    console.error(`❌ Health check failed: ${health.message}`);
    process.exit(1);
  }
  console.log(`✓ ${health.message}\n`);

  // 2) Verify Phase 2 assets
  console.log('2️⃣  Verifying Phase 2 assets (BNKR, CLAWD, BNKRW)...');
  const adapter = new BnkrAdapter();
  const assetVerif = await adapter.verifyPhase2Assets();

  if (!assetVerif.ok) {
    console.error(`❌ Asset verification failed: ${assetVerif.message}`);
    console.error(`Assets: ${JSON.stringify(assetVerif.assets)}`);
    process.exit(1);
  }

  console.log(`✓ ${assetVerif.message}`);
  console.log(`  BNKR: ${assetVerif.assets.BNKR ? '✓ tradeable' : '✗ not tradeable'}`);
  console.log(`  CLAWD: ${assetVerif.assets.CLAWD ? '✓ tradeable' : '✗ not tradeable'}`);
  console.log(`  BNKRW: ${assetVerif.assets.BNKRW ? '✓ tradeable' : '✗ not tradeable'}\n`);

  // 3) Market data sample
  console.log('3️⃣  Sampling market data...');
  try {
    const bnkrMarket = await client.getMarketData('BNKR');
    console.log(`✓ BNKR market data:`);
    console.log(`  Price: $${bnkrMarket.price}`);
    console.log(`  Bid: $${bnkrMarket.bid}`);
    console.log(`  Ask: $${bnkrMarket.ask}`);
    console.log(`  Spread: ${bnkrMarket.spread_bps} bps\n`);
  } catch (err) {
    console.warn(`⚠️  Market data fetch failed (may be normal in test): ${err}\n`);
  }

  console.log('✅ Bnkr.bot integration verified successfully!');
  console.log('   - API connection: LIVE');
  console.log('   - Phase 2 assets (BNKR, CLAWD, BNKRW): TRADEABLE');
  console.log('\n   Ready for DRY_RUN → LIVE capital deployment.');
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
