# 🛒 Chrome Web Store Listing & Compliance (CHROMEWEBSTORE.md)

This file contains the metadata, store listing copy, and privacy compliance justifications required for submitting **GangNiaga WebBridge Pro** to the Chrome Web Store.

It aligns with Google's official **Modern Web Guidance** standards for Built-in AI and security.

---

## 📝 1. Store Metadata

- **Extension Name:** GangNiaga WebBridge Pro (AI Agent Developer Gateway)
- **Version:** 1.9.15
- **Short Description:** Secure local browser automation bridge and self-healing AI gateway for developer agents.
- **Detailed Description:**
  GangNiaga WebBridge Pro is a next-generation local browser automation driver that connects developer AI agents (such as OpenClaw, official Hermes-Agent, and Claude Desktop) to Google Chrome.

  Unlike standard headless automation frameworks (like Playwright or Selenium) which are easily blocked by anti-bot scripts, WebBridge operates inside your authentic, logged-in Chrome session. This allows your personal AI assistant to securely perform research, capture web data, and assist you in real-time.

  Key Features:
  - **Self-Healing Selectors:** Integrated with local Chrome Gemini Nano (window.ai) to automatically recover and correct broken page elements on-the-fly.
  - **Full MCP Server Integration:** Exposes a Model Context Protocol (MCP) server with 17 browser and OS control tools.
  - **Zero-Trust E2EE Tunneling:** Protects commands via AES-256-GCM encryption between the agent and daemon.
  - **Human-Like Emulation:** Simulates human mouse dragging paths (Bezier curves) and keystroke typing delays to evade bot detectors.
  - **Native OS Relay:** Executes primary monitor screenshotting and hotkeys through a secure local daemon.

---

## 🛡️ 2. API Permissions Justifications (Single Purpose Compliance)

The Chrome Web Store enforces a strict **Single Purpose Policy**. Below are the granular justifications for every permission requested in `manifest.json`:

| Permission                        | Technical Justification                                                                                                                                                                                                     |
| :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`debugger`**                    | **CRITICAL:** Required to attach Chrome DevTools Protocol (CDP) to automated tabs to execute advanced developer tools (e.g. Accessibility Tree AXTree retrieval, Network capturing, and coordinate-based mouse simulation). |
| **`nativeMessaging`**             | Required to launch and exchange length-prefixed JSON packets with the local `gangniaga-daemon` binary, enabling secure OS-level commands.                                                                                   |
| **`storage`**                     | Used to persist extension configurations and broker communication messages for decentralized Multi-Agent Swarm coordination.                                                                                                |
| **`tabs`** / **`windows`**        | Required to open, list, close, and navigate tabs and windows dynamically on behalf of the AI Agent.                                                                                                                         |
| **`tabGroups`**                   | Required to programmatically group tabs created by different agent sessions (e.g., separating "Twitter Agent" tabs from "Shopping Agent" tabs) for a clean workspace.                                                       |
| **`alarms`**                      | Used to trigger periodic background keep-alive checkups to maintain stable WebSocket and Native Messaging daemon connections.                                                                                               |
| **`scripting`** / **`activeTab`** | Required to inject content scripts to parse basic DOM properties and scrape textual content from pages.                                                                                                                     |

---

## 🔒 3. Data Privacy & Built-in AI Disclosures

### A. Local-First Processing (Built-in AI)

- **Gemini Nano Integration:** The extension utilizes Chrome's Prompt API (`window.ai`) to run self-healing element corrections on-device. All element texts and structures scraped for model inputs are processed locally on the client machine. No webpage contents or prompts are sent to external cloud servers for the self-healing process.
- **AES-256-GCM Tunneling:** If an external agent is used, all command transmissions between the agent and Chrome are encrypted end-to-end. The extension cannot read data without the correct user-configured secret key.

### B. User Safety Gate (Sensitive Action Protection)

- WebBridge Pro monitors element selectors for sensitive keywords (e.g., `checkout`, `pay`, `purchase`, `password`).
- If a sensitive action is triggered, WebBridge automatically pauses the automation, prompts the user with an explicit confirmation alert, and refuses to execute unless the user manually approves it from the extension popup.
