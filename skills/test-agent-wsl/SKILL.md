---
name: test-agent-wsl
description: 'Run and orchestrate the local test agent (test-agent-aku.js) from inside WSL (Windows Subsystem for Linux), communicating with the WebBridge Daemon running on Windows.'
---

# 🤖 GANGNIAGA TEST AGENT WSL — LINUX ORCHESTRATION PROTOCOL

This skill provides operational parameters, environment details, and execution guides for running the Node.js **Local WebBridge Test Agent** (`test-agent-aku.js`) from a WSL terminal (e.g., Ubuntu, Kali Linux).

---

## 🔌 1. WSL Architecture & Network Bridging

The Local Test Agent runs in WSL, but the WebBridge Daemon and Google Chrome run natively on the Windows host.

```
┌──────────────────────────────────────┐
│             WSL (Linux)              │
│  Local Test Agent (hermes-agent-aku) │
└──────────────────┬───────────────────┘
                   │ Network Bridge
                   ▼ (Windows Host IP: e.g. 172.22.32.1:10087)
┌──────────────────────────────────────┐
│            Windows Host              │
│  - WebBridge Daemon (port 10087)     │
│  - Google Chrome (remote debugging)  │
└──────────────────────────────────────┘
```

### Dynamic Gateway IP Detection

In WSL, `localhost` does not automatically route to Windows unless mirrored mode is configured. The agent dynamically finds the Windows Host IP at runtime via:

```bash
HOST_IP=$(ip route show default | awk '{print $3}')
```

---

## ⚙️ 2. WSL Environment Settings

The `.env` configuration file inside `/mnt/d/GangNiaga-WebBridge/.env` controls how the WSL agent locates the Windows daemon:

```env
DAEMON_HOST=            # Empty/unset (allows auto-detection of Windows IP)
DAEMON_PORT=10087
GANGNIAGA_API_KEY=      # Filled dynamically from daemon/.webbridge-auth.json or env
HERMES_LOG_LEVEL=info
```

### Auto API Key Reading

If `GANGNIAGA_API_KEY` is not manually set, the WSL script automatically reads the active key from the mounted Windows filesystem at:
`/mnt/d/GangNiaga-WebBridge/daemon/.webbridge-auth.json`

---

## 🚀 3. One-Time WSL Setup

To configure your WSL shell aliases, run the setup script:

```bash
cd /mnt/d/GangNiaga-WebBridge
bash wsl-setup.sh
source ~/.bashrc
```

This adds the following aliases to your `~/.bashrc` and `~/.zshrc`:

- `hermes-agent-aku`: Runs the automated test workflow (`node test-agent-aku.js`)
- `hermes-agent-aku-i`: Runs the interactive console (`node test-agent-aku.js --interactive`)

---

## 💻 4. Command Line Usage

### Interactive Shell (`hermes-agent-aku-i`)

Allows you to run individual browser commands step-by-step:

- `sites` — Lists all sites mapped in the daemon database.
- `load <domain>` — Loads the YAML selector rules (e.g., `load shopee.com.my`).
- `run` — Triggers the compiled automation recipe sequence.
- `screenshot` — Takes an OS-level screenshot via the daemon and saves it.
- `exit` — Gracefully exits interactive shell.

### Automation Script (`hermes-agent-aku`)

Runs the full end-to-end Shopee navigation and search verification pipeline automatically, creating a screenshot at `screenshots/hermes.png`.

---

## 🛠️ 5. Troubleshooting in WSL

### 1. Connection Refused

If the agent says `Connection refused` or `timed out`:

- Verify the daemon is running on Windows (run `start.bat` or `npm run daemon` on Windows).
- Run `ping <Windows_Host_IP>` to verify the network routing.
- Make sure Windows Defender Firewall allows Node.js inbound traffic on Port 10087.

### 2. Invalid Line Endings

If executing `.sh` scripts yields `\r: command not found`:

- Ensure git attributes are set or run `dos2unix` on shell files.
