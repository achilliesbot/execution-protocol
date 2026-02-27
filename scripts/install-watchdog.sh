#!/bin/bash
# Install EC2 Watchdog for Achilles Auto-Restart
# Run as root or with sudo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="achilles-watchdog"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CRON_JOB="*/2 * * * * /data/.openclaw/workspace/achilliesbot/execution-protocol/scripts/watchdog-health-check.sh"

echo "🔧 Installing Achilles EC2 Watchdog..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or with sudo"
  exit 1
fi

# Create log directory
mkdir -p /data/.openclaw/logs
chown -R node:node /data/.openclaw/logs

# Install systemd service
echo "📋 Installing systemd service..."
cp "${SCRIPT_DIR}/achilles-watchdog.service" "$SERVICE_FILE"

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable "$SERVICE_NAME"

# Start service now
if systemctl start "$SERVICE_NAME" 2>/dev/null; then
  echo "✅ Service started"
else
  echo "⚠️  Service start failed (may already be running or container environment)"
fi

# Install cron job for health checks
echo "⏰ Installing cron health check..."

# Remove any existing watchdog cron jobs
(crontab -u node -l 2>/dev/null | grep -v "watchdog-health-check" || true) > /tmp/node-crontab

# Add new cron job
echo "$CRON_JOB" >> /tmp/node-crontab
crontab -u node /tmp/node-crontab
rm /tmp/node-crontab

echo "✅ Cron job installed (runs every 2 minutes)"

# Verify installation
echo ""
echo "📊 Installation Summary:"
echo "  Service: $SERVICE_NAME"
echo "  Status: $(systemctl is-active $SERVICE_NAME 2>/dev/null || echo 'unknown')"
echo "  Enabled: $(systemctl is-enabled $SERVICE_NAME 2>/dev/null || echo 'unknown')"
echo "  Health Check: /data/.openclaw/workspace/achilliesbot/execution-protocol/scripts/watchdog-health-check.sh"
echo "  Logs: /data/.openclaw/logs/watchdog-health.log"
echo ""
echo "✅ EC2 Watchdog installed successfully"
echo ""
echo "Commands:"
echo "  systemctl status $SERVICE_NAME  - Check service status"
echo "  systemctl restart $SERVICE_NAME - Restart manually"
echo "  journalctl -u $SERVICE_NAME -f   - View logs"
