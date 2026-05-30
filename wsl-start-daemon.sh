#!/bin/bash
# WSL Daemon Auto-Start + Extension Config Updater
# Run this from WSL to start daemon and auto-configure Chrome extension

set -e

DAEMON_DIR="/mnt/d/GangNiaga-WebBridge"
PIDFILE="/tmp/webbridge-daemon.pid"
LOGFILE="/tmp/webbridge-daemon.log"
WIN_HOME="/mnt/c/Users/megat"
DAEMON_INFO="$WIN_HOME/.hermes/webbridge-daemon.json"

# Get IPs
WSL_IP=$(hostname -I | awk '{print $1}')
WIN_HOST_IP=$(ip route show default | awk '{print $3}')

echo "🌐 WSL IP: $WSL_IP"
echo "🌐 Windows Host IP: $WIN_HOST_IP"

# ─── Kill existing daemon ───
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "🔄 Stopping existing daemon (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null
    sleep 2
  fi
  rm -f "$PIDFILE"
fi

# ─── Update extension config with correct IPs ───
echo "🔧 Updating extension config..."
cd "$DAEMON_DIR"

# Replace DAEMON_URLS in background.js with current IPs
sed -i "s|'ws://172.22.32.1:10087/ws'.*|'ws://${WIN_HOST_IP}:10087/ws',     // WSL2 Windows host gateway|" extension/background.js
sed -i "s|'ws://172.22.39.182:10087/ws'.*|'ws://${WSL_IP}:10087/ws',     // WSL2 current IP|" extension/background.js

echo "✅ Extension config updated"

# ─── Start daemon ───
echo "🚀 Starting WebBridge daemon..."
nohup node daemon/gangniaga-daemon.js > "$LOGFILE" 2>&1 &
DAEMON_PID=$!
echo $DAEMON_PID > "$PIDFILE"

sleep 3

# ─── Verify ───
if kill -0 "$DAEMON_PID" 2>/dev/null; then
  # Get API key
  API_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('daemon/.webbridge-auth.json','utf8')).apiKey)" 2>/dev/null || echo "auto-generated")

  # Write daemon info for Windows
  mkdir -p "$WIN_HOME/.hermes"
  cat > "$DAEMON_INFO" <<EOF
{
  "status": "running",
  "pid": $DAEMON_PID,
  "wsl_ip": "$WSL_IP",
  "win_host_ip": "$WIN_HOST_IP",
  "port": 10087,
  "url": "ws://${WSL_IP}:10087/ws",
  "windows_url": "ws://${WIN_HOST_IP}:10087/ws",
  "api_key": "$API_KEY",
  "log_file": "$LOGFILE"
}
EOF

  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ WebBridge Daemon RUNNING"
  echo "═══════════════════════════════════════════"
  echo "  PID:     $DAEMON_PID"
  echo "  WSL:     ws://${WSL_IP}:10087/ws"
  echo "  Windows: ws://${WIN_HOST_IP}:10087/ws"
  echo "  API Key: ${API_KEY:0:16}..."
  echo ""
  echo "  Chrome extension auto-configured."
  echo "  Reload extension in chrome://extensions"
  echo "  to connect to WSL daemon."
  echo "═══════════════════════════════════════════"
else
  echo "❌ Daemon failed to start"
  echo "Log: $LOGFILE"
  cat "$LOGFILE"
  exit 1
fi
