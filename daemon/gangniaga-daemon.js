// GangNiaga WebBridge Daemon v2.0
// Serves port 10087: HTTP POST /command and WebSocket ws://127.0.0.1:10087/ws
// Supports OS-level automation (via PowerShell) and proxies DOM-level actions to the Chrome Extension

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = 10087;

// E2EE secret key can be set via env variable GANGNIAGA_SECRET
const SECRET_KEY = process.env.GANGNIAGA_SECRET || null;

class E2EETunnel {
  constructor(secretKey) {
    this.key = crypto.createHash('sha256').update(secretKey).digest();
  }

  encrypt(obj) {
    try {
      const plainText = JSON.stringify(obj);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      let ciphertext = cipher.update(plainText);
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([iv, ciphertext, tag]);
      return { encrypted: true, data: combined.toString('base64') };
    } catch (err) {
      console.error('[crypto] encrypt failed:', err);
      return obj;
    }
  }

  decrypt(obj) {
    if (!obj || !obj.encrypted || !obj.data) return obj;
    try {
      const combined = Buffer.from(obj.data, 'base64');
      const iv = combined.subarray(0, 12);
      const tag = combined.subarray(combined.length - 16);
      const ciphertext = combined.subarray(12, combined.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (err) {
      console.error('[crypto] decrypt failed:', err);
      throw Error('Decryption failed. Check secret key.');
    }
  }
}

const tunnel = SECRET_KEY ? new E2EETunnel(SECRET_KEY) : null;

// Track active extension connection & controller connections
let extensionSocket = null;
const controllers = new Set();

// Track pending HTTP and WebSocket requests
const pendingHttpRequests = new Map(); // requestId -> HTTP response object
const pendingWsRequests = new Map();   // requestId -> Controller socket object

// Native Messaging state
let isNative = process.argv.includes('--native');
if (isNative) {
  // CRITICAL: Redirect all console output to stderr to avoid corrupting Native Messaging stdout
  const fs = require('fs');
  const util = require('util');
  const logFile = fs.createWriteStream(__dirname + '/daemon-native.log', { flags: 'a' });
  const log = (prefix, args) => {
    const msg = util.format.apply(null, args) + '\n';
    process.stderr.write(prefix + msg);
    logFile.write(prefix + msg);
  };
  console.log = (...args) => log('[LOG] ', args);
  console.info = (...args) => log('[INFO] ', args);
  console.warn = (...args) => log('[WARN] ', args);
  console.error = (...args) => log('[ERROR] ', args);
  console.debug = (...args) => log('[DEBUG] ', args);

  extensionSocket = {
    readyState: WebSocket.OPEN || 1,
    send: (msg) => {
      const buf = Buffer.from(msg, 'utf8');
      const header = Buffer.alloc(4);
      header.writeUInt32LE(buf.length, 0);
      process.stdout.write(header);
      process.stdout.write(buf);
    },
    close: () => {
      process.exit(0);
    }
  };
}

// Key mapping helper for SendKeys
function keysToSendKeys(keys) {
  let result = '';
  let hasCtrl = false;
  let hasShift = false;
  let hasAlt = false;

  for (let key of keys) {
    let k = key.toLowerCase();
    if (k === 'ctrl' || k === 'control') hasCtrl = true;
    else if (k === 'shift') hasShift = true;
    else if (k === 'alt') hasAlt = true;
    else {
      let char = k;
      if (char.length === 1) {
        result += char;
      } else {
        if (char === 'enter') result += '{ENTER}';
        else if (char === 'escape' || char === 'esc') result += '{ESC}';
        else if (char === 'tab') result += '{TAB}';
      }
    }
  }

  let prefix = '';
  if (hasCtrl) prefix += '^';
  if (hasShift) prefix += '+';
  if (hasAlt) prefix += '%';
  return prefix + (result.length > 1 ? `(${result})` : result);
}

// Run PowerShell commands via Base64 Encoded Command
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(script, 'utf16le');
    const base64 = buffer.toString('base64');
    const cmd = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${base64}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Perform OS screenshot
async function handleOsScreenshot(path) {
  const safePath = path.replace(/\//g, '\\');
  const script = `
    [Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
    [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)
    $dir = Split-Path -Path '${safePath}'
    if (!(Test-Path -Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bmp.Save('${safePath}')
    $graphics.Dispose()
    $bmp.Dispose()
    Write-Output "Screenshot saved to ${safePath}"
  `;
  return await runPowerShell(script);
}

// Perform OS click
async function handleOsClick(x, y) {
  const script = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, uint dwExtraInfo);
    }
    "@ | Out-Null
    [Win32]::SetCursorPos(${x}, ${y})
    Start-Sleep -Milliseconds 50
    [Win32]::mouse_event(0x0002, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 50
    [Win32]::mouse_event(0x0004, 0, 0, 0, 0)
    Write-Output "Clicked at ${x}, ${y}"
  `;
  return await runPowerShell(script);
}

// Perform OS hotkey
async function handleHotkey(keys) {
  const sendKeyStr = keysToSendKeys(keys);
  const script = `
    [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
    [System.Windows.Forms.SendKeys]::SendWait('${sendKeyStr}')
    Write-Output "Sent keys: ${sendKeyStr}"
  `;
  return await runPowerShell(script);
}

// Process action request (either OS-level or routes to Browser Extension)
async function processAction(action, args, onResult) {
  const actionLower = action.toLowerCase();
  
  if (actionLower === 'os_screenshot') {
    try {
      const res = await handleOsScreenshot(args.path);
      onResult({ success: true, message: res });
    } catch (err) {
      onResult({ success: false, error: err.message });
    }
  } else if (actionLower === 'os_click') {
    try {
      const res = await handleOsClick(args.x, args.y);
      onResult({ success: true, message: res });
    } catch (err) {
      onResult({ success: false, error: err.message });
    }
  } else if (actionLower === 'hotkey') {
    try {
      const res = await handleHotkey(args.keys);
      onResult({ success: true, message: res });
    } catch (err) {
      onResult({ success: false, error: err.message });
    }
  } else {
    // Browser DOM command: Send to extension
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      onResult({ success: false, error: 'Chrome extension not connected to daemon.' });
      return;
    }

    const requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const toolCall = {
      type: 'tool_call',
      requestId: requestId,
      payload: {
        name: action,
        args: args
      }
    };

    // Store callback
    const timeout = setTimeout(() => {
      if (pendingHttpRequests.has(requestId)) {
        pendingHttpRequests.delete(requestId);
        onResult({ success: false, error: 'Command execution timed out.' });
      }
    }, 30000);

    pendingHttpRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timeout);
        onResult(data);
      }
    });

    const encryptedPayload = tunnel ? tunnel.encrypt(toolCall) : toolCall;
    extensionSocket.send(JSON.stringify(encryptedPayload));
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      running: true,
      extension_connected: !!(extensionSocket && extensionSocket.readyState === (WebSocket.OPEN || 1)),
      version: "1.0",
      uptime_seconds: process.uptime()
    }));
    return;
  }

  // Phase 3: Sites Knowledge API
  if (req.method === 'GET' && req.url.startsWith('/sites')) {
    const fs = require('fs');
    const path = require('path');
    const sitesDir = path.join(__dirname, 'sites');
    
    if (req.url === '/sites' || req.url === '/sites/') {
      // List all sites
      try {
        if (!fs.existsSync(sitesDir)) fs.mkdirSync(sitesDir);
        const files = fs.readdirSync(sitesDir).filter(f => f.endsWith('.yaml'));
        const domains = files.map(f => f.replace('.yaml', ''));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, domains }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
      return;
    } else {
      // Get specific site
      const domain = req.url.split('/')[2];
      if (domain) {
        const filePath = path.join(sitesDir, `${domain}.yaml`);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, domain, yaml: content }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Site knowledge not found' }));
        }
        return;
      }
    }
  }

  if (req.method === 'POST' && req.url === '/command') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        let action = data.action;
        let args = data.args || {};

        // Also support OpenClaw tool_call JSON style directly over HTTP POST
        if (!action && data.type === 'tool_call' && data.payload) {
          action = data.payload.name;
          args = data.payload.args || {};
        }

        if (!action) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing action in request.' }));
          return;
        }

        console.log(`[http] Received command: ${action}`, JSON.stringify(args));
        await processAction(action, args, (result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (typeof result === 'object' && result !== null) {
            result.ok = result.success !== false && !result.error;
          }
          res.end(JSON.stringify(result));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON request.', details: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('GangNiaga WebBridge Daemon is running.\n');
  }
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  let isExtension = false;

  console.log('[ws] Client connected');

  ws.on('message', async (messageBuffer) => {
    let msgStr = messageBuffer.toString();
    let msg;
    try {
      msg = JSON.parse(msgStr);
    } catch {
      console.error('[ws] Received non-JSON message');
      return;
    }

    // Try decrypting message if E2EE is active
    if (tunnel && msg.encrypted) {
      try {
        msg = tunnel.decrypt(msg);
      } catch (err) {
        console.error('[ws] Failed to decrypt message:', err.message);
        ws.send(JSON.stringify({ type: 'error', payload: { error: err.message } }));
        return;
      }
    }

    // Identify client
    if (msg.type === 'hello') {
      isExtension = true;
      extensionSocket = ws;
      console.log(`[ws] Chrome Extension registered successfully (v${msg.payload?.extensionVersion})`);
      ws.send(JSON.stringify(tunnel ? tunnel.encrypt({ type: 'hello_ack' }) : { type: 'hello_ack' }));
      return;
    }

    if (isExtension) {
      // Message from Extension
      if (msg.type === 'tool_result') {
        const reqId = msg.responseToRequestId;
        console.log(`[ws] Received tool result from Extension for ${reqId}`);

        // Try routing to pending HTTP request
        if (pendingHttpRequests.has(reqId)) {
          const req = pendingHttpRequests.get(reqId);
          pendingHttpRequests.delete(reqId);
          req.resolve(msg.payload);
        }
        // Try routing to pending WebSocket controller request
        else if (pendingWsRequests.has(reqId)) {
          const controllerWs = pendingWsRequests.get(reqId);
          pendingWsRequests.delete(reqId);
          if (controllerWs.readyState === WebSocket.OPEN) {
            controllerWs.send(JSON.stringify(tunnel ? tunnel.encrypt(msg) : msg));
          }
        }
      } else if (msg.type === 'user_query') {
        console.log(`[ws] Received user query from extension omnibox: "${msg.payload.query}"`);
        // Broadcast to all controllers
        for (let controller of controllers) {
          if (controller.readyState === WebSocket.OPEN) {
            controller.send(JSON.stringify(tunnel ? tunnel.encrypt(msg) : msg));
          }
        }
      }
    } else {
      // Message from Controller (Agent / CLI)
      if (msg.type === 'tool_call') {
        const reqId = msg.requestId;
        console.log(`[ws] Controller sent tool call: ${msg.payload?.name} (${reqId})`);

        if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
          ws.send(JSON.stringify(tunnel ? tunnel.encrypt({
            type: 'tool_result',
            responseToRequestId: reqId,
            payload: { error: 'Chrome Extension not connected' }
          }) : {
            type: 'tool_result',
            responseToRequestId: reqId,
            payload: { error: 'Chrome Extension not connected' }
          }));
          return;
        }

        // Map request ID to this controller to route response later
        pendingWsRequests.set(reqId, ws);
        extensionSocket.send(JSON.stringify(tunnel ? tunnel.encrypt(msg) : msg));
      } else {
        // Standard payload or commands
        controllers.add(ws);
      }
    }
  });

  ws.on('close', () => {
    if (isExtension) {
      console.log('[ws] Chrome Extension disconnected');
      extensionSocket = null;
    } else {
      console.log('[ws] Controller client disconnected');
      controllers.delete(ws);
    }
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    if (isNative) {
      console.warn(`[http] Port ${PORT} already in use. Another daemon instance is likely handling HTTP traffic. Continuing in Native relay mode.`);
    } else {
      console.error(`[http] Port ${PORT} already in use. Cannot start standalone daemon.`);
      process.exit(1);
    }
  } else {
    console.error(`[http] Server error:`, e);
  }
});

server.listen(PORT, () => {
  if (!isNative) {
    console.log(`===========================================================`);
    console.log(`  GangNiaga WebBridge Daemon running on Port ${PORT}`);
    console.log(`  Listening at http://127.0.0.1:${PORT} & ws://127.0.0.1:${PORT}/ws`);
    if (SECRET_KEY) {
      console.log(`  E2EE Encryption is ACTIVE (using GANGNIAGA_SECRET)`);
    } else {
      console.log(`  E2EE Encryption is INACTIVE`);
    }
    console.log(`===========================================================`);
  }
});

// Start Native Messaging listener if running via Chrome
if (isNative) {
  let chunks = [];
  let chunkLen = 0;
  
  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      chunks.push(chunk);
      chunkLen += chunk.length;
      
      while (chunkLen >= 4) {
        let buffer = Buffer.concat(chunks);
        let msgLen = buffer.readUInt32LE(0);
        
        if (chunkLen >= 4 + msgLen) {
          let msgBuffer = buffer.subarray(4, 4 + msgLen);
          let msgString = msgBuffer.toString('utf8');
          
          try {
            let parsed = JSON.parse(msgString);
            if (tunnel) parsed = tunnel.decrypt(parsed);
            
            if (parsed.type === 'tool_result' && parsed.responseToRequestId) {
              const reqId = parsed.responseToRequestId;
              if (pendingHttpRequests.has(reqId)) {
                pendingHttpRequests.get(reqId).resolve(parsed.payload);
                pendingHttpRequests.delete(reqId);
              } else if (pendingWsRequests.has(reqId)) {
                const wsClient = pendingWsRequests.get(reqId);
                if (wsClient.readyState === WebSocket.OPEN) {
                  const outMsg = JSON.stringify(tunnel ? tunnel.encrypt(parsed) : parsed);
                  wsClient.send(outMsg);
                }
                pendingWsRequests.delete(reqId);
              }
            }
          } catch (e) {
            // Ignore parse errors on native stream
          }
          
          chunks = [buffer.subarray(4 + msgLen)];
          chunkLen = chunks[0].length;
        } else {
          break;
        }
      }
    }
  });
  
  process.stdin.on('end', () => {
    process.exit(0);
  });
}
