# 🤖 Hermes Agent WSL - Quick Reference

## ⚡ One-Time Setup (3 steps)

### 1️⃣ Start Daemon (Windows PowerShell)
```bash
cd d:\GangNiaga-WebBridge
npm run daemon
```
✅ Keep running in background (or use `start-daemon.bat`)

### 2️⃣ Setup WSL (WSL Terminal)
```bash
cd /mnt/d/GangNiaga-WebBridge
bash wsl-setup.sh
source ~/.bashrc
```

### 3️⃣ Done! Now use forever:

## 🎯 Usage

### Automated Workflow
```bash
hermes
```

### Interactive Mode
```bash
hermes-i
```

Commands:
- `sites` → List available domains
- `load shopee.com.my` → Load knowledge base
- `run` → Execute workflow
- `screenshot` → Capture screen
- `exit` → Exit

## 📊 What Each Command Does

| Command | Action | Result |
|---------|--------|--------|
| `hermes` | Auto-run workflow | Opens tab, searches, captures screenshot |
| `hermes-i` | Interactive shell | Manual control over each step |
| Both | Test daemon | Verifies connection before starting |

## 🔧 Configuration

Edit `.env`:
```env
DAEMON_HOST=localhost
DAEMON_PORT=10087
GANGNIAGA_API_KEY=<your-key>
HERMES_LOG_LEVEL=info
```

Get API key from daemon startup output

## ✨ Features

✅ All automation from WSL  
✅ No repeated setup  
✅ Knowledge base for each site  
✅ Screenshots + typing + clicking  
✅ Error handling + color logs  
✅ Interactive & automated modes  

## 🆘 Troubleshooting

**Daemon not accessible?**
```bash
curl http://localhost:10087
```

**Wrong API key?**
- Check daemon startup output
- Update `.env` file

**WSL connection issues?**
```bash
# Check if localhost:10087 is accessible
timeout 2 bash -c 'echo > /dev/tcp/localhost/10087' && echo OK
```

## 📚 Advanced

### Custom domain workflow
Create `hermes-custom.js`:
```javascript
const domain = 'facebook.com';
// Add custom logic
```

Run multiple times:
```bash
for i in {1..5}; do hermes; sleep 5; done
```

### Debug mode
```bash
HERMES_LOG_LEVEL=debug hermes
```

---

**See [WSL_SETUP.md](WSL_SETUP.md) for complete guide**
