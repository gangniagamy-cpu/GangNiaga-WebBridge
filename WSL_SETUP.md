# WebBridge WSL Test Agent Setup Guide

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
===========================================================
  GangNiaga WebBridge Daemon running on Port 10087
  Listening at http://0.0.0.0:10087 & ws://0.0.0.0:10087/ws
  E2EE Encryption is INACTIVE
===========================================================
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

### Run Test Workflow (Automated)

```bash
hermes-agent-aku
```

> [!IMPORTANT]
> Arahan `hermes-agent-aku` digunakan sebagai pintasan ujian bagi mengelakkan pertindihan (_clash_) dengan arahan **`hermes`** daripada Ejen Hermes Nous Research yang rasmi (seperti `hermes chat`, `hermes setup`).

Atau Jelas (full path):

```bash
node /mnt/d/GangNiaga-WebBridge/test-agent-aku.js
```

**Output:**

```
[GangNiaga] Loading knowledge base for shopee.com.my...
✅ Loaded YAML for shopee.com.my
[GangNiaga] Executing: open_tab
✅ Command executed: open_tab
...
✨ Workflow completed successfully!
```

### Interactive Mode

```bash
hermes-agent-aku-i
```

Atau Jelas (full path):

```bash
node /mnt/d/GangNiaga-WebBridge/test-agent-aku.js --interactive
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

From WSL, the test agent can:

| Feature            | Command                        | Status |
| ------------------ | ------------------------------ | ------ |
| **Open URLs**      | `open_tab`                     | ✅     |
| **Type text**      | `type`                         | ✅     |
| **Click elements** | `click`                        | ✅     |
| **Screenshots**    | `os_screenshot`                | ✅     |
| **Knowledge Base** | `/sites/<domain>`              | ✅     |
| **Automation**     | All commands                   | ✅     |
| **Cross-domain**   | Shopee, Facebook, TikTok, etc. | ✅     |

## 🔧 Troubleshooting

### Daemon not accessible

```bash
# Test connection from WSL using the Windows Host IP
WIN_HOST_IP=$(ip route show default | awk '{print $3}')
curl -s -X GET http://${WIN_HOST_IP}:10087/status
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
# Check Windows Host IP manually inside WSL
ip route show default | awk '{print $3}'
```

By default, the setup auto-detects this IP when `DAEMON_HOST` is left blank in `.env`. You can manually specify this IP in `.env` if the auto-detection fails.

## 📝 Run Multiple Domains

Create custom test script:

```bash
#!/usr/bin/env node
require('dotenv').config();

// test-shopee.js - Automated Shopee workflow
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
node test-shopee.js
node test-facebook.js
node test-tiktok.js
```

## 🎓 Advanced Usage

### Logging

```bash
# Debug mode
HERMES_LOG_LEVEL=debug hermes-agent-aku
```

### Custom timeout

```bash
# Modify test-agent-aku.js
const COMMAND_TIMEOUT = 60000; // 60 seconds
```

### Batch automation

```bash
# Run 5 times
for i in {1..5}; do
  echo "Run $i"
  hermes-agent-aku
  sleep 5
done
```

## 📚 Related Files

- `test-agent-aku.js` - Main testing agent script for WSL
- `wsl-setup.sh` - One-time setup script
- `start-daemon.bat` - Easy daemon launcher (Windows)
- `.env` - Configuration file
- `daemon/gangniaga-daemon.js` - Daemon server (Windows)
- `daemon/sites/*.yaml` - Knowledge bases

## ✨ What's Included

    ✅ **Persistent configuration** - .env file
    ✅ **Shell aliases** - `hermes-agent-aku` & `hermes-agent-aku-i` commands
    ✅ **Automated workflow** - Run once, reuse many times
    ✅ **Error handling** - Graceful failures with helpful messages
    ✅ **Interactive mode** - Test commands interactively
    ✅ **Screenshot support** - Capture automation results
    ✅ **Multiple domains** - Shopee, Facebook, TikTok, Google, Canva

## 🎯 Summary

| Step | Where   | Command             |
| ---- | ------- | ------------------- |
| 1    | Windows | `npm run daemon`    |
| 2    | WSL     | `bash wsl-setup.sh` |
| 3    | WSL     | `source ~/.bashrc`  |
| 4    | WSL     | `hermes-agent-aku`  |

**That's it!** Setup once, run anytime from WSL. 🚀
