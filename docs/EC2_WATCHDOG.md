# EC2 Watchdog Auto-Restart

**Status:** ✅ Code Complete (Ready for EC2 host installation)

## Purpose
Ensures Achilles comes back online automatically if EC2 instance stops and restarts.

## Components

### 1. Systemd Service (`achilles-watchdog.service`)
- **Location:** `scripts/achilles-watchdog.service`
- **What it does:** Runs OpenClaw gateway as a managed service
- **Restart policy:** Always restart on failure, 10s delay, max 3 bursts per minute
- **Auto-start:** Enabled on boot

### 2. Health Check Script (`watchdog-health-check.sh`)
- **Location:** `scripts/watchdog-health-check.sh`
- **Runs:** Every 2 minutes via cron
- **Checks:**
  1. Is OpenClaw process running?
  2. Is gateway responding on port 18789?
- **Action:** Auto-restart if either check fails

### 3. Install Script (`install-watchdog.sh`)
- **Location:** `scripts/install-watchdog.sh`
- **Usage:** `sudo ./install-watchdog.sh`

## Installation (On EC2 Host - Not Container)

```bash
# SSH to EC2 instance
ssh -i your-key.pem user@your-ec2-ip

# Navigate to scripts
cd /data/.openclaw/workspace/achilliesbot/execution-protocol/scripts

# Run installer as root
sudo ./install-watchdog.sh
```

## Verification

```bash
# Check service status
systemctl status achilles-watchdog

# View logs
journalctl -u achilles-watchdog -f

# Check health check logs
tail -f /data/.openclaw/logs/watchdog-health.log

# Test restart behavior
sudo systemctl restart achilles-watchdog
```

## Files Created

| File | Purpose |
|------|---------|
| `scripts/achilles-watchdog.service` | Systemd service definition |
| `scripts/watchdog-health-check.sh` | Health monitoring cron job |
| `scripts/install-watchdog.sh` | One-command installer |

## What Happens on EC2 Restart

1. Systemd starts `achilles-watchdog` service automatically
2. Service launches OpenClaw gateway
3. Cron health check runs every 2 minutes
4. If gateway becomes unresponsive → auto-restart triggers
5. Achilles back online within ~15 seconds of failure

## Manual Control

```bash
# Start
sudo systemctl start achilles-watchdog

# Stop
sudo systemctl stop achilles-watchdog

# Restart
sudo systemctl restart achilles-watchdog

# Disable auto-start
sudo systemctl disable achilles-watchdog
```
