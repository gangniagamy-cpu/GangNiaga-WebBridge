---
name: gangniaga-site-mapper
description: "Advanced skill for autonomous agents to dynamically scan, map, and generate Site Knowledge YAML files for the GangNiaga WebBridge."
---

# 🎼 GANGNIAGA SITE MAPPER PROTOCOL (AUTONOMOUS YAML GENERATION)

You are the **GangNiaga Site Mapper**. Your job is to eliminate manual work for the user. When the user asks you to automate a new platform (e.g., Facebook, TikTok, Canva) that does NOT yet have a YAML config file in the Knowledge Base, you MUST autonomously create and register it.

---

## 🧠 The "Auto-Map" Workflow

If a site's YAML file is missing or outdated, execute this sequence:

### 1. Open the Target Site
Use the WebBridge API to navigate to the target site.
```bash
curl -X POST http://127.0.0.1:10087/command \
  -H "Content-Type: application/json" \
  -d '{"action":"navigate", "args":{"url":"https://tiktok.com", "newTab": true}}'
```

### 2. Retrieve Page Structure / AXTree Snapshot
Send a snapshot command to the WebBridge to retrieve the simplified Accessibility Tree (AXTree) representing the interactive page elements.
```bash
curl -X POST http://127.0.0.1:10087/command \
  -H "Content-Type: application/json" \
  -d '{"action": "snapshot", "args": {}}'
```
*Alternatively, inject a DOM scanner using `evaluate`:*
```bash
curl -X POST http://127.0.0.1:10087/command \
  -H "Content-Type: application/json" \
  -d '{
    "action": "evaluate",
    "args": {
      "code": "(() => { const elements = Array.from(document.querySelectorAll(\"button, input, textarea, [role=\\\"button\\\"], [role=\\\"textbox\\\"]\")).filter(e => e.offsetParent !== null); return elements.map(e => ({ tag: e.tagName.toLowerCase(), text: (e.innerText || e.placeholder || e.name || \"\").trim().substring(0,30), id: e.id, class: e.className })); })()"
    }
  }'
```

### 3. Analyze and Structure CSS Selectors
Analyze the elements or AXTree structure. Identify the most critical elements for automation (e.g., "Post Button", "Search Bar", "Upload Input"). Formulate robust CSS selectors for them based on their IDs or unique attributes (prefer IDs, unique parent relationships, and `data-` attributes over volatile classes).

### 4. Save the YAML File directly inside the Daemon Sites Directory
Write the structured data directly into a `.yaml` file inside the `D:\GangNiaga-WebBridge\daemon\sites\` directory. 

*Example PowerShell command you can run to save it:*
```powershell
$yaml = @"
domain: "tiktok.com"
name: "TikTok"
description: "TikTok web interface selectors"
selectors:
  upload_btn: "button.upload-btn-class"
  caption_input: "div.DraftEditor-editorContainer"
recipes:
  upload_video:
    description: "Upload video with caption"
    steps:
      - action: click
        selector: "button.upload-btn-class"
      - action: fill
        selector: "div.DraftEditor-editorContainer"
"@
Set-Content -Path "D:\GangNiaga-WebBridge\daemon\sites\tiktok.com.yaml" -Value $yaml -Encoding UTF8
```

---

## 🎯 Rules of Engagement

-   **Write to the correct Daemon path:** The site rules must be stored in `D:\GangNiaga-WebBridge\daemon\sites\<domain>.yaml` so the WebBridge daemon's `/sites/` API endpoint can find and serve it immediately to other agents in the future.
-   **Proactive Mapping:** If the user says "Automate Canva", do not wait for instructions to create the rules. Say "Mapping Canva layout..." and generate the YAML file immediately.
-   **Incremental Updates:** If a selector in an existing YAML config breaks, use the `POST /sites/update` API endpoint to automatically persist the healed selector.
