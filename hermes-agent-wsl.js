#!/usr/bin/env node

/**
 * Hermes Agent for WSL
 * Single setup, reusable across multiple runs
 * Features: Knowledge base, automation, screenshots, cross-domain support
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DAEMON_HOST = (() => {
  if (process.env.DAEMON_HOST) return process.env.DAEMON_HOST;
  // Auto-detect WSL: try to find Windows host IP
  try {
    const { execSync } = require('child_process');
    if (require('fs').existsSync('/proc/version')) {
      const procVersion = require('fs').readFileSync('/proc/version', 'utf8');
      if (procVersion.toLowerCase().includes('microsoft')) {
        const ip = execSync("ip route show default | awk '{print $3}'", { encoding: 'utf8' }).trim();
        if (ip) {
          console.log(`[Hermes] WSL detected, using Windows host IP: ${ip}`);
          return ip;
        }
      }
    }
  } catch {}
  return 'localhost';
})();
const DAEMON_PORT = process.env.DAEMON_PORT || 10087;
const API_KEY = (() => {
  if (process.env.GANGNIAGA_API_KEY && process.env.GANGNIAGA_API_KEY !== 'your_generated_api_key_here' && process.env.GANGNIAGA_API_KEY !== 'your-api-key-here') {
    return process.env.GANGNIAGA_API_KEY;
  }
  // Fallback: read from auth file
  const authPath = path.join(__dirname, 'daemon', '.webbridge-auth.json');
  try {
    return JSON.parse(fs.readFileSync(authPath, 'utf8')).apiKey;
  } catch {
    console.error('❌ No API key found. Set GANGNIAGA_API_KEY in .env or run daemon first.');
    process.exit(1);
  }
})();
const LOG_LEVEL = process.env.HERMES_LOG_LEVEL || 'info';

// Color output helpers
const log = {
  info: (msg) => console.log(`\x1b[36m[Hermes]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✅\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m❌\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠️\x1b[0m ${msg}`),
  debug: (msg) => LOG_LEVEL === 'debug' && console.log(`\x1b[90m[DEBUG]\x1b[0m ${msg}`),
};

const baseUrl = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

/**
 * Fetch with built-in error handling
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  log.debug(`${method} ${endpoint}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    };
    
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (err) {
    log.error(`API call failed: ${err.message}`);
    throw err;
  }
}

/**
 * Load knowledge base for a site
 */
async function loadSiteKnowledge(domain) {
  log.info(`Loading knowledge base for ${domain}...`);
  try {
    const data = await apiCall(`/sites/${domain}`);
    log.success(`Loaded YAML for ${domain}`);
    return data.yaml;
  } catch (err) {
    log.error(`Could not load knowledge base: ${err.message}`);
    return null;
  }
}

/**
 * Parse YAML to extract selectors
 */
function parseYamlSelectors(yaml) {
  const selectors = {};
  
  const patterns = [
    { key: 'search_input', regex: /search_input:\s*"(.*?)"/ },
    { key: 'search_button', regex: /search_button:\s*"(.*?)"/ },
    { key: 'product_link', regex: /product_link:\s*"(.*?)"/ },
    { key: 'price', regex: /price:\s*"(.*?)"/ },
    { key: 'add_to_cart', regex: /add_to_cart:\s*"(.*?)"/ },
  ];
  
  patterns.forEach(({ key, regex }) => {
    const match = yaml.match(regex);
    if (match) selectors[key] = match[1];
  });
  
  return selectors;
}

/**
 * Execute command on daemon
 */
async function executeCommand(action, args = {}) {
  log.info(`Executing: ${action}`);
  try {
    const result = await apiCall('/command', 'POST', {
      action,
      args,
    });
    log.success(`Command executed: ${action}`);
    return result;
  } catch (err) {
    log.error(`Command failed: ${err.message}`);
    throw err;
  }
}

/**
 * Get OS screenshot
 */
async function captureScreenshot(outputPath) {
  if (!outputPath) {
    const path = require('path');
    outputPath = path.join(__dirname, 'screenshots', 'hermes.png');
  }
  log.info(`Capturing screenshot...`);
  try {
    const result = await apiCall('/command', 'POST', {
      action: 'os_screenshot',
      args: { path: outputPath },
    });
    log.success(`Screenshot saved to ${outputPath}`);
    return result;
  } catch (err) {
    log.error(`Screenshot failed: ${err.message}`);
    throw err;
  }
}

/**
 * Test daemon connection
 */
async function testDaemonConnection() {
  log.info(`Testing daemon connection to ${baseUrl}...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok || response.status === 401) {
      log.success(`Daemon is running! (HTTP ${response.status})`);
      return true;
    }
    log.error(`Daemon responded with unexpected status: ${response.status}`);
    return false;
  } catch (err) {
    if (err.name === 'AbortError') {
      log.error(`Daemon connection timed out (5s). Check if daemon is running.`);
    } else if (err.cause?.code === 'ECONNREFUSED') {
      log.error(`Connection refused. Daemon not running on ${baseUrl}`);
      log.error(`  Start it: cd D:\\GangNiaga-WebBridge && npm run daemon`);
    } else {
      log.error(`Daemon not responding: ${err.message}`);
    }
    return false;
  }
}

/**
 * Autonomous Hermes workflow
 */
async function runHermesWorkflow() {
  log.info(`Starting Hermes autonomous agent workflow...`);
  
  // Test connection
  const connected = await testDaemonConnection();
  if (!connected) process.exit(1);
  
  // Example: Shopee automation
  const domain = 'shopee.com.my';
  log.info(`\nTarget domain: ${domain}`);
  
  // Load knowledge base
  const yaml = await loadSiteKnowledge(domain);
  if (!yaml) {
    log.warn(`No knowledge base available for ${domain}`);
    return;
  }
  
  // Parse selectors
  const selectors = parseYamlSelectors(yaml);
  log.success(`Found ${Object.keys(selectors).length} selectors`);
  Object.entries(selectors).forEach(([key, val]) => {
    log.debug(`  ${key}: ${val}`);
  });
  
  // Example commands
  log.info(`\nRunning automation sequence...`);

  try {
    // 1. Navigate to domain in new tab
    await executeCommand('navigate', {
      url: `https://${domain}`,
      newTab: true,
    });

    // 2. Wait for page to load
    await executeCommand('wait_for', { timeout: 5000 });

    // 3. Fill search query (using React-compatible fill)
    if (selectors.search_input) {
      await executeCommand('evaluate', {
        code: `(function() {
          const input = document.querySelector('${selectors.search_input}');
          if (!input) return {error: 'Input not found'};
          input.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) { setter.call(input, 'laptop'); } else { input.value = 'laptop'; }
          input.dispatchEvent(new Event('input', {bubbles: true}));
          input.dispatchEvent(new Event('change', {bubbles: true}));
          return {success: true, value: input.value};
        })()`,
      });
      log.success(`Typed search query`);
    }

    // 4. Click search button
    if (selectors.search_button) {
      await executeCommand('click', {
        selector: selectors.search_button,
      });
      log.success(`Clicked search button`);
    }

    // 5. Wait for results
    await executeCommand('wait_for', { timeout: 5000 });

    // 6. Capture screenshot
    await captureScreenshot();

    log.success(`\n✨ Workflow completed successfully!`);
  } catch (err) {
    log.error(`Workflow failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Interactive mode
 */
async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const prompt = (question) => new Promise(resolve => rl.question(question, resolve));
  
  log.info(`Hermes Agent - Interactive Mode`);
  log.info(`Commands: sites, load, run, screenshot, exit\n`);
  
  const connected = await testDaemonConnection();
  if (!connected) {
    rl.close();
    process.exit(1);
  }
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cmd = await prompt('\n> ');
    
    if (cmd === 'exit') {
      log.info(`Goodbye!`);
      rl.close();
      break;
    } else if (cmd === 'sites') {
      log.info(`Available sites: shopee.com.my, facebook.com, tiktok.com, google.com, canva.com`);
    } else if (cmd.startsWith('load ')) {
      const domain = cmd.replace('load ', '').trim();
      await loadSiteKnowledge(domain);
    } else if (cmd === 'run') {
      await runHermesWorkflow();
    } else if (cmd === 'screenshot') {
      await captureScreenshot();
    } else {
      log.warn(`Unknown command: ${cmd}`);
    }
  }
}

// Main
(async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveMode();
  } else {
    await runHermesWorkflow();
  }
})().catch((err) => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
