---
name: hermes-agent-windows
description: "Run and orchestrate the Hermes Agent from native Windows (PowerShell or cmd.exe), communicating with the WebBridge Daemon running locally on localhost."
---

# 🤖 HERMES AGENT WINDOWS — NATIVE AUTOMATION PROTOCOL

This skill provides operational parameters, configuration settings, and command reference for executing the Node.js **Hermes Agent CLI** natively on Windows.

---

## 🔌 1. Architecture & Native Communication

When running natively on Windows, both the Hermes Agent CLI and the WebBridge Daemon execute on the same machine. Communication is direct and utilizes the loopback address.

```
┌──────────────────────────────────────┐
│        Windows Native System         │
│  ┌────────────────────────────────┐  │
│  │   Hermes Agent CLI (Node.js)   │  │
│  └───────────────┬────────────────┘  │
│                  │ Local connection (localhost:10087)
│                  ▼
│  ┌────────────────────────────────┐  │
│  │    WebBridge Daemon            │  │
│  │    (Port 10087 / 10087/ws)     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## ⚙️ 2. Environment Settings (Windows)

The configuration file is located at `D:\GangNiaga-WebBridge\.env`. When running natively, configure the daemon address to point to `localhost`:

```env
DAEMON_HOST=localhost
DAEMON_PORT=10087
GANGNIAGA_API_KEY=      # Auto-populated or matching daemon/config
HERMES_LOG_LEVEL=info
```

### Auto API Key Reading
If `GANGNIAGA_API_KEY` is not manually set, the Windows script automatically reads the active key from the local config file:
`D:\GangNiaga-WebBridge\daemon\.webbridge-auth.json`

---

## 🚀 3. Native Windows Execution

To run the Hermes agent natively on Windows, you must open a terminal (PowerShell or Command Prompt) and run NPM scripts:

### PowerShell or Command Prompt
Navigate to the project root:
```powershell
cd D:\GangNiaga-WebBridge
```

### Run Commands
*   **Automated Run**: Executes the default Shopee workflow:
    ```powershell
    npm run hermes
    ```
*   **Interactive Console**: Start the interactive command processor:
    ```powershell
    npm run hermes:interactive
    ```

---

## 💻 4. Interactive Console Shell

When in interactive mode, the following commands are supported:
*   `sites` — Lists all registered domains in the database.
*   `load <domain>` — Loads the YAML selectors for a domain (e.g. `load shopee.com.my`).
*   `run` — Executes the loaded site script/recipe steps.
*   `screenshot` — Takes an OS-level screenshot and saves it to the `screenshots/` folder.
*   `exit` — Closes the interactive console session.

---

## 🛠️ 5. Troubleshooting (Windows)

### 1. Connection Refused
If the agent reports `Connection refused` on `localhost`:
*   Make sure the daemon is running. You can launch it by double-clicking `start.bat` or executing `npm run daemon` in a separate terminal.
*   Verify if another service is using port 10087 by running `netstat -ano | findstr 10087`. You can terminate conflicting daemons using `powershell -File kill-daemons.ps1`.

### 2. File Path Issues
*   All screenshots captured natively are written by default to the `D:\GangNiaga-WebBridge\screenshots\` folder. Ensure this folder exists and is writable.
