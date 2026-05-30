---
name: gangniaga-webbridge-pro
description: "Sovereign control of the Windows Chrome Browser using the GangNiaga WebBridge REST API (127.0.0.1:10087). Use this skill to interact with the browser, execute Javascript, and read YAML site knowledge without manual clicks."
---

# 🎼 GANGNIAGA WEBBRIDGE AUTOPILOT PROTOCOL (PRO EDITION)

You are equipped with the **GangNiaga WebBridge Pro**, a Native Messaging Chrome extension that gives you God-mode control over the user's Chrome browser running on Windows. The bridge is always alive at `http://127.0.0.1:10087`.

---

## 📡 1. Core Endpoints & REST Actions

You must interact with the WebBridge using `curl` or `Invoke-RestMethod` to the following endpoints:

1.  **Check Browser Status**:
    ```bash
    curl -s http://127.0.0.1:10087/status
    ```
    *Check this first to verify connection (`extension_connected: true`).*

2.  **Retrieve Site Knowledge (YAML Recipes)**:
    ```bash
    curl -s http://127.0.0.1:10087/sites/<domain>
    ```
    *Use this to retrieve pre-mapped CSS selectors (search boxes, login buttons) so you don't have to guess or scrape the DOM.*

3.  **Persist Self-Healed Selectors (POST `/sites/update`)**:
    When a selector fails and you heal it using a semantic search or local Gemini Nano, persist the correction so it is saved permanently:
    ```bash
    curl -X POST http://127.0.0.1:10087/sites/update \
      -H "Content-Type: application/json" \
      -d '{
        "domain": "shopee.com.my",
        "originalSelector": "search_input",
        "healedSelector": "input#search-box-new-healed",
        "healedIndex": 3,
        "tag": "INPUT"
      }'
    ```

4.  **Execute Browser Commands (POST `/command`)**:
    Send a JSON payload to `http://127.0.0.1:10087/command` to execute actions:
    ```bash
    curl -s -X POST http://127.0.0.1:10087/command \
      -H "Content-Type: application/json" \
      -d '{"action": "ACTION_NAME", "args": { ... }}'
    ```

---

## 🛠️ 2. Upgraded Command Action Suite

When sending a POST request to `/command`, use these `action` names in the JSON payload:

-   `navigate` (or `open_tab`): Opens a new tab or navigates the active tab.
    *   `args`: `{"url": "https://shopee.com.my", "newTab": true}`
-   `click` / `fill`: Clicks or enters text into elements (with built-in self-healing).
    *   `args`: `{"selector": "input.search", "value": "Laptop"}` (for fill)
    *   `args`: `{"selector": "@e1"}` (for click on AXTree ref)
-   `mouse_click`: Moves the mouse using a realistic Bezier curve path and clicks at coordinates.
    *   `args`: `{"selector": "button.submit"}`
-   `snapshot`: Returns a simplified Accessibility Tree (AXTree) representing interactive page elements with references (like `@e1`, `@e2`).
-   `os_screenshot` / `os_click` / `hotkey`: Primary monitor screen capture, mouse click at absolute coordinates, or keyboard shortcuts (e.g. `["ctrl", "t"]`) via PowerShell on the OS level.
-   `scroll` / `hover` / `wait_for` / `wait_for_network_idle`: Adjusts view offsets, hovers cursor, or pauses script execution until criteria are met.

---

## 🧠 3. Workflow Implementation (The Hermes Way)

1.  **Verify Connection**: Test the connection with `/status`.
2.  **Fetch Selector YAML Rules**: Query `/sites/<domain>`. If selectors are found, use them directly to avoid DOM-dumping token overhead.
3.  **Perform Actions**: Use `click`, `fill`, and `mouse_click` actions.
4.  **Self-Healing Feedback**: If a selector fails, locate the element via `snapshot` (AXTree search) or local Gemini Nano. Perform the action, and then **proactively write the correction back to the YAML database** using `POST /sites/update`.
5.  **Clean Exit**: Close intermediate tabs with `close_tab`.
