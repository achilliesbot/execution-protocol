/**
 * TwitterSource.ts
 *
 * Phase 2: Twitter/X sentiment signal source
 *
 * Note: This is a placeholder implementation.
 * Real implementation requires X API v2 access with OAuth.
 *
 * For now: Simulates sentiment signals for testing.
 * When OAuth available: Replace with real Twitter API calls.
 */
/**
 * TwitterSentimentSource — Social sentiment signals
 *
 * Searches Twitter for crypto-related sentiment and generates signals.
 */
export class TwitterSentimentSource {
    constructor(config) {
        this.id = 'twitter_sentiment';
        this.name = 'Twitter Sentiment';
        this.weight = 0.8; // Slightly lower weight (social can be noisy)
        this.enabled = false; // Disabled until OAuth configured
        this.config = config;
        if (config?.bearerToken) {
            this.enabled = true;
        }
    }
    /**
     * Fetch signals from Twitter
     *
     * PLACEHOLDER: Returns simulated signals for testing.
     * REAL: Would call Twitter API v2 search endpoints.
     */
    async fetch() {
        if (!this.enabled || !this.config) {
            console.log('[TwitterSource] Disabled - no OAuth tokens');
            return [];
        }
        // TODO: Replace with real Twitter API v2 calls
        // const tweets = await this.searchTweets(this.config.searchQueries);
        // const sentiment = this.analyzeSentiment(tweets);
        // return this.generateSignals(sentiment);
        // Placeholder: Return empty (manual posting mode)
        return [];
    }
    /**
     * Validate Twitter-specific signal data
     */
    validate(signal) {
        // Twitter signals need mention count for weighting
        if (!signal.metadata?.socialMentions) {
            return false;
        }
        return true;
    }
    /**
     * Enable source with OAuth tokens
     */
    configure(config) {
        this.config = config;
        this.enabled = true;
        console.log('[TwitterSource] Configured and enabled');
    }
}
export const twitterSource = new TwitterSentimentSource();
