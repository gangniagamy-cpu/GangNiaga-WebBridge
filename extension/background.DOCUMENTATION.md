// GangNiaga WebBridge - Background Service Worker v2.5.0
// This is a readable, maintainable version of the minified background.js.
// Original minified version preserved as background.min.js
//
// Architecture:
// - Daemon WebSocket connection management
// - Chrome Debugger Protocol (CDP) tool execution
// - Anti-bot safety checks & self-healing via Gemini Nano
// - End-to-end encryption (AES-256-GCM)
// - Tab management & grouping

// ═══════════════════════════════════════════════════════════════
// NOTE: This is a reference/documentation version.
// The MINIFIED background.js is the production version.
// To modify: edit minified source, test, then re-minify.
// ═══════════════════════════════════════════════════════════════

/\*
Key Components (from minified source):

1. STATE MANAGEMENT
   - attachedTabIds (Set): Tabs with CDP debugger attached
   - activeAttachedTabId: Currently CDP-attached tab
   - activeTabId: Currently active tab in window

2. CDP FUNCTIONS
   - attach(tabId): Attach Chrome Debugger to a tab
   - sendCDP(method, params): Send CDP command
   - getActiveTabId(): Get current active tab ID
   - getActiveTab(): Get full tab object
   - setActiveTabId(tabId): Set active tab reference
   - setAttachedTabId(tabId): Set attached tab reference
   - groupTab(tabId, session, title): Group tabs by session

3. SAFETY SYSTEM
   - isSensitiveAction(selector): Check if click/fill targets sensitive action
     - Checks selector keywords: pay, buy, checkout, submit, purchase, etc.
     - Checks page URL for sensitive paths
     - Deep DOM inspection of element properties

4. AI SELF-HEALING
   - trySelfHealingClick(selector): Use Gemini Nano to find closest element
   - trySelfHealingFill(selector, value): Use Gemini Nano for input healing
   - reportSelfHealing(domain, original, healed, index, tag): Persist healed selectors to daemon

5. ANTI-BOT AUTOPILOT
   - moveMouseHumanLike(targetX, targetY): Bézier curve mouse movement
   - getBezierPoints(x1,y1,x2,y2,steps): Generate human-like mouse path

6. E2EE ENCRYPTION
   - setCryptoSecret(secret): Derive AES-256-GCM key from SHA-256 hash
   - encryptPayload(obj): Encrypt with random IV, return {encrypted, data}
   - decryptPayload(obj): Decrypt, verify auth tag

7. CDP TOOLS (via debugger API)
   - navigate: Open URL in new tab or reload
   - click: DOM-level click via CDP
   - fill: React-compatible value setter + event dispatch
   - mouse_click: Human-like Bézier mouse movement + click
   - hover: Mouse hover at element coordinates
   - scroll: Page scroll by delta or to element
   - wait_for: Wait for element visibility / network idle
   - snapshot: Accessibility tree dump
   - screenshot: Page capture via CDP
   - evaluate: Execute JavaScript in page context
   - frame_switch: Switch CDP execution context
   - handle_dialog: Accept/dismiss JS dialogs
   - extract_text: Get page innerText
   - save_as_pdf: Print to PDF via CDP
   - upload: File input injection
   - network: Capture HTTP traffic (enable/list/detail/stop)
   - cdp: Raw CDP command passthrough
   - And 40+ more specialized tools...

8. WEBSOCKET PROTOCOL
   - Connection: ws://127.0.0.1:10087/ws
   - Hello handshake: {type:"hello", payload:{extensionVersion}}
   - Tool calls: {type:"tool_call", requestId, payload:{name, args}}
   - Results: {type:"tool_result", responseToRequestId, payload}
   - All encrypted when GANGNIAGA_SECRET is set

9. CONTENT SCRIPT MESSAGES (via chrome.runtime.sendMessage)
   - getDOMInfo: Page metadata, forms, inputs, images, links
   - extractImages: Image URLs and dimensions
   - extractText: Page text content
   - clickElement: Click by CSS selector
   - fillInput: Fill by selector with React compatibility
   - scrollTo: Scroll to coordinates
   - getPageStructure: Headings, sections, nav links
     \*/

// The production minified code is in background.js
// This file serves as documentation. To activate this version:
// 1. Copy background.js to background.min.js (backup)
// 2. Rename this file to background.js
// 3. Update manifest.json if needed
// 4. Reload extension in chrome://extensions

console.log('[GangNiaga] Reference documentation loaded. Production code is in background.min.js');
