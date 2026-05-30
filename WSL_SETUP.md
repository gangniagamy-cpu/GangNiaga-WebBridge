# Hermes Agent WSL Setup Guide

**One-time setup** untuk enable semua features dari WSL tanpa perlu setup berkali-kali.

## 📋 Requirements

- Windows 10/11 dengan WSL 2
- Node.js di WSL
- Node.js di Windows (untuk daemon)
- Chrome di Windows

## 🚀 Quick Start

### Step 1: Setup Daemon on Windows

```bash
# PowerShell (Windows)
cd d:\GangNiaga-WebBridge
npm run daemon
```

Atau double-click: `start-daemon.bat`

**Expected output:**
```
🚀 [WebBridge] Daemon running on http://localhost:10087
✅ [Auth] API Key generated: xxx...
```

### Step 2: Setup WSL (One Time Only)

```bash
# WSL Terminal
cd /mnt/d/GangNiaga-WebBridge
bash wsl-setup.sh
```

Script ini akan:
- ✅ Check Node.js
- ✅ Create `.env` file
- ✅ Install dependencies
- ✅ Test daemon connection
- ✅ Add shell aliases

### Step 3: Reload Shell

```bash
source ~/.bashrc
```

## 📖 Usage

### Run Hermes Workflow (Automated)

```bash
hermes
```

Atau full path:
```bash
node /mnt/d/GangNiaga-WebBridge/hermes-agent-wsl.js
```

**Output:**
```
[Hermes] Loading knowledge base for shopee.com.my...
✅ Loaded YAML for shopee.com.my
[Hermes] Executing: open_tab
✅ Command executed: open_tab
...
✨ Workflow completed successfully!
```

### Interactive Mode

```bash
hermes-i
```

Atau full path:
```bash
node /mnt/d/GangNiaga-WebBridge/hermes-agent-wsl.js --interactive
```

**Commands:**
- `sites` - List available knowledge bases
- `load <domain>` - Load specific site knowledge
- `run` - Execute workflow
- `screenshot` - Capture current screen
- `exit` - Exit interactive mode

## 🔐 Configuration

Edit `.env` file:

```env
# .env (created from .env.example)
DAEMON_HOST=localhost
DAEMON_PORT=10087
GANGNIAGA_API_KEY=your-api-key-here
HERMES_LOG_LEVEL=info
```

**Get API Key from daemon startup output** or regenerate:

```bash
# PowerShell (Windows)
node daemon/gangniaga-daemon.js
```

## 🎯 Features Enabled

From WSL, Hermes can:

| Feature | Command | Status |
|---------|---------|--------|
| **Open URLs** | `open_tab` | ✅ |
| **Type text** | `type` | ✅ |
| **Click elements** | `click` | ✅ |
| **Screenshots** | `os_screenshot` | ✅ |
| **Knowledge Base** | `/sites/<domain>` | ✅ |
| **Automation** | All commands | ✅ |
| **Cross-domain** | Shopee, Facebook, TikTok, etc. | ✅ |

## 🔧 Troubleshooting

### Daemon not accessible

```bash
# Test connection from WSL
curl -X GET http://localhost:10087/sites/shopee.com.my
```

If fails:
1. Make sure daemon is running on Windows
2. Check firewall (Windows Defender)
3. Test localhost: `ping localhost`

### API Key mismatch

```bash
# Regenerate API key
node daemon/config.js

# Update .env
GANGNIAGA_API_KEY=new-key-here
```

### WSL2 network issues

```bash
# Check WSL2 IP
wsl hostname -I

# Use IP instead of localhost if needed
DAEMON_HOST=172.x.x.x
```

## 📝 Run Multiple Domains

Create custom Hermes script:

```bash
#!/usr/bin/env node
require('dotenv').config();

// hermes-shopee.js - Automated Shopee workflow
const domain = 'shopee.com.my';
const actions = [
  { action: 'open_tab', args: { url: `https://${domain}` } },
  { action: 'wait', args: { ms: 2000 } },
  // Add more actions...
];

// Execute actions...
```

Run multiple times:
```bash
node hermes-shopee.js
node hermes-facebook.js
node hermes-tiktok.js
```

## 🎓 Advanced Usage

### Logging

```bash
# Debug mode
HERMES_LOG_LEVEL=debug hermes
```

### Custom timeout

```bash
# Modify hermes-agent-wsl.js
const COMMAND_TIMEOUT = 60000; // 60 seconds
```

### Batch automation

```bash
# Run Hermes 5 times
for i in {1..5}; do
  echo "Run $i"
  hermes
  sleep 5
done
```

## 📚 Related Files

- `hermes-agent-wsl.js` - Main Hermes agent for WSL
- `wsl-setup.sh` - One-time setup script
- `start-daemon.bat` - Easy daemon launcher (Windows)
- `.env` - Configuration file
- `daemon/gangniaga-daemon.js` - Daemon server (Windows)
- `daemon/sites/*.yaml` - Knowledge bases

## ✨ What's Included

✅ **Persistent configuration** - .env file  
✅ **Shell aliases** - `hermes` & `hermes-i` commands  
✅ **Automated workflow** - Run once, reuse many times  
✅ **Error handling** - Graceful failures with helpful messages  
✅ **Interactive mode** - Test commands interactively  
✅ **Screenshot support** - Capture automation results  
✅ **Multiple domains** - Shopee, Facebook, TikTok, Google, Canva  

## 🎯 Summary

| Step | Where | Command |
|------|-------|---------|
| 1 | Windows | `npm run daemon` |
| 2 | WSL | `bash wsl-setup.sh` |
| 3 | WSL | `source ~/.bashrc` |
| 4 | WSL | `hermes` |

**That's it!** Setup once, run anytime from WSL. 🚀
