# Twitter/X API v2 Integration

**Status:** ✅ IMPLEMENTED
**Date:** 2026-02-27
**Location:** `src/signals/sources/TwitterSource.ts`

## Overview

Live social sentiment signals from Twitter/X API v2. Replaces placeholder implementation with real API calls.

## Credentials (Environment)

```bash
X_BEARER_TOKEN=AAAAAAAA...     # App-level bearer token (required)
X_API_KEY=ApLX7KR...           # API Key
X_API_SECRET=mV4LcPz...        # API Secret  
X_ACCESS_TOKEN=1769769...      # User access token
X_ACCESS_TOKEN_SECRET=n5ix6o... # Access token secret
```

## API Structure

**Base URL:** `https://api.twitter.com/2`

**Endpoints Used:**
- `GET /tweets/search/recent` — Search recent tweets

**Auth:** `Authorization: Bearer {X_BEARER_TOKEN}`

## Features

### 1. Live Tweet Search
- Searches multiple queries: `$BNKR`, `$CLAWD`, `$BNKRW`, crypto/defi keywords
- Fetches up to 100 tweets per query
- Deduplicates across queries

### 2. Sentiment Analysis
- Keyword-based scoring (bullish/bearish/neutral)
- Weighted by engagement (likes + retweets×2)
- Token mention tracking ($TOKEN format)

### 3. Signal Generation
- Generates LONG signals when bullish ratio > 60%
- Generates SHORT signals when bearish ratio > 60%
- Minimum volume threshold: 50 tweets
- Confidence score based on sentiment ratio

### 4. Signal Format
```typescript
{
  id: 'twitter_bull_1234567890',
  source: 'twitter_sentiment',
  asset: 'BNKR',              // Top mentioned token
  direction: 'LONG' | 'SHORT',
  confidence: 0.75,           // 0-1 scale
  timestamp: 1234567890,
  entryPrice: 0,              // Filled by price feed
  stopLoss: 0,                // Calculated by risk engine
  takeProfit: 0,              // Calculated by risk engine
  metadata: {
    socialMentions: 150,
    sentimentScore: 0.75,
    topTokens: ['$BNKR', '$CLAWD'],
    sampleTweets: ['...']
  }
}
```

## Test File

`tests/twitter-integration-test.ts`

```bash
npm run build
node dist/tests/twitter-integration-test.js
```

## Implementation Notes

- **Rate Limits:** Twitter API v2 has rate limits (450 requests/15 min for recent search)
- **Fallback:** Returns empty array on API errors (doesn't crash signal pipeline)
- **Privacy:** No user data stored; only public tweet metrics analyzed

## TODOs Completed

- ✅ Replace placeholder with real Twitter API v2 calls
- ✅ Implement `searchTweets()` method
- ✅ Implement `analyzeSentiment()` method
- ✅ Implement `generateSignals()` method
- ✅ Environment-based credential loading
- ✅ Proper error handling

## Next Steps

1. Test with live API (verify rate limits)
2. Tune sentiment keywords for crypto accuracy
3. Consider ML-based sentiment for v2
