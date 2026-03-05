/**
 * MongoDB Integration for PropInfera Metrics
 * Pulls user counts, deal analytics, activity data
 * Updates execution-protocol dashboard
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export async function fetchMongoMetrics() {
  if (!MONGODB_URI) {
    console.error('[MongoDB] URI not configured');
    return getDefaultMetrics();
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('propinfera');
    
    // Get users collection
    const users = db.collection('users');
    const totalUsers = await users.countDocuments();
    const usersToday = await users.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Get deals/property analyses
    const properties = db.collection('properties');
    const totalDeals = await properties.countDocuments();
    const dealsToday = await properties.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const dealsWeek = await properties.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const dealsMonth = await properties.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    // Get subscription tiers (if stored in user docs)
    const freeUsers = await users.countDocuments({ subscriptionTier: 'free' });
    const proUsers = await users.countDocuments({ subscriptionTier: 'pro' });
    const eliteUsers = await users.countDocuments({ subscriptionTier: 'elite' });
    
    return {
      users: {
        total: totalUsers,
        today: usersToday,
        free: freeUsers,
        pro: proUsers,
        elite: eliteUsers
      },
      deals: {
        total: totalDeals,
        today: dealsToday,
        week: dealsWeek,
        month: dealsMonth
      },
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error('[MongoDB] Error fetching metrics:', error);
    return getDefaultMetrics();
  } finally {
    await client.close();
  }
}

function getDefaultMetrics() {
  return {
    users: { total: 0, today: 0, free: 0, pro: 0, elite: 0 },
    deals: { total: 0, today: 0, week: 0, month: 0 },
    last_updated: new Date().toISOString()
  };
}

export async function updatePropInferaMongoMetrics() {
  const metrics = await fetchMongoMetrics();
  console.log('[PropInfera] MongoDB Metrics:', metrics);
  return metrics;
}
