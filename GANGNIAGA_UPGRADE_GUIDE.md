# 🚀 GangNiaga WebBridge - Complete Upgrade Implementation Guide

> **Version:** 2.0.0  
> **Last Updated:** 2026-05-30  
> **Author:** Implementation Guide for GangNiaga WebBridge

---

## 📋 Table of Contents

1. [Phase 1: Security Hardening](#phase-1-security-hardening)
2. [Phase 2: Core Enhancements](#phase-2-core-enhancements)
3. [Phase 3: AI Integration](#phase-3-ai-integration)
4. [Phase 4: Advanced Features](#phase-4-advanced-features)
5. [Phase 5: Polish & Production](#phase-5-polish--production)
6. [Testing Strategy](#testing-strategy)
7. [Migration Guide](#migration-guide)
8. [Deployment Checklist](#deployment-checklist)

---

## 🎯 Phase 1: Security Hardening (Week 1-2)

### 1.1 Localhost Binding + Token Authentication

**File:** `daemon/gangniaga-daemon.js`

```javascript
// Add at top of file
const crypto = require('crypto');

// Generate secure token on startup
const AUTH_TOKEN = process.env.GANGNIAGA_TOKEN || crypto.randomBytes(32).toString('hex');
console.log(`[SECURITY] Auth Token: ${AUTH_TOKEN.substring(0, 8)}...`);

// Modify server.listen to bind localhost only
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[OK] Daemon listening on 127.0.0.1:${PORT}`);
});

// Add authentication middleware BEFORE all routes
function authenticateRequest(req, res, next) {
  const token = req.headers['x-gangniaga-token'];
  
  if (!token) {
    console.warn(`[SECURITY] Request without token from ${req.socket.remoteAddress}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }
  
  if (token !== AUTH_TOKEN) {
    console.warn(`[SECURITY] Invalid token attempt from ${req.socket.remoteAddress}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid authentication token' }));
    return;
  }
  
  next();
}

// Apply to all command endpoints
if (req.method === 'POST' && req.url === '/command') {
  authenticateRequest(req, res, () => {
    // Existing command handling logic
  });
}
```

**Environment Setup:**
```bash
# .env file
GANGNIAGA_TOKEN=your-secure-random-token-here
GANGNIAGA_SECRET=your-encryption-key-for-e2ee
```

### 1.2 Command Allowlist (Whitelist Mode)

**File:** `daemon/gangniaga-daemon.js`

```javascript
// Define allowed actions
const ALLOWED_ACTIONS = new Set([
  'navigate',
  'evaluate',
  'click',
  'type',
  'scroll',
  'screenshot',
  'os_screenshot',
  'os_click',
  'os_hotkey',
  'get_tabs',
  'close_tab'
]);

// Add validation in command handler
function handleCommand(req, res, body) {
  const { action, args } = body;
  
  // Validate action
  if (!ALLOWED_ACTIONS.has(action)) {
    console.error(`[SECURITY] Blocked unauthorized action: ${action}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Action not whitelisted',
      allowed: Array.from(ALLOWED_ACTIONS)
    }));
    return;
  }
  
  // Validate args structure
  if (!args || typeof args !== 'object') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid arguments' }));
    return;
  }
  
  // Continue with command execution
  executeCommand(action, args, res);
}
```

### 1.3 Content Security Policy for Extension

**File:** `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "GangNiaga WebBridge",
  "version": "2.0.0",
  "description": "AI Agent Browser Bridge",
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' http://127.0.0.1:10087",
    "sandbox": "sandbox allow-scripts; script-src 'self' 'wasm-unsafe-eval'; child-src 'self'"
  },
  
  "permissions": [
    "tabs",
    "debugger",
    "nativeMessaging",
    "scripting",
    "cookies",
    "storage"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ]
}
```

### 1.4 Rate Limiting

**File:** `daemon/gangniaga-daemon.js`

```javascript
// Simple in-memory rate limiter
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  check(clientId) {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside window
    const validRequests = clientRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false; // Rate limited
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }
}

const rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute

// Apply rate limiting
function rateLimitMiddleware(req, res, next) {
  const clientId = req.headers['x-gangniaga-token'] || req.socket.remoteAddress;
  
  if (!rateLimiter.check(clientId)) {
    console.warn(`[SECURITY] Rate limit exceeded for ${clientId}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: 60
    }));
    return;
  }
  
  next();
}
```

### 1.5 Input Validation & Sanitization

**File:** `daemon/utils/validator.js` (new file)

```javascript
const validator = {
  // Validate URL
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  },
  
  // Validate CSS selector (basic check)
  isValidSelector(selector) {
    if (typeof selector !== 'string') return false;
    if (selector.length > 500) return false;
    
    // Block dangerous patterns
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'expression('];
    return !dangerous.some(d => selector.toLowerCase().includes(d));
  },
  
  // Validate JavaScript code (basic safety checks)
  isValidCode(code) {
    if (typeof code !== 'string') return false;
    if (code.length > 50000) return false; // 50KB limit
    
    // Block obviously dangerous patterns
    const dangerous = [
      'document.cookie', // Prevent cookie theft
      'localStorage',    // Prevent storage access
      'sessionStorage',
      'window.opener',
      'eval(',
      'Function(',
      'importScripts'
    ];
    
    return !dangerous.some(d => code.includes(d));
  },
  
  // Validate tab ID
  isValidTabId(tabId) {
    return Number.isInteger(tabId) && tabId > 0;
  },
  
  // Validate coordinates
  isValidCoordinate(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && 
           x >= 0 && y >= 0 && x < 10000 && y < 10000;
  }
};

module.exports = validator;
```

**Usage in daemon:**
```javascript
const validator = require('./utils/validator');

// In command handler
if (action === 'navigate') {
  if (!validator.isValidUrl(args.url)) {
    return sendError(res, 'Invalid URL');
  }
}

if (action === 'evaluate') {
  if (!validator.isValidTabId(args._tabId)) {
    return sendError(res, 'Invalid tab ID');
  }
  if (!validator.isValidCode(args.code)) {
    return sendError(res, 'Invalid or unsafe code');
  }
}
```

---

## ⚡ Phase 2: Core Enhancements (Week 3-4)

### 2.1 Network Interception & Replay

**File:** `daemon/tools/network-intercept.js` (new file)

```javascript
const { chrome } = require('../chrome-debugger');

class NetworkInterceptor {
  constructor() {
    this.interceptors = new Map();
    this.logs = [];
  }
  
  async enable(tabId) {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (source.tabId === tabId) {
        this.handleNetworkEvent(tabId, method, params);
      }
    });
  }
  
  async intercept(tabId, urlPattern, options = {}) {
    const interceptor = {
      urlPattern: new RegExp(urlPattern),
      action: options.action || 'log', // log, block, modify
      responseOverride: options.responseOverride,
      headersOverride: options.headersOverride,
      callback: options.callback
    };
    
    const key = `${tabId}:${urlPattern}`;
    this.interceptors.set(key, interceptor);
    
    return { success: true, key };
  }
  
  async handleNetworkEvent(tabId, method, params) {
    if (method === 'Network.requestWillBeSent') {
      const url = params.request.url;
      
      for (const [key, interceptor] of this.interceptors) {
        if (interceptor.urlPattern.test(url)) {
          console.log(`[NETWORK] Intercepted: ${url}`);
          
          if (interceptor.action === 'log') {
            this.logs.push({
              timestamp: Date.now(),
              tabId,
              url,
              method: params.request.method,
              headers: params.request.headers
            });
          }
          
          if (interceptor.action === 'block') {
            await chrome.debugger.sendCommand({ tabId }, 'Network.cancelRequest', {
              requestId: params.requestId
            });
          }
          
          if (interceptor.callback) {
            await interceptor.callback(params);
          }
        }
      }
    }
    
    if (method === 'Network.responseReceived') {
      // Log responses
      this.logs.push({
        timestamp: Date.now(),
        tabId,
        url: params.response.url,
        status: params.response.status,
        headers: params.response.headers
      });
    }
  }
  
  getLogs(tabId = null) {
    if (tabId) {
      return this.logs.filter(log => log.tabId === tabId);
    }
    return this.logs;
  }
  
  clearLogs() {
    this.logs = [];
  }
}

module.exports = new NetworkInterceptor();
```

**MCP Tool Definition:**
```javascript
// mcp-server/index.js
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ... existing tools
      {
        name: 'network_intercept',
        description: 'Intercept and modify network requests',
        inputSchema: {
          type: 'object',
          properties: {
            _tabId: { type: 'number' },
            url_pattern: { type: 'string', description: 'Regex pattern for URL matching' },
            action: { 
              type: 'string', 
              enum: ['log', 'block', 'modify'],
              default: 'log'
            },
            response_override: { type: 'string', description: 'Custom response body' },
            headers_override: { type: 'object', description: 'Custom response headers' }
          },
          required: ['_tabId', 'url_pattern']
        }
      },
      {
        name: 'network_logs',
        description: 'Get network request logs',
        inputSchema: {
          type: 'object',
          properties: {
            _tabId: { type: 'number' },
            limit: { type: 'number', default: 100 }
          }
        }
      }
    ]
  };
});
```

### 2.2 Visual Regression Testing

**File:** `daemon/tools/visual-diff.js` (new file)

```javascript
const fs = require('fs').promises;
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

class VisualDiffTool {
  constructor() {
    this.baselinePath = path.join(__dirname, '../baselines');
  }
  
  async ensureBaselineDir() {
    try {
      await fs.mkdir(this.baselinePath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  
  async saveBaseline(name, screenshotBuffer) {
    await this.ensureBaselineDir();
    const filePath = path.join(this.baselinePath, `${name}.png`);
    await fs.writeFile(filePath, screenshotBuffer);
    return { success: true, path: filePath };
  }
  
  async compare(name, currentBuffer, threshold = 0.05) {
    await this.ensureBaselineDir();
    const baselinePath = path.join(this.baselinePath, `${name}.png`);
    
    try {
      const baselineBuffer = await fs.readFile(baselinePath);
      
      const baseline = PNG.sync.read(baselineBuffer);
      const current = PNG.sync.read(currentBuffer);
      
      // Check dimensions
      if (baseline.width !== current.width || baseline.height !== current.height) {
        return {
          match: false,
          error: 'Dimension mismatch',
          baselineSize: { width: baseline.width, height: baseline.height },
          currentSize: { width: current.width, height: current.height }
        };
      }
      
      const diff = new PNG({ width: baseline.width, height: baseline.height });
      
      const numDiffPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        baseline.width,
        baseline.height,
        { threshold: 0.1 }
      );
      
      const totalPixels = baseline.width * baseline.height;
      const diffPercent = numDiffPixels / totalPixels;
      
      // Save diff image
      const diffPath = path.join(this.baselinePath, `${name}_diff.png`);
      await fs.writeFile(diffPath, PNG.sync.write(diff));
      
      return {
        match: diffPercent < threshold,
        diffPercent: (diffPercent * 100).toFixed(2) + '%',
        diffPixels: numDiffPixels,
        totalPixels,
        threshold: (threshold * 100).toFixed(2) + '%',
        diffImage: diffPath
      };
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {
          match: false,
          error: 'Baseline not found',
          suggestion: `Run save_baseline with name "${name}" first`
        };
      }
      throw err;
    }
  }
}

module.exports = new VisualDiffTool();
```

**MCP Tool Definition:**
```javascript
{
  name: 'visual_save_baseline',
  description: 'Save current screenshot as baseline for comparison',
  inputSchema: {
    type: 'object',
    properties: {
      _tabId: { type: 'number' },
      name: { type: 'string', description: 'Baseline name (e.g., "login_page")' }
    },
    required: ['_tabId', 'name']
  }
},
{
  name: 'visual_diff',
  description: 'Compare current screenshot with baseline',
  inputSchema: {
    type: 'object',
    properties: {
      _tabId: { type: 'number' },
      name: { type: 'string', description: 'Baseline name to compare against' },
      threshold: { type: 'number', default: 0.05, description: 'Acceptable diff percentage (0-1)' }
    },
    required: ['_tabId', 'name']
  }
}
```

### 2.3 Session Vault (Encrypted Cookie Storage)

**File:** `daemon/tools/session-vault.js` (new file)

```javascript
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class SessionVault {
  constructor() {
    this.vaultPath = path.join(os.homedir(), '.gangniaga', 'vault');
    this.encryptionKey = process.env.GANGNIAGA_SECRET || null;
  }
  
  async ensureVaultDir() {
    try {
      await fs.mkdir(this.vaultPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  
  encrypt(text) {
    if (!this.encryptionKey) {
      throw new Error('GANGNIAGA_SECRET environment variable not set');
    }
    
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('GANGNIAGA_SECRET environment variable not set');
    }
    
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  async save(name, tabId) {
    await this.ensureVaultDir();
    
    // Get cookies
    const cookies = await chrome.cookies.getAll({});
    
    // Get localStorage and sessionStorage
    const storageData = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          localStorage: JSON.stringify(localStorage),
          sessionStorage: JSON.stringify(sessionStorage)
        };
      }
    });
    
    const session = {
      version: 1,
      timestamp: Date.now(),
      cookies,
      localStorage: storageData[0].result.localStorage,
      sessionStorage: storageData[0].result.sessionStorage
    };
    
    const sessionJson = JSON.stringify(session);
    const encrypted = this.encrypt(sessionJson);
    
    const filePath = path.join(this.vaultPath, `${name}.vault`);
    await fs.writeFile(filePath, JSON.stringify(encrypted));
    
    return {
      success: true,
      path: filePath,
      cookieCount: cookies.length,
      timestamp: new Date(session.timestamp).toISOString()
    };
  }
  
  async load(name, tabId) {
    await this.ensureVaultDir();
    
    const filePath = path.join(this.vaultPath, `${name}.vault`);
    
    try {
      const encryptedJson = await fs.readFile(filePath, 'utf8');
      const encrypted = JSON.parse(encryptedJson);
      const decrypted = this.decrypt(encrypted);
      const session = JSON.parse(decrypted);
      
      // Restore cookies
      for (const cookie of session.cookies) {
        try {
          await chrome.cookies.set({
            url: `https://${cookie.domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate
          });
        } catch (err) {
          console.warn(`[VAULT] Failed to restore cookie ${cookie.name}:`, err.message);
        }
      }
      
      // Restore localStorage and sessionStorage
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (localStorageData, sessionStorageData) => {
          const ls = JSON.parse(localStorageData);
          const ss = JSON.parse(sessionStorageData);
          
          localStorage.clear();
          Object.assign(localStorage, ls);
          
          sessionStorage.clear();
          Object.assign(sessionStorage, ss);
        },
        args: [session.localStorage, session.sessionStorage]
      });
      
      return {
        success: true,
        cookieCount: session.cookies.length,
        savedAt: new Date(session.timestamp).toISOString()
      };
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { error: 'Session not found', name };
      }
      throw err;
    }
  }
  
  async list() {
    await this.ensureVaultDir();
    
    try {
      const files = await fs.readdir(this.vaultPath);
      const vaultFiles = files.filter(f => f.endsWith('.vault'));
      
      const sessions = [];
      for (const file of vaultFiles) {
        try {
          const encryptedJson = await fs.readFile(path.join(this.vaultPath, file), 'utf8');
          const encrypted = JSON.parse(encryptedJson);
          const decrypted = this.decrypt(encrypted);
          const session = JSON.parse(decrypted);
          
          sessions.push({
            name: file.replace('.vault', ''),
            timestamp: new Date(session.timestamp).toISOString(),
            cookieCount: session.cookies.length
          });
        } catch (err) {
          console.warn(`[VAULT] Failed to read ${file}:`, err.message);
        }
      }
      
      return { sessions };
      
    } catch (err) {
      return { sessions: [], error: err.message };
    }
  }
  
  async delete(name) {
    const filePath = path.join(this.vaultPath, `${name}.vault`);
    
    try {
      await fs.unlink(filePath);
      return { success: true, name };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { error: 'Session not found', name };
      }
      throw err;
    }
  }
}

module.exports = new SessionVault();
```

**MCP Tool Definitions:**
```javascript
{
  name: 'session_save',
  description: 'Save current session (cookies, localStorage, sessionStorage) to encrypted vault',
  inputSchema: {
    type: 'object',
    properties: {
      _tabId: { type: 'number' },
      name: { type: 'string', description: 'Session name (e.g., "gmail_login")' }
    },
    required: ['_tabId', 'name']
  }
},
{
  name: 'session_load',
  description: 'Load saved session into current tab',
  inputSchema: {
    type: 'object',
    properties: {
      _tabId: { type: 'number' },
      name: { type: 'string', description: 'Session name to load' }
    },
    required: ['_tabId', 'name']
  }
},
{
  name: 'session_list',
  description: 'List all saved sessions',
  inputSchema: {
    type: 'object',
    properties: {}
  }
},
{
  name: 'session_delete',
  description: 'Delete a saved session',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Session name to delete' }
    },
    required: ['name']
  }
}
```

### 2.4 Shadow DOM Traversal

**File:** `daemon/tools/shadow-query.js` (new file)

```javascript
const { chrome } = require('../chrome-debugger');

class ShadowQueryTool {
  async query(tabId, selector, deep = true) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel, deepTraversal) => {
        const results = [];
        
        function traverse(node) {
          // Check shadow root
          if (node.shadowRoot) {
            const matches = node.shadowRoot.querySelectorAll(sel);
            matches.forEach(el => {
              results.push({
                tag: el.tagName.toLowerCase(),
                id: el.id,
                classes: Array.from(el.classList),
                text: el.textContent.substring(0, 100),
                inShadow: true,
                hostTag: node.tagName.toLowerCase()
              });
            });
            
            // Recursively traverse shadow DOM
            if (deepTraversal) {
              node.shadowRoot.querySelectorAll('*').forEach(traverse);
            }
          }
          
          // Traverse children
          node.querySelectorAll('*').forEach(child => {
            if (child.shadowRoot) {
              traverse(child);
            }
          });
        }
        
        // Start from document root
        traverse(document.documentElement);
        
        // Also query light DOM
        const lightMatches = document.querySelectorAll(sel);
        lightMatches.forEach(el => {
          results.push({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            classes: Array.from(el.classList),
            text: el.textContent.substring(0, 100),
            inShadow: false
          });
        });
        
        return results;
      },
      args: [selector, deep]
    });
    
    return {
      selector,
      count: results[0].result.length,
      elements: results[0].result
    };
  }
}

module.exports = new ShadowQueryTool();
```

**MCP Tool Definition:**
```javascript
{
  name: 'shadow_query',
  description: 'Query elements including those inside Shadow DOM',
  inputSchema: {
    type: 'object',
    properties: {
      _tabId: { type: 'number' },
      selector: { type: 'string', description: 'CSS selector to search for' },
      deep: { type: 'boolean', default: true, description: 'Recursively traverse nested shadow DOMs' }
    },
    required: ['_tabId', 'selector']
  }
}
```

### 2.5 Canvas/WebGL Fingerprint Protection

*Note: Handled on the browser side via the Cognitive Decoy and Fingerprint Shield script in [extension/shield.js](file:///D:/GangNiaga-WebBridge/extension/shield.js).*

---

## 🧠 Phase 3: AI Integration (Week 5-6)

### 3.1 Vision-Based Self-Healing Selectors

**File:** `daemon/ai/vision-healer.js` (new file)

```javascript
const ollama = require('ollama');

class VisionHealer {
  constructor() {
    this.model = process.env.VISION_MODEL || 'llava:13b';
  }
  
  async healSelector(tabId, failedSelector, description) {
    // Take screenshot
    const screenshot = await this.takeScreenshot(tabId);
    
    // Convert to base64
    const base64Image = screenshot.toString('base64');
    
    // Ask vision model to find the element
    const prompt = `Look at this webpage screenshot. I need to find an element that matches this description: "${description}"
    
The original CSS selector "${failedSelector}" is no longer working.

Please identify the element and return a new CSS selector that will reliably find it. Return ONLY the CSS selector, nothing else.

Example responses:
- button#submit-form
- .login-button.primary
- div[data-testid="checkout-btn"]`;

    try {
      const response = await ollama.chat({
        model: this.model,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64Image]
        }]
      });
      
      const newSelector = response.message.content.trim();
      
      // Validate the new selector
      const isValid = await this.validateSelector(tabId, newSelector);
      
      if (isValid) {
        return {
          success: true,
          originalSelector: failedSelector,
          newSelector,
          description,
          confidence: 'high'
        };
      } else {
        return {
          success: false,
          error: 'Generated selector is invalid',
          generatedSelector: newSelector
        };
      }
      
    } catch (err) {
      return {
        success: false,
        error: 'Vision model failed',
        details: err.message
      };
    }
  }
  
  async takeScreenshot(tabId) {
    const { chrome } = require('../chrome-debugger');
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });
    
    // Convert data URL to buffer
    const base64 = screenshot.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
  
  async validateSelector(tabId, selector) {
    const { chrome } = require('../chrome-debugger');
    
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel) => {
          try {
            const elements = document.querySelectorAll(sel);
            return elements.length > 0;
          } catch {
            return false;
          }
        },
        args: [selector]
      });
      
      return result[0].result;
    } catch {
      return false;
    }
  }
}

module.exports = new VisionHealer();
```

### 3.2 Local RAG for Site Knowledge

**File:** `daemon/ai/site-knowledge-rag.js` (new file)

```javascript
const { ChromaClient } = require('chromadb');
const ollama = require('ollama');
const path = require('path');
const fs = require('fs').promises;

class SiteKnowledgeRAG {
  constructor() {
    this.client = null;
    this.collection = null;
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  }
  
  async init() {
    if (this.client) return;
    
    this.client = new ChromaClient({
      path: 'http://localhost:8000'
    });
    
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: 'site_knowledge',
        metadata: { description: 'Website element knowledge' }
      });
    } catch (err) {
      console.error('[RAG] Failed to initialize ChromaDB:', err.message);
      throw err;
    }
  }
  
  async generateEmbedding(text) {
    const response = await ollama.embed({
      model: this.embeddingModel,
      input: text
    });
    return response.embeddings[0];
  }
  
  async indexElement(url, selector, description, metadata = {}) {
    await this.init();
    
    const document = `${url} | ${selector} | ${description}`;
    const embedding = await this.generateEmbedding(document);
    
    const id = `${url}:${selector}:${Date.now()}`;
    
    await this.collection.add({
      ids: [id],
      documents: [document],
      embeddings: [embedding],
      metadatas: [{
        url,
        selector,
        description,
        timestamp: Date.now(),
        ...metadata
      }]
    });
    
    return { success: true, id };
  }
}

module.exports = new SiteKnowledgeRAG();
```

### 3.3 Multi-Agent Orchestration

**File:** `daemon/ai/agent-orchestrator.js` (new file)

```javascript
const crypto = require('crypto');
const EventEmitter = require('events');

class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.messageBus = new EventEmitter();
  }
  
  async spawnAgent(name, capabilities = []) {
    const agentId = crypto.randomUUID();
    
    const agent = {
      id: agentId,
      name,
      capabilities,
      status: 'idle',
      createdAt: Date.now()
    };
    
    this.agents.set(agentId, agent);
    
    this.emit('agent_spawned', { agentId, name });
    return agent;
  }
}

module.exports = new AgentOrchestrator();
```

---

## 🏗️ Phase 4: Advanced Features (Week 7-8)

### 4.1 Workflow Recorder & Replay

**File:** `daemon/tools/workflow-recorder.js` (new file)

```javascript
const fs = require('fs').promises;
const path = require('path');
const { chrome } = require('../chrome-debugger');

class WorkflowRecorder {
  constructor() {
    this.recordings = new Map();
  }
  
  async start(tabId, name) {
    const recordingId = `${name}_${Date.now()}`;
    
    const recording = {
      id: recordingId,
      name,
      tabId,
      startTime: Date.now(),
      actions: []
    };
    
    this.recordings.set(recordingId, recording);
    
    // Inject recorder script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (recId) => {
        window.__gangniaga_recording = {
          id: recId,
          actions: []
        };
        
        function getSelector(el) {
          if (el.id) return `#${el.id}`;
          if (el.className) {
            const classes = Array.from(el.classList).join('.');
            return `.${classes}`;
          }
          return el.tagName.toLowerCase();
        }
        
        document.addEventListener('click', (e) => {
          const action = {
            type: 'click',
            selector: getSelector(e.target),
            timestamp: Date.now(),
            x: e.clientX,
            y: e.clientY
          };
          window.__gangniaga_recording.actions.push(action);
        }, true);
      },
      args: [recordingId]
    });
    
    return { success: true, recordingId };
  }
}

module.exports = new WorkflowRecorder();
```

---

## 🔬 Testing Strategy

1. **Unit Tests:** Run mocha/jest on helper tools (`session-vault`, `validator`, `shadow-query`).
2. **Integration Tests:** Test connection between daemon and extension under authentication.
3. **Anti-Bot Benchmarking:** Benchmark against CreepJS and Pixelscan to verify fingerprint spoofing.

---

## 🚀 Deployment Checklist

- [ ] Configure `GANGNIAGA_TOKEN` and `GANGNIAGA_SECRET` in production `.env`
- [ ] Run `npm prune --production` before packaging
- [ ] Ensure local Chrome components are fully updated for Gemini Nano
- [ ] Lock down WebSocket port origins to Extension ID only
