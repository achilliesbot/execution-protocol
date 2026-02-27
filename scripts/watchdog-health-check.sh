#!/bin/bash
# Achilles EC2 Watchdog Health Check
# Runs via cron every 2 minutes to ensure Achilles is responsive

LOG_FILE="/data/.openclaw/logs/watchdog-health.log"
GATEWAY_URL="http://127.0.0.1:18789"  # OpenClaw gateway port
MAX_RETRIES=3
RETRY_DELAY=5

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "$(date -Iseconds) $1" | tee -a "$LOG_FILE"
}

# Check if gateway is responding
check_health() {
  local retries=0
  while [ $retries -lt $MAX_RETRIES ]; do
    if curl -s -f "$GATEWAY_URL/health" > /dev/null 2>&1; then
      return 0
    fi
    retries=$((retries + 1))
    sleep $RETRY_DELAY
  done
  return 1
}

# Check if process is running
check_process() {
  pgrep -f "openclaw gateway" > /dev/null 2>&1
}

# Restart OpenClaw
restart_openclaw() {
  log "⚠️ Watchdog triggered - restarting OpenClaw"
  
  # Try graceful stop first
  openclaw gateway stop 2>/dev/null || true
  sleep 5
  
  # Kill any remaining processes
  pkill -f "openclaw gateway" 2>/dev/null || true
  sleep 2
  
  # Start fresh
  if openclaw gateway start 2>&1 | tee -a "$LOG_FILE"; then
    log "✅ OpenClaw restarted successfully"
    
    # Verify it's up
    sleep 5
    if check_health; then
      log "✅ Health check passed after restart"
      return 0
    else
      log "❌ Health check failed after restart"
      return 1
    fi
  else
    log "❌ Failed to start OpenClaw"
    return 1
  fi
}

# Main watchdog logic
main() {
  # First check - is process running?
  if ! check_process; then
    log "⚠️ OpenClaw process not found"
    restart_openclaw
    exit $?
  fi
  
  # Second check - is gateway responding?
  if ! check_health; then
    log "⚠️ Gateway not responding (process exists but unhealthy)"
    restart_openclaw
    exit $?
  fi
  
  # All checks passed
  log "✅ Achilles healthy"
  exit 0
}

main "$@"
