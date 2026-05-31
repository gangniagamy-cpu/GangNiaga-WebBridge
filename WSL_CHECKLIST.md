# ✅ WSL Setup Checklist - WebBridge Test Agent

## Pre-Setup Requirements

- [ ] Windows 10/11 with WSL 2 enabled
- [ ] Node.js installed on Windows (`node --version`)
- [ ] Node.js installed on WSL (`wsl node --version`)
- [ ] Chrome installed on Windows
- [ ] GangNiaga WebBridge repo cloned

## Windows Setup (One Time)

### Extension Installation

- [ ] Install extension from `chrome://extensions/`
- [ ] Enable developer mode
- [ ] Load unpacked from `extension/` folder
- [ ] Reload extension in Chrome

### Registry & Daemon Setup

- [ ] Run `install.bat` (registers native messaging)
- [ ] Run daemon: `npm run daemon`
- [ ] Copy API key from daemon output
- [ ] Verify daemon at `http://localhost:10087` (from Windows) or `http://<WIN_HOST_IP>:10087/status` (from WSL)

### MCP & Skills (Optional)

- [ ] Run `setup-mcp.bat` (for Claude Desktop)
- [ ] Run `install-skills.bat` (for Test Agent)

## WSL Setup (One Time)

- [ ] Open WSL terminal
- [ ] Navigate to: `cd /mnt/d/GangNiaga-WebBridge`
- [ ] Run: `bash wsl-setup.sh`
- [ ] Reload shell: `source ~/.bashrc`
- [ ] Verify: `command -v hermes-agent-aku` (should output node path)

## Configuration (One Time)

- [ ] Copy `.env.wsl` to `.env`
- [ ] Update `.env` with:
  - [ ] `GANGNIAGA_API_KEY=<from-daemon-output>`
  - [ ] `DAEMON_HOST=` (leave empty so `test-agent-aku.js` auto-detects Windows IP)
  - [ ] `DAEMON_PORT=10087`
- [ ] Test connection from WSL: `curl http://$(ip route show default | awk '{print $3}'):10087/status`

## Verification (One Time)

- [ ] Daemon running on Windows: ✅
- [ ] WSL can reach daemon: ✅
- [ ] Environment variables set: ✅
- [ ] Node modules installed: ✅
- [ ] Shell aliases configured: ✅

## Now You Can Use (Anytime)

```bash
# WSL Terminal - These work forever after setup:
hermes-agent-aku       # Automated workflow
hermes-agent-aku-i     # Interactive mode
npm run hermes-agent-aku         # Alternative (Windows/WSL)
npm run hermes-agent-aku:interactive
```

## Troubleshooting Checklist

### Daemon not accessible

- [ ] Daemon running on Windows? (`npm run daemon`)
- [ ] Port 10087 open in firewall?
- [ ] WSL2 network enabled?
- [ ] API key correct in `.env`?

### Ejen not found

- [ ] WSL setup script ran? (`bash wsl-setup.sh`)
- [ ] Shell reloaded? (`source ~/.bashrc`)
- [ ] Check alias: `alias | grep hermes-agent-aku`

### API key issues

- [ ] Regenerate: `node daemon/config.js`
- [ ] Update `.env` with new key
- [ ] Restart agent

### Network issues

- [ ] Check connection from Windows: `curl http://localhost:10087/status`
- [ ] Check connection from WSL: `curl http://$(ip route show default | awk '{print $3}'):10087/status`
- [ ] Check WSL Host IP inside WSL: `ip route show default`

## File Locations

| File                | Purpose          | Location                                   |
| ------------------- | ---------------- | ------------------------------------------ |
| `.env`              | Configuration    | `d:\GangNiaga-WebBridge\.env`              |
| `test-agent-aku.js` | Local Test agent | `d:\GangNiaga-WebBridge\test-agent-aku.js` |
| `wsl-setup.sh`      | Setup script     | `d:\GangNiaga-WebBridge\wsl-setup.sh`      |
| `start-daemon.bat`  | Daemon launcher  | `d:\GangNiaga-WebBridge\start-daemon.bat`  |
| `WSL_SETUP.md`      | Full guide       | `d:\GangNiaga-WebBridge\WSL_SETUP.md`      |

## Quick Status Check

```bash
# Check if everything is ready
echo "Daemon?" && curl -s http://localhost:10087/status | head -1
echo "Agent?" && which node && npm run hermes-agent-aku --help
echo "Config?" && cat .env | grep GANGNIAGA_API_KEY
```

---

**🎉 Once all items are checked, WSL setup is complete and Hermes-Agent-Aku can run indefinitely without re-setup!**

See [WSL_SETUP.md](WSL_SETUP.md) for detailed troubleshooting.
