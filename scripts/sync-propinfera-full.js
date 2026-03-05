#!/usr/bin/env node
/**
 * PropInfera Full Metrics Sync
 * Pulls from Stripe (revenue) + MongoDB (usage)
 * Updates execution-protocol dashboard
 */

import { fetchStripeMetrics } from '../src/integrations/propinfera-stripe.js';
import { fetchMongoMetrics } from '../src/integrations/propinfera-mongodb.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('[' + new Date().toISOString() + '] Syncing PropInfera metrics...');

async function syncAllMetrics() {
  try {
    // Fetch from both sources
    const [stripeMetrics, mongoMetrics] = await Promise.all([
      fetchStripeMetrics(),
      fetchMongoMetrics()
    ]);
    
    // Read current snapshot
    const snapshotPath = join(process.cwd(), 'data', 'live', 'snapshot.json');
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
    
    // Update PropInfera section
    if (!snapshot.propinfera) {
      snapshot.propinfera = {};
    }
    
    snapshot.propinfera = {
      ...snapshot.propinfera,
      status: 'AUTONOMOUS_TAKEOVER_ACTIVE',
      stripe_metrics: stripeMetrics,
      mongo_metrics: mongoMetrics,
      mrr_total: stripeMetrics.mrr,
      mrr_stripe: stripeMetrics.mrr,
      mrr_onchain: 0,
      total_revenue: stripeMetrics.total_revenue,
      active_subscriptions: {
        total: stripeMetrics.active_subscriptions,
        free: mongoMetrics.users.free,
        pro: mongoMetrics.users.pro,
        elite: mongoMetrics.users.elite
      },
      users: mongoMetrics.users,
      deals: mongoMetrics.deals,
      last_updated: new Date().toISOString()
    };
    
    // Write back
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    
    console.log('✓ Metrics synced:');
    console.log('  Stripe:', stripeMetrics);
    console.log('  MongoDB:', mongoMetrics);
    
    return { stripe: stripeMetrics, mongo: mongoMetrics };
  } catch (error) {
    console.error('✗ Sync failed:', error);
    process.exit(1);
  }
}

syncAllMetrics();
