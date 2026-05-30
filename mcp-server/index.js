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
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const WEBBRIDGE_URL = "http://127.0.0.1:10087";

// Helper to make API calls to WebBridge Daemon
async function callWebBridge(endpoint, method = "GET", body = null) {
  const options = { method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
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
        description: "Check if the GangNiaga WebBridge is running and connected to Chrome.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_get_site_rules",
        description: "Fetch the YAML site knowledge base (selectors and recipes) for a specific domain (e.g. shopee.com.my). ALWAYS use this before interacting with a new site.",
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
        description: "Open a URL in a new Chrome tab. Returns the tabId which you MUST use for subsequent commands.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to" },
          },
          required: ["url"],
        },
      },
      {
        name: "browser_evaluate",
        description: "Execute Javascript in a specific tab. Use this to click buttons or fill inputs based on the site rules.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Javascript code to execute. MUST return a value." },
            tabId: { type: "number", description: "The tabId to execute the code in (obtained from browser_navigate)." },
          },
          required: ["code", "tabId"],
        },
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

    if (name === "browser_navigate") {
      const payload = { action: "navigate", args: { url: args.url } };
      const data = await callWebBridge("/command", "POST", payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "browser_evaluate") {
      const payload = { action: "evaluate", args: { code: args.code, _tabId: args.tabId } };
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
