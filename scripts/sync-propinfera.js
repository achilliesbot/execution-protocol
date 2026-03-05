#!/usr/bin/env node
import { updatePropInferaMetrics } from '../src/integrations/propinfera-stripe.js';

console.log('[' + new Date().toISOString() + '] Syncing PropInfera metrics...');

updatePropInferaMetrics()
  .then(metrics => {
    console.log('✓ Metrics synced:', metrics);
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Sync failed:', err);
    process.exit(1);
  });
