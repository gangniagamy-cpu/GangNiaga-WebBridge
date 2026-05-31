#!/bin/bash
# WSL Daemon Auto-Start + Extension Config Updater
# Run this from WSL to start daemon and auto-configure Chrome extension
# NOTE: Does NOT mutate source files — writes runtime config instead

set -e

DAEMON_DIR="/mnt/d/GangNiaga-WebBridge"
PIDFILE="/tmp/webbridge-daemon.pid"
LOGFILE="/tmp/webbridge-daemon.log"

# Dynamically locate Windows user profile home directory from WSL
WIN_USER_PROFILE=$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')
if [ -n "$WIN_USER_PROFILE" ]; then
  WIN_HOME=$(wslpath "$WIN_USER_PROFILE" 2>/dev/null)
else
  WIN_HOME="/mnt/c/Users/$USER"
fi

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

# ─── Write daemon URL config (no source mutation) ───
echo "🔧 Writing daemon URL config for extension discovery..."
cd "$DAEMON_DIR"

mkdir -p daemon/config
cat > daemon/config/daemon-url.json <<EOF
{
  "ws_url": "ws://${WIN_HOST_IP}:10087/ws",
  "http_url": "http://${WIN_HOST_IP}:10087",
  "wsl_ip": "${WSL_IP}",
  "win_host_ip": "${WIN_HOST_IP}"
}
EOF

echo "✅ Daemon URL config written (extension reads this at runtime)"

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
  echo "  Extension config written to daemon/config/daemon-url.json"
  echo "  Reload extension in chrome://extensions"
else
  echo "❌ Daemon failed to start. Check log: $LOGFILE"
  exit 1
fi
