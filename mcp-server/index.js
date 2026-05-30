#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "gangniaga-webbridge",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const WEBBRIDGE_URL = "http://127.0.0.1:10087";

// Read API Key from local authentication file (negotiates key automatically)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFilePath = path.join(__dirname, '../daemon/.webbridge-auth.json');
let apiKey = process.env.GANGNIAGA_API_KEY || null;

if (!apiKey && fs.existsSync(authFilePath)) {
  try {
    const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
    apiKey = authData.apiKey;
  } catch (e) {
    // Ignore JSON parse errors
  }
}

// Helper to make API calls to WebBridge Daemon
async function callWebBridge(endpoint, method = "GET", body = null) {
  const options = { method };
  options.headers = {};
  
  if (apiKey) {
    options.headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(`${WEBBRIDGE_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Define available tools to the LLM
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "browser_status",
        description: "Check if the GangNiaga WebBridge daemon and Chrome extension are running and connected.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_get_site_rules",
        description: "Fetch the YAML site knowledge base (selectors and recipes) for a specific domain (e.g. shopee.com.my). ALWAYS run this before interacting with a new website to avoid hallucinating selectors.",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Domain name, e.g. shopee.com.my" },
          },
          required: ["domain"],
        },
      },
      {
        name: "browser_navigate",
        description: "Navigate the browser to a specific URL. Can open in a new tab if newTab is true. Returns tabId.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to" },
            newTab: { type: "boolean", description: "Whether to open in a new tab (default: false)" },
            _session: { type: "string", description: "Optional session name for tab grouping" },
            group_title: { type: "string", description: "Optional tab group title color coding" },
          },
          required: ["url"],
        },
      },
      {
        name: "browser_snapshot",
        description: "Get the simplified Accessibility Tree (AXTree) of the current page. Returns elements with ref strings (like @e1) to be used with click/fill.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_click",
        description: "Click an element on the page using a CSS selector or ref string (e.g., '@e1'). Supports AI self-healing.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or @e ref" },
            _approved: { type: "boolean", description: "Set to true to bypass sensitive action warning if prompt asks to proceed with confirmation" },
          },
          required: ["selector"],
        },
      },
      {
        name: "browser_fill",
        description: "Fill an input field with text using a CSS selector or ref string. Supports AI self-healing.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or @e ref" },
            value: { type: "string", description: "Text value to fill" },
            _approved: { type: "boolean", description: "Set to true to bypass sensitive action warning if prompt asks to proceed with confirmation" },
          },
          required: ["selector", "value"],
        },
      },
      {
        name: "browser_mouse_click",
        description: "Move the mouse to an element using Bezier curve path and click it at the coordinates (simulates human movement to bypass anti-bots).",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or @e ref" },
            _approved: { type: "boolean", description: "Set to true to bypass sensitive action warning" },
          },
          required: ["selector"],
        },
      },
      {
        name: "browser_scroll",
        description: "Scroll the page. Can scroll by delta coordinates or scroll to a specific element.",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number", description: "Horizontal scroll offset" },
            y: { type: "number", description: "Vertical scroll offset" },
            selector: { type: "string", description: "Optional CSS selector to scroll into view" },
          },
        },
      },
      {
        name: "browser_hover",
        description: "Hover mouse over an element on the page.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or @e ref" },
          },
          required: ["selector"],
        },
      },
      {
        name: "browser_wait_for",
        description: "Wait for a condition to be met (element visible, network idle, or time delay).",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Optional CSS selector to wait for" },
            timeout: { type: "number", description: "Timeout in milliseconds" },
            state: { type: "string", description: "Optional state to wait for: visible, hidden, detached" },
          },
        },
      },
      {
        name: "browser_screenshot",
        description: "Capture a screenshot of the current page and save it locally.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Local path to save the screenshot" },
          },
          required: ["path"],
        },
      },
      {
        name: "browser_close_tab",
        description: "Close a specific browser tab.",
        inputSchema: {
          type: "object",
          properties: {
            tabId: { type: "number", description: "Tab ID to close" },
          },
          required: ["tabId"],
        },
      },
      {
        name: "browser_list_tabs",
        description: "List all open browser tabs and their titles/URLs.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_evaluate",
        description: "Execute custom Javascript on the active page and get the returned result.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Javascript expression to execute" },
          },
          required: ["code"],
        },
      },
      {
        name: "os_click",
        description: "Perform an OS-level mouse click at exact screen coordinates (x, y) via PowerShell.",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number", description: "Screen X coordinate" },
            y: { type: "number", description: "Screen Y coordinate" },
          },
          required: ["x", "y"],
        },
      },
      {
        name: "os_screenshot",
        description: "Capture a full screenshot of the primary monitor using OS APIs and save it locally.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path to save screenshot (e.g. C:\\temp\\screen.png)" },
          },
          required: ["path"],
        },
      },
      {
        name: "os_hotkey",
        description: "Press a keyboard shortcut/hotkey combination (e.g. ['ctrl', 't'] or ['alt', 'tab']).",
        inputSchema: {
          type: "object",
          properties: {
            keys: { type: "array", items: { type: "string" }, description: "Array of key strings, e.g., ['ctrl', 'shift', 't']" },
          },
          required: ["keys"],
        },
      },
      {
        name: "browser_key_type",
        description: "Simulate typing a text string character-by-character with random human-like delays and occasional self-correcting typos.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to type" },
          },
          required: ["text"],
        },
      },
      {
        name: "browser_send_keys",
        description: "Send modifier keys and special key sequences (e.g. 'Control+a', 'Enter', 'Escape') to the browser page.",
        inputSchema: {
          type: "object",
          properties: {
            keys: { type: "string", description: "Key sequence or combination, e.g., 'Control+a' or 'Enter'" },
          },
          required: ["keys"],
        },
      },
      {
        name: "browser_extract_text",
        description: "Extract the inner text content from the active page body.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_save_as_pdf",
        description: "Save the current webpage layout as a PDF file on the host.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

// Handle LLM Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "browser_status") {
      const data = await callWebBridge("/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "browser_get_site_rules") {
      const data = await callWebBridge(`/sites/${args.domain}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // Proxy browser tool calls directly to the WebBridge POST /command endpoint
    if (name.startsWith("browser_")) {
      const actionName = name.replace("browser_", "");
      const payload = { action: actionName, args: args || {} };
      const data = await callWebBridge("/command", "POST", payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // Proxy OS-level actions to the daemon which resolves them natively
    if (name.startsWith("os_")) {
      let actionName = name;
      if (name === "os_hotkey") actionName = "hotkey"; // Map to daemon's 'hotkey' action
      const payload = { action: actionName, args: args || {} };
      const data = await callWebBridge("/command", "POST", payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GangNiaga MCP Server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
