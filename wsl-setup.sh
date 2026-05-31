#!/bin/bash

# WSL Setup for Hermes Agent
# One-time setup to enable all features from WSL

set -e

echo "🤖 GangNiaga Hermes Agent - WSL Setup"
echo "======================================"

# Check if WSL
if ! grep -qi microsoft /proc/version 2>/dev/null; then
  echo "⚠️  This script is designed for WSL. Running on Linux or WSL2?"
  echo "   Continue? (y/n)"
  read -r response
  [ "$response" != "y" ] && exit 1
fi

# Step 1: Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install it first:"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "   sudo apt-get install -y nodejs"
  exit 1
fi
echo "✅ Node.js: $(node --version)"

# Step 2: Copy .env from template
WSL_DIR="/mnt/d/GangNiaga-WebBridge"
cd "$WSL_DIR"

if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.wsl .env
  # Auto-populate API key from auth file
  if [ -f daemon/.webbridge-auth.json ]; then
    API_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('daemon/.webbridge-auth.json','utf8')).apiKey)" 2>/dev/null)
    if [ -n "$API_KEY" ]; then
      sed -i "s/your-api-key-here/$API_KEY/" .env
      echo "✅ API key auto-populated from auth file"
    fi
  fi
  echo "⚠️  Review .env and adjust if needed"
fi

# Step 3: Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Step 4: Test daemon connection
echo "🔗 Testing daemon connection..."
WIN_HOST_IP=$(ip route show default | awk '{print $3}')
if timeout 3 bash -c "echo > /dev/tcp/$WIN_HOST_IP/10087" 2>/dev/null; then
  echo "✅ Daemon is accessible via Windows IP ($WIN_HOST_IP)!"
elif timeout 3 bash -c "echo > /dev/tcp/localhost/10087" 2>/dev/null; then
  echo "✅ Daemon is accessible via localhost!"
else
  echo "⚠️  Daemon not running. Start it on Windows first:"
  echo "   cd D:\\GangNiaga-WebBridge && npm run daemon"
  echo "   Or: start.bat"
fi

# Step 5: Create alias for easy access
ALIAS_BLOCK='
# GangNiaga Hermes Agent
export GANGNIAGA_DIR="/mnt/d/GangNiaga-WebBridge"
alias hermes-agent-aku="cd \$GANGNIAGA_DIR && node hermes-agent-wsl.js"
alias hermes-agent-aku-i="cd \$GANGNIAGA_DIR && node hermes-agent-wsl.js --interactive"
alias Hermes-Agent-Aku="cd \$GANGNIAGA_DIR && node hermes-agent-wsl.js"
alias Hermes-Agent-Aku-i="cd \$GANGNIAGA_DIR && node hermes-agent-wsl.js --interactive"
'

# Update .bashrc
BASHRC="$HOME/.bashrc"
if [ -f "$BASHRC" ]; then
  if ! grep -q "hermes-agent-aku" "$BASHRC" 2>/dev/null; then
    echo "📌 Adding hermes-agent-aku command alias to .bashrc..."
    echo "$ALIAS_BLOCK" >> "$BASHRC"
  fi
fi

# Update .zshrc
ZSHRC="$HOME/.zshrc"
if [ -f "$ZSHRC" ]; then
  if ! grep -q "hermes-agent-aku" "$ZSHRC" 2>/dev/null; then
    echo "📌 Adding hermes-agent-aku command alias to .zshrc..."
    echo "$ALIAS_BLOCK" >> "$ZSHRC"
  fi
fi

echo "   Reload shell: source ~/.bashrc or source ~/.zshrc"

echo ""
echo "✨ Setup complete!"
echo ""
echo "Usage:"
echo "  hermes-agent-aku       - Run workflow (or Hermes-Agent-Aku)"
echo "  hermes-agent-aku-i     - Interactive console (or Hermes-Agent-Aku-i)"
echo ""
echo "Make sure daemon is running on Windows:"
echo "  cd D:\\GangNiaga-WebBridge && npm run daemon"
echo "  Or just double-click start.bat"
