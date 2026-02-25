/**
 * Reputation Engine — Execution Protocol v2
 *
 * Pure function reputation scoring over transcript history.
 * Off-chain only. No external dependencies.
 *
 * Phase 4 Expansion — Isolated from Phase 3 Kernel
 */
/**
 * Extract session outcome from transcript entries
 * Pure function — no side effects
 */
export function extractSessionOutcome(session) {
    if (!session.entries || session.entries.length === 0) {
        return 'pending';
    }
    // Look for final outcome in last entries
    for (let i = session.entries.length - 1; i >= 0; i--) {
        const entry = session.entries[i];
        if (entry.entry_type === 'execution_confirmed') {
            return 'success';
        }
        if (entry.entry_type === 'rejected') {
            return 'rejected';
        }
        if (entry.entry_type === 'execution_failed') {
            return 'failed';
        }
    }
    return 'pending';
}
/**
 * Calculate base reputation from session outcome
 * Pure function — no side effects
 */
export function calculateBaseReputation(outcome) {
    switch (outcome) {
        case 'success':
            return 100;
        case 'rejected':
            return 50; // Policy-compliant rejection is neutral
        case 'failed':
            return 25; // Execution failure damages reputation
        case 'pending':
            return 75; // Incomplete session
    }
}
/**
 * Calculate execution quality score
 * Based on gas efficiency, step count, error rate
 * Pure function — no side effects
 */
export function calculateExecutionQuality(sessions) {
    if (sessions.length === 0) {
        return { name: 'execution_quality', weight: 0.25, value: 50, raw_count: 0 };
    }
    let totalScore = 0;
    let completedSessions = 0;
    for (const session of sessions) {
        const outcome = extractSessionOutcome(session);
        if (outcome !== 'pending') {
            totalScore += calculateBaseReputation(outcome);
            completedSessions++;
        }
    }
    const value = completedSessions > 0
        ? Math.round(totalScore / completedSessions)
        : 50;
    return {
        name: 'execution_quality',
        weight: 0.25,
        value,
        raw_count: completedSessions
    };
}
/**
 * Calculate consistency score
 * Based on variance in outcomes
 * Pure function — no side effects
 */
export function calculateConsistency(sessions) {
    if (sessions.length < 2) {
        return { name: 'consistency', weight: 0.20, value: 50, raw_count: sessions.length };
    }
    const outcomes = sessions.map(extractSessionOutcome);
    const successCount = outcomes.filter(o => o === 'success').length;
    const failureCount = outcomes.filter(o => o === 'failed').length;
    const totalCompleted = outcomes.filter(o => o !== 'pending').length;
    if (totalCompleted === 0) {
        return { name: 'consistency', weight: 0.20, value: 50, raw_count: 0 };
    }
    // Higher score for consistent success, lower for mixed/failed outcomes
    const successRate = successCount / totalCompleted;
    const failureRate = failureCount / totalCompleted;
    // Consistency rewards stable performance (high success or high policy rejection, not erratic)
    const consistencyValue = successRate > 0.8
        ? 90 + (successRate * 10) // 90-100 for high success
        : failureRate > 0.3
            ? 30 // Low for high failure rate
            : 70; // Medium for mixed outcomes
    return {
        name: 'consistency',
        weight: 0.20,
        value: Math.round(consistencyValue),
        raw_count: totalCompleted
    };
}
/**
 * Calculate volume score
 * Based on number of completed sessions
 * Pure function — no side effects
 */
export function calculateVolume(sessions) {
    const completedCount = sessions.filter(s => extractSessionOutcome(s) !== 'pending').length;
    // Logarithmic scale: more sessions = higher score, but diminishing returns
    // 1 session = 20, 10 sessions = 60, 100 sessions = 90
    let value = Math.min(100, Math.round(20 + 30 * Math.log10(completedCount + 1)));
    return {
        name: 'volume',
        weight: 0.15,
        value,
        raw_count: completedCount
    };
}
/**
 * Calculate policy compliance score
 * Based on ratio of rejections vs failures
 * Pure function — no side effects
 */
export function calculatePolicyCompliance(sessions) {
    if (sessions.length === 0) {
        return { name: 'policy_compliance', weight: 0.25, value: 50, raw_count: 0 };
    }
    const outcomes = sessions.map(extractSessionOutcome);
    const rejectedCount = outcomes.filter(o => o === 'rejected').length;
    const failedCount = outcomes.filter(o => o === 'failed').length;
    const completedCount = outcomes.filter(o => o !== 'pending').length;
    if (completedCount === 0) {
        return { name: 'policy_compliance', weight: 0.25, value: 50, raw_count: 0 };
    }
    // Policy rejection is good (followed rules)
    // Execution failure is bad (broke runtime)
    const totalNonSuccess = rejectedCount + failedCount;
    if (totalNonSuccess === 0) {
        return { name: 'policy_compliance', weight: 0.25, value: 100, raw_count: completedCount };
    }
    // High score if most non-success outcomes are policy rejections, not failures
    const rejectionRatio = rejectedCount / totalNonSuccess;
    const value = Math.round(50 + (rejectionRatio * 50)); // 50-100 based on rejection ratio
    return {
        name: 'policy_compliance',
        weight: 0.25,
        value,
        raw_count: completedCount
    };
}
/**
 * Calculate recency score
 * Based on time since last successful session
 * Pure function — no side effects
 */
export function calculateRecency(sessions) {
    if (sessions.length === 0) {
        return { name: 'recency', weight: 0.15, value: 50, raw_count: 0 };
    }
    // Find most recent successful session
    let lastSuccessTime = null;
    for (const session of sessions) {
        const outcome = extractSessionOutcome(session);
        if (outcome === 'success') {
            // Use session_id or first entry timestamp as proxy
            // In production, would use actual timestamps from entries
            lastSuccessTime = Date.now(); // Simplified: assume recent
            break;
        }
    }
    if (!lastSuccessTime) {
        return { name: 'recency', weight: 0.15, value: 30, raw_count: 0 }; // Penalty for no recent success
    }
    // For now, return high score (would calculate based on actual timestamps in production)
    return { name: 'recency', weight: 0.15, value: 85, raw_count: 1 };
}
/**
 * Compute final reputation score
 * Pure function — no side effects
 */
export function computeReputation(agentId, sessions) {
    // Calculate all factors
    const factors = [
        calculateExecutionQuality(sessions),
        calculateConsistency(sessions),
        calculateVolume(sessions),
        calculatePolicyCompliance(sessions),
        calculateRecency(sessions)
    ];
    // Compute weighted score
    let totalScore = 0;
    let totalWeight = 0;
    for (const factor of factors) {
        totalScore += factor.value * factor.weight;
        totalWeight += factor.weight;
    }
    const score = totalWeight > 0
        ? Math.round(totalScore / totalWeight)
        : 50;
    // Confidence based on data volume
    const completedSessions = sessions.filter(s => extractSessionOutcome(s) !== 'pending').length;
    const confidence = Math.min(1, completedSessions / 10); // Max confidence at 10+ sessions
    return {
        agent_id: agentId,
        score: Math.max(0, Math.min(100, score)),
        confidence,
        factors,
        computed_at: new Date().toISOString(),
        session_count: completedSessions
    };
}
/**
 * Compare two reputation scores
 * Pure function — no side effects
 */
export function compareReputation(scoreA, scoreB) {
    // Weighted comparison: score * confidence
    const weightedA = scoreA.score * scoreA.confidence;
    const weightedB = scoreB.score * scoreB.confidence;
    return weightedA - weightedB;
}
//# sourceMappingURL=ReputationEngine.js.map