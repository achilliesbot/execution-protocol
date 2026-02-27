/**
 * Cron Message Renderer — Execution Protocol v2
 *
 * Renders operational field reports from STATE.json
 * No hardcoded status strings — reads from unified state only.
 */
/**
 * Render field report from operational state
 */
export declare function renderFieldReport(statePath?: string): string;
/**
 * Render compact status for heartbeat checks
 */
export declare function renderCompactStatus(statePath?: string): string;
//# sourceMappingURL=CronMessageRenderer.d.ts.map