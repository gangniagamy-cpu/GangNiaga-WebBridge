---
name: gangniaga-webbridge-pro
description: "Sovereign control of the Windows Chrome Browser using the GangNiaga WebBridge REST API (127.0.0.1:10087). Use this skill to interact with the browser, execute Javascript, and read YAML site knowledge without manual clicks."
---

# 🎼 GANGNIAGA WEBBRIDGE AUTOPILOT PROTOCOL

You are equipped with the **GangNiaga WebBridge**, a Native Messaging Chrome extension that gives you God-mode control over the user's Chrome browser running on Windows. You do not need Selenium, Playwright, or Puppeteer. The bridge is always alive at `http://127.0.0.1:10087`.

## 📡 1. Core Endpoints

You must interact with the WebBridge using `curl` or `Invoke-RestMethod` to the following endpoints:

1. **Check Browser Status**:
   ```bash
   curl -s http://127.0.0.1:10087/status
   ```
   *Always check this first to ensure the extension is connected (`extension_connected: true`).*

2. **Retrieve Site Knowledge (YAML Recipes)**:
   ```bash
   curl -s http://127.0.0.1:10087/sites/<domain>
   ```
   *Example: `http://127.0.0.1:10087/sites/shopee.com.my`*
   *Use this to retrieve pre-mapped CSS selectors (search boxes, login buttons) so you don't have to guess or scrape the DOM.*

3. **Execute Browser Commands (POST `/command`)**:
   Send a JSON payload to `http://127.0.0.1:10087/command` to execute actions.
   ```bash
   curl -s -X POST http://127.0.0.1:10087/command \
     -H "Content-Type: application/json" \
     -d '{"action": "ACTION_NAME", "args": { ... }}'
   ```

## 🛠️ 2. Available Command Actions

When sending a POST request to `/command`, use these `action` names in the JSON payload:

- `open_tab` (or `navigate`): Opens a new tab or navigates the active tab.
  - `args`: `{"url": "https://shopee.com.my"}`
- `list_tabs`: Returns a list of all open Chrome tabs with their IDs and titles.
  - `args`: `{}`
- `evaluate` (or `run_js`): Executes raw Javascript in the context of the active Chrome tab and returns the result. This is your primary weapon for DOM manipulation.
  - `args`: `{"code": "document.querySelector('input').value = 'Test'; document.title;"}`
- `os_screenshot`: Takes a full OS-level screenshot (saved to disk).
  - `args`: `{"path": "D:/screenshot.png"}`
- `os_click`: Performs an OS-level mouse click at X, Y coordinates.
  - `args`: `{"x": 500, "y": 500}`
- `hotkey`: Sends keyboard keystrokes to the OS.
  - `args`: `{"keys": ["ctrl", "t"]}`
- `save_as_pdf`: Triggers Chrome DevTools Protocol to save the current page as a base64 PDF.
  - `args`: `{}`

## 🧠 3. Workflow Implementation (The Hermes Way)

When the user asks you to automate a website (e.g., "Search for a gaming laptop on Shopee"), follow this exact sequence:

1. **Verify Connection**: `curl http://127.0.0.1:10087/status`
2. **Fetch Knowledge**: `curl http://127.0.0.1:10087/sites/shopee.com.my` to get the CSS selectors.
3. **Navigate**: POST to `/command` with `action: "navigate"` to open the site.
4. **Execute**: POST to `/command` with `action: "evaluate"` and write a Javascript block that uses the CSS selectors you learned in step 2 to input text and click search.
5. **Report**: Return the JSON output of the evaluate command back to the user to prove success.

**IMPORTANT RULES:**
- NEVER assume a CSS selector. If a site has a YAML recipe via `/sites`, you MUST read it first.
- When running JS via `evaluate`, always wrap your logic to avoid syntax errors and ensure you return a value (e.g., `return {success: true, msg: "Clicked"}`).
- If you are running inside WSL2 and localhost fails, use the Windows Gateway IP to reach port 10087 (e.g., `$(ip route show default | awk '{print $3}')`).
