# ✅ WSL Setup Checklist - Hermes Agent

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
- [ ] Verify daemon at `http://localhost:10087`

### MCP & Skills (Optional)
- [ ] Run `setup-mcp.bat` (for Claude Desktop)
- [ ] Run `install-skills.bat` (for Hermes-Agent)

## WSL Setup (One Time)

- [ ] Open WSL terminal
- [ ] Navigate to: `cd /mnt/d/GangNiaga-WebBridge`
- [ ] Run: `bash wsl-setup.sh`
- [ ] Reload shell: `source ~/.bashrc`
- [ ] Verify: `command -v hermes` (should output node path)

## Configuration (One Time)

- [ ] Copy `.env.wsl` to `.env`
- [ ] Update `.env` with:
  - [ ] `GANGNIAGA_API_KEY=<from-daemon-output>`
  - [ ] `DAEMON_HOST=localhost`
  - [ ] `DAEMON_PORT=10087`
- [ ] Test connection: `curl http://localhost:10087`

## Verification (One Time)

- [ ] Daemon running on Windows: ✅
- [ ] WSL can reach daemon: ✅
- [ ] Environment variables set: ✅
- [ ] Node modules installed: ✅
- [ ] Shell aliases configured: ✅

## Now You Can Use (Anytime)

```bash
# WSL Terminal - These work forever after setup:
hermes              # Automated workflow
hermes-i            # Interactive mode
npm run hermes      # Alternative
npm run hermes:interactive
```

## Troubleshooting Checklist

### Daemon not accessible
- [ ] Daemon running on Windows? (`npm run daemon`)
- [ ] Port 10087 open in firewall?
- [ ] WSL2 network enabled?
- [ ] API key correct in `.env`?

### Hermes not found
- [ ] WSL setup script ran? (`bash wsl-setup.sh`)
- [ ] Shell reloaded? (`source ~/.bashrc`)
- [ ] Check alias: `alias | grep hermes`

### API key issues
- [ ] Regenerate: `node daemon/config.js`
- [ ] Update `.env` with new key
- [ ] Restart hermes

### Network issues
- [ ] Check connection: `curl http://localhost:10087`
- [ ] From WSL: `curl http://127.0.0.1:10087`
- [ ] Check WSL2 IP: `wsl hostname -I`

## File Locations

| File | Purpose | Location |
|------|---------|----------|
| `.env` | Configuration | `d:\GangNiaga-WebBridge\.env` |
| `hermes-agent-wsl.js` | Hermes agent | `d:\GangNiaga-WebBridge\hermes-agent-wsl.js` |
| `wsl-setup.sh` | Setup script | `d:\GangNiaga-WebBridge\wsl-setup.sh` |
| `start-daemon.bat` | Daemon launcher | `d:\GangNiaga-WebBridge\start-daemon.bat` |
| `WSL_SETUP.md` | Full guide | `d:\GangNiaga-WebBridge\WSL_SETUP.md` |

## Quick Status Check

```bash
# Check if everything is ready
echo "Daemon?" && curl -s http://localhost:10087 | head -1
echo "Hermes?" && which node && npm run hermes --help
echo "Config?" && cat .env | grep GANGNIAGA_API_KEY
```

---

**🎉 Once all items are checked, WSL setup is complete and Hermes can run indefinitely without re-setup!**

See [WSL_SETUP.md](WSL_SETUP.md) for detailed troubleshooting.
