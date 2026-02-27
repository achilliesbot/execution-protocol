#!/usr/bin/env node
/**
 * Hourly Field Report Generator
 * 
 * Reads from STATE.json and outputs formatted field report.
 * Called by cron job every hour.
 */

const fs = require('fs');
const path = require('path');

const STATE_PATH = process.argv[2] || path.join(__dirname, '../../STATE.json');

function readState() {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      return null;
    }
    const content = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read STATE.json:', error.message);
    return null;
  }
}

function checkFreshness(state) {
  if (!state?.runtime?.last_updated) return 'UNAVAILABLE';
  
  const lastUpdated = new Date(state.runtime.last_updated).getTime();
  const now = Date.now();
  const ageMinutes = (now - lastUpdated) / 1000 / 60;
  
  if (ageMinutes < 5) return 'FRESH';
  if (ageMinutes < 15) return 'STALE';
  return 'UNAVAILABLE';
}

function renderAgentStatus(status) {
  const emojis = { ACTIVE: '🟢', DORMANT: '🔴', ERROR: '❌' };
  return emojis[status] || '⚪';
}

function renderHealthStatus(status) {
  const labels = { HEALTHY: '🟢 HEALTHY', DEGRADED: '🟡 DEGRADED', CRITICAL: '🔴 CRITICAL' };
  return labels[status] || '⚪ UNKNOWN';
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'America/New_York',
    hour12: false 
  }) + ' EST';
}

function renderReport() {
  const state = readState();
  const freshness = checkFreshness(state);
  const now = new Date();
  const timeStr = formatTime(now);
  const dateStr = now.toLocaleDateString('en-US', { 
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' 
  });
  
  if (freshness === 'UNAVAILABLE') {
    return `❌ **STATE UNAVAILABLE** — ${timeStr}

No operational data found. STATE.json missing or >15m stale.

**Actions:**
• Check state writer process
• Verify STATE.json exists
• Check dashboard for live status

**ACHILLES OUT.**`;
  }
  
  if (freshness === 'STALE') {
    return `⚠️ **STATE STALE** — ${timeStr}
Last update: ${state.runtime?.last_updated || 'unknown'}

**Last Known Status:**
• Health: ${renderHealthStatus(state.health?.status)}
• Build: ${state.build?.git_hash?.substring(0, 7) || 'unknown'}
• Sessions (24h): ${state.sessions?.count_24h || 0}

**Actions:**
• Investigate state writer
• Check dashboard for current status

**ACHILLES OUT.**`;
  }
  
  const agentLines = Object.entries(state.agents || {})
    .map(([name, status]) => `• ${name.charAt(0).toUpperCase() + name.slice(1)}: ${renderAgentStatus(status)} ${status}`)
    .join('\n');
  
  const alertSection = (state.alerts?.length || 0) > 0 
    ? `\n**ALERTS:**\n${state.alerts.map(a => `• ${a}`).join('\n')}`
    : '';
  
  return `**FIELD REPORT — ACHILLES ORCHESTRATOR**
*${dateStr} | ${timeStr}*

**1. AGENT STATUS:**
${agentLines}

**2. MISSION PROGRESS:**
• Health: ${renderHealthStatus(state.health?.status)}
• Build: ${state.build?.git_hash?.substring(0, 7) || 'unknown'} | Uptime: ${Math.floor((state.runtime?.uptime_seconds || 0) / 3600)}h
• Policy: ${state.policy?.version || 'unknown'}

**3. SESSIONS:**
• Last: ${state.sessions?.last_session_id || 'none'} [${state.sessions?.last_session_status || 'N/A'}]
• 24h Count: ${state.sessions?.count_24h || 0} | Total: ${state.sessions?.count_total || 0}
• Transcript Head: ${state.sessions?.last_transcript_head_hash?.substring(0, 16) || 'N/A'}...${alertSection}

**ACHILLES OUT.**`;
}

console.log(renderReport());
