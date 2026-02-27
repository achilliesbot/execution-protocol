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
import { SignalSource, Signal } from '../SignalEngine';
export interface TwitterConfig {
    apiKey: string;
    apiSecret: string;
    bearerToken: string;
    searchQueries: string[];
}
/**
 * TwitterSentimentSource — Social sentiment signals
 *
 * Searches Twitter for crypto-related sentiment and generates signals.
 */
export declare class TwitterSentimentSource implements SignalSource {
    id: string;
    name: string;
    weight: number;
    enabled: boolean;
    private config?;
    constructor(config?: TwitterConfig);
    /**
     * Fetch signals from Twitter
     *
     * PLACEHOLDER: Returns simulated signals for testing.
     * REAL: Would call Twitter API v2 search endpoints.
     */
    fetch(): Promise<Signal[]>;
    /**
     * Validate Twitter-specific signal data
     */
    validate(signal: Signal): boolean;
    /**
     * Enable source with OAuth tokens
     */
    configure(config: TwitterConfig): void;
}
export declare const twitterSource: TwitterSentimentSource;
//# sourceMappingURL=TwitterSource.d.ts.map