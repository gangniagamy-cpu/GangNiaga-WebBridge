# ⚡ GangNiaga WebBridge v2.5

**Browser automation bridge for AI agents** — controls your real Chrome browser from WSL/terminal via a lightweight Node.js daemon.

## 🚀 Quick Start (3 steps)

### 1. Start Daemon (Windows)
```powershell
# Option A: Double-click start.bat on Windows
# Option B:
cd D:\GangNiaga-WebBridge
npm run daemon
```
Keep this running in the background.

### 2. Install Chrome Extension (One-time)
1. Open `chrome://extensions` → Enable **Developer mode**
2. Click **Load unpacked** → Select the `extension/` folder
3. Your Chrome toolbar icon should appear

### 3. Use from WSL
```bash
cd /mnt/d/GangNiaga-WebBridge
bash wsl-setup.sh    # one-time
source ~/.bashrc

hermes               # Run automated workflow
hermes-i             # Interactive mode
```

**That's it!** Daemon auto-generates API key, WSL auto-discovers Windows host.

---

## 📡 Architecture

```
AI Agent / Terminal
    ↓ HTTP POST /command    (port 10087)
Node.js Daemon (Windows)
    ↓ WebSocket + E2EE      (port 10087/ws)
Chrome Extension
    ↓ CDP (Chrome Debugger Protocol)
Real Chrome Browser (your logged-in session)
```

Key advantage: operates inside **your authenticated Chrome** — no bot detection, no cookie/login issues.

---

## 🛠️ API Quick Reference

```bash
# Check status (no auth needed)
curl http://localhost:10087/status

# Browser commands (auth required)
curl -X POST http://localhost:10087/command \
  -H "Authorization: Bearer <key>" \
  -d '{"action":"navigate","args":{"url":"https://google.com"}}'

curl -X POST http://localhost:10087/command \
  -H "Authorization: Bearer <key>" \
  -d '{"action":"os_screenshot","args":{"path":"D:/screen.png"}}'

# Site knowledge base
curl http://localhost:10087/sites/shopee.com.my
```

Full API docs: see `skills/gangniaga-webbridge-pro/SKILL.md`

---

## 📋 Available Actions

| Category | Actions |
|----------|---------|
| **Navigation** | `navigate`, `close_tab`, `list_tabs` |
| **Interaction** | `click`, `fill`, `mouse_click`, `hover`, `scroll` |
| **Data** | `snapshot`, `screenshot`, `evaluate`, `extract_text` |
| **OS** | `os_screenshot`, `os_click`, `hotkey` |
| **Advanced** | `wait_for`, `network`, `cdp`, `save_as_pdf`, `upload` |

---

## 🧠 AI Self-Healing

Selectors broke? The extension uses **on-device Gemini Nano** to find the closest matching element and auto-persists fixes to `daemon/sites/*.yaml`.

---

## 🔧 Configuration

Edit `.env` (auto-created on first run):
```env
GANGNIAGA_API_KEY=auto-generated
GANGNIAGA_TIMEOUT_MS=30000
GANGNIAGA_SECRET=optional_e2ee_key
```

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| Daemon not running | `npm run daemon` in Windows |
| Extension not connecting | Reload extension in chrome://extensions |
| WSL can't reach daemon | `wsl-setup.sh` auto-discovers gateway IP |
| Wrong API key | Check `daemon/.webbridge-auth.json` |
| Port 10087 in use | `powershell -File kill-daemons.ps1` |

---

## 📁 Project Structure

```
daemon/           — Node.js daemon (port 10087)
extension/        — Chrome Extension (CDP bridge, anti-bot shield)
mcp-server/       — MCP server for Claude Desktop / Cursor
skills/           — AI agent skills (Hermes, Gemini CLI)
hermes-agent-wsl.js — WSL automation agent
start.bat         — One-click setup & launch
```

---

## 🧪 Testing

```bash
npm test           # Run unit tests (Jest)
npm run lint       # Check code quality (ESLint)
powershell -File test-webbridge.ps1  # Full integration test
```

---

Licensed under MIT. Built by GangNiaga AI.
