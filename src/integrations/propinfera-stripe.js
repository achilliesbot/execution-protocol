/**
 * Stripe Integration for PropInfera Metrics
 * Pulls MRR, subscriptions, revenue data
 * Updates execution-protocol dashboard
 */

const STRIPE_API_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
const STRIPE_API_URL = 'https://api.stripe.com/v1';

export async function fetchStripeMetrics() {
  try {
    // Fetch subscriptions
    const subsResponse = await fetch(`${STRIPE_API_URL}/subscriptions?status=active&limit=100`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!subsResponse.ok) {
      throw new Error(`Stripe API error: ${subsResponse.status}`);
    }

    const subscriptions = await subsResponse.json();
    
    // Calculate MRR from active subscriptions
    let mrr = 0;
    subscriptions.data.forEach((sub) => {
      if (sub.status === 'active' && sub.plan) {
        mrr += sub.plan.amount * (sub.plan.interval === 'month' ? 1 : 12) / 100;
      }
    });

    // Fetch total revenue from charges
    const chargesResponse = await fetch(`${STRIPE_API_URL}/charges?limit=100`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const charges = await chargesResponse.json();
    
    let totalRevenue = 0;
    charges.data.forEach((charge) => {
      if (charge.paid && !charge.refunded) {
        totalRevenue += charge.amount / 100;
      }
    });

    return {
      mrr: Math.round(mrr * 100) / 100,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      active_subscriptions: subscriptions.data.length,
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Stripe] Error fetching metrics:', error);
    return {
      mrr: 0,
      total_revenue: 0,
      active_subscriptions: 0,
      last_updated: new Date().toISOString()
    };
  }
}

export async function updatePropInferaMetrics() {
  const metrics = await fetchStripeMetrics();
  
  // In production: Write to snapshot.json
  // For now, return metrics
  console.log('[PropInfera] Metrics:', metrics);
  return metrics;
}
