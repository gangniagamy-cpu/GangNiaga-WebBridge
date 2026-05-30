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

# Step 2: Copy .env from example
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo "⚠️  Edit .env to set your API key!"
fi

# Step 3: Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Step 4: Test daemon connection
echo "🔗 Testing daemon connection..."
if timeout 2 bash -c "echo > /dev/tcp/localhost/10087" 2>/dev/null; then
  echo "✅ Daemon is accessible!"
else
  echo "⚠️  Daemon not running. Start it on Windows first:"
  echo "   cd d:\\GangNiaga-WebBridge && npm run daemon"
fi

# Step 5: Create alias for easy access
BASHRC="$HOME/.bashrc"
if ! grep -q "hermes-agent-wsl" "$BASHRC"; then
  echo "📌 Adding hermes command alias..."
  cat >> "$BASHRC" << 'EOF'

# GangNiaga Hermes Agent
alias hermes='node /mnt/d/GangNiaga-WebBridge/hermes-agent-wsl.js'
alias hermes-i='node /mnt/d/GangNiaga-WebBridge/hermes-agent-wsl.js --interactive'
EOF
  echo "   Reload shell: source ~/.bashrc"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Usage:"
echo "  hermes              - Run Hermes workflow"
echo "  hermes-i            - Interactive mode"
echo ""
echo "Make sure daemon is running on Windows:"
echo "  cd d:\\GangNiaga-WebBridge && npm run daemon"
