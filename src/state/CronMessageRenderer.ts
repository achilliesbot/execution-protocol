/**
 * Cron Message Renderer — Execution Protocol v2
 * 
 * Renders operational field reports from STATE.json
 * No hardcoded status strings — reads from unified state only.
 */

import { readOperationalState, checkStateFreshness, OperationalState } from './OperationalState';

/**
 * Render agent status emoji
 */
function renderAgentStatus(status: string): string {
  switch (status) {
    case 'ACTIVE': return '🟢';
    case 'DORMANT': return '🔴';
    case 'ERROR': return '❌';
    default: return '⚪';
  }
}

/**
 * Render health status
 */
function renderHealthStatus(status: string): string {
  switch (status) {
    case 'HEALTHY': return '🟢 HEALTHY';
    case 'DEGRADED': return '🟡 DEGRADED';
    case 'CRITICAL': return '🔴 CRITICAL';
    default: return '⚪ UNKNOWN';
  }
}

/**
 * Format timestamp to HHMM EST
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'America/New_York',
    hour12: false 
  }) + ' EST';
}

/**
 * Render field report from operational state
 */
export function renderFieldReport(statePath: string = 'STATE.json'): string {
  const state = readOperationalState(statePath);
  const freshness = checkStateFreshness(state);
  const now = new Date();
  const timeStr = formatTime(now.toISOString());
  
  // Handle unavailable/stale states
  if (freshness === 'UNAVAILABLE') {
    return `❌ **STATE UNAVAILABLE** — ${timeStr}

No operational data found. STATE.json missing or >15m stale.

**Actions:**
• Check state writer process
• Verify STATE.json exists: ${statePath}
• Check dashboard for live status

**ACHILLES OUT.**`;
  }
  
  if (freshness === 'STALE') {
    const lastUpdated = state.runtime?.last_updated || 'unknown';
    return `⚠️ **STATE STALE** — ${timeStr}
Last update: ${lastUpdated}

**Last Known Status:**
• Health: ${renderHealthStatus(state.health?.status || 'UNKNOWN')}
• Build: ${state.build?.git_hash?.substring(0, 7) || 'unknown'}
• Sessions (24h): ${state.sessions?.count_24h || 0}

**Actions:**
• Investigate state writer
• Check dashboard for current status

**ACHILLES OUT.**`;
  }
  
  // Fresh state — render full report
  const agentLines = Object.entries(state.agents || {})
    .map(([name, status]) => `• ${name.charAt(0).toUpperCase() + name.slice(1)}: ${renderAgentStatus(status)} ${status}`)
    .join('\n');
  
  const alertSection = (state.alerts?.length || 0) > 0 
    ? `\n**ALERTS:**\n${state.alerts.map((a: string) => `• ${a}`).join('\n')}`
    : '';
  
  return `**FIELD REPORT — ACHILLES ORCHESTRATOR**
*${now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} | ${timeStr}*

**1. AGENT STATUS:**
${agentLines}

**2. MISSION PROGRESS:**
• Health: ${renderHealthStatus(state.health?.status || 'UNKNOWN')}
• Build: ${state.build?.git_hash?.substring(0, 7) || 'unknown'} | Uptime: ${Math.floor((state.runtime?.uptime_seconds || 0) / 3600)}h
• Policy: ${state.policy?.version || 'unknown'} (${state.policy?.active_set_hash?.substring(0, 7) || 'unknown'})

**3. SESSIONS:**
• Last: ${state.sessions?.last_session_id || 'none'} [${state.sessions?.last_session_status || 'N/A'}]
• 24h Count: ${state.sessions?.count_24h || 0} | Total: ${state.sessions?.count_total || 0}
• Transcript Head: ${state.sessions?.last_transcript_head_hash?.substring(0, 16) || 'N/A'}...${alertSection}

**ACHILLES OUT.**`;
}

/**
 * Render compact status for heartbeat checks
 */
export function renderCompactStatus(statePath: string = 'STATE.json'): string {
  const state = readOperationalState(statePath);
  const freshness = checkStateFreshness(state);
  
  if (freshness !== 'FRESH') {
    return `STATE ${freshness}: ${state.runtime?.last_updated || 'unknown'}`;
  }
  
  const activeAgents = Object.values(state.agents || {}).filter(s => s === 'ACTIVE').length;
  const totalAgents = Object.keys(state.agents || {}).length;
  
  return `${renderHealthStatus(state.health?.status || 'UNKNOWN')} | ${activeAgents}/${totalAgents} agents | ${state.sessions?.count_24h || 0} sessions (24h)`;
}

// CLI usage
if (require.main === module) {
  const statePath = process.argv[2] || 'STATE.json';
  console.log(renderFieldReport(statePath));
}
