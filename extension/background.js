// GangNiaga WebBridge - Background Service Worker v2.5
// Simple, clean, maintainable. Connects Chrome to WebBridge daemon.
// Config: Daemon URL auto-detects WSL or Windows via chrome.storage

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════
  // Daemon URL — auto-updated by wsl-start-daemon.sh
  const DAEMON_URL = 'ws://172.22.32.1:10087/ws';

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  const attachedTabIds = new Set();
  let activeTabId = null;
  let ws = null;
  let reconnectTimer = null;

  // ═══════════════════════════════════════════════════════════
  // CDP HELPERS
  // ═══════════════════════════════════════════════════════════

  async function attachDebugger(tabId) {
    if (attachedTabIds.has(tabId)) return;
    try { await chrome.debugger.detach({ tabId }); } catch {}
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedTabIds.add(tabId);
    activeTabId = tabId;
  }

  async function sendCDP(method, params) {
    if (!activeTabId) throw Error('No tab attached');
    return chrome.debugger.sendCommand({ tabId: activeTabId }, method, params);
  }

  async function getActiveTab() {
    if (activeTabId) {
      try { return await chrome.tabs.get(activeTabId); } catch {}
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) activeTabId = tab.id;
    return tab;
  }

  // ═══════════════════════════════════════════════════════════
  // TOOL EXECUTORS
  // ═══════════════════════════════════════════════════════════

  async function execNavigate(args) {
    const { url, newTab } = args;
    if (!url) throw Error('navigate: url required');
    if (newTab) {
      const tab = await chrome.tabs.create({ url, active: true });
      activeTabId = tab.id;
      await attachDebugger(tab.id);
      return { success: true, tabId: tab.id };
    }
    const tab = await getActiveTab();
    await attachDebugger(tab.id);
    await sendCDP('Page.navigate', { url });
    return { success: true, tabId: tab.id };
  }

  async function execClick(args) {
    const { selector } = args;
    if (!selector) throw Error('click: selector required');
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return {error:'not found'}; el.scrollIntoView({block:'center'}); el.click(); return {success:true,tag:el.tagName}; })()`,
      returnByValue: true
    });
    const val = res.result?.value;
    if (val?.error) throw Error(val.error);
    return val || { success: true };
  }

  async function execFill(args) {
    const { selector, value } = args;
    if (!selector) throw Error('fill: selector required');
    const jsonVal = JSON.stringify(value);
    await attachDebugger((await getActiveTab()).id);
    const code = `(function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return {error:'not found'};
      el.focus();
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
      if (s) s.call(el, ${jsonVal}); else el.value = ${jsonVal};
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return {success:true};
    })()`;
    const res = await sendCDP('Runtime.evaluate', { expression: code, returnByValue: true });
    const val = res.result?.value;
    if (val?.error) throw Error(val.error);
    return val || { success: true };
  }

  async function execSnapshot() {
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Accessibility.getFullAXTree', {});
    return { success: true, tree: res.nodes || [] };
  }

  async function execScreenshot(args) {
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Page.captureScreenshot', { format: args?.format || 'png' });
    return { success: true, data: res.data };
  }

  async function execEvaluate(args) {
    const { code } = args;
    if (!code) throw Error('evaluate: code required');
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Runtime.evaluate', { expression: code, returnByValue: true });
    return { success: true, result: res.result?.value };
  }

  async function execWaitFor(args) {
    const { selector, timeout = 10000 } = args;
    await attachDebugger((await getActiveTab()).id);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await sendCDP('Runtime.evaluate', {
        expression: `!!document.querySelector(${JSON.stringify(selector)})`,
        returnByValue: true
      });
      if (res.result?.value) return { success: true };
      await new Promise(r => setTimeout(r, 500));
    }
    throw Error('wait_for: timeout');
  }

  async function execScroll(args) {
    const { x = 0, y = 0, selector } = args;
    await attachDebugger((await getActiveTab()).id);
    if (selector) {
      await sendCDP('Runtime.evaluate', {
        expression: `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`,
      });
    } else {
      await sendCDP('Runtime.evaluate', { expression: `window.scrollBy(${x},${y})` });
    }
    return { success: true };
  }

  async function execHover(args) {
    const { selector } = args;
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Runtime.evaluate', {
      expression: `(function(){ const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return {error:'not found'}; const r=el.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`,
      returnByValue: true
    });
    const pos = res.result?.value;
    if (pos?.error) throw Error(pos.error);
    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y, button: 'none', buttons: 0 });
    return { success: true, ...pos };
  }

  async function execCloseTab(args) {
    const { tabId } = args;
    if (tabId) {
      await chrome.tabs.remove(tabId);
      attachedTabIds.delete(tabId);
    }
    return { success: true };
  }

  async function execListTabs() {
    const tabs = await chrome.tabs.query({});
    return { success: true, data: tabs.map(t => ({ id: t.id, title: t.title, url: t.url })) };
  }

  async function execExtractText() {
    await attachDebugger((await getActiveTab()).id);
    const res = await sendCDP('Runtime.evaluate', {
      expression: 'document.body?.innerText || ""',
      returnByValue: true
    });
    return { success: true, text: res.result?.value || '' };
  }

  // ═══════════════════════════════════════════════════════════
  // TOOL DISPATCH
  // ═══════════════════════════════════════════════════════════

  const tools = {
    navigate: execNavigate,
    click: execClick,
    fill: execFill,
    snapshot: execSnapshot,
    screenshot: execScreenshot,
    evaluate: execEvaluate,
    wait_for: execWaitFor,
    scroll: execScroll,
    hover: execHover,
    close_tab: execCloseTab,
    list_tabs: execListTabs,
    extract_text: execExtractText,
  };

  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET CONNECTION
  // ═══════════════════════════════════════════════════════════

  function getDaemonUrl() {
    try {
      const stored = localStorage.getItem('wb_daemon_url');
      if (stored) return stored;
    } catch {}
    return DAEMON_URL;
  }

  function connect() {
    const url = getDaemonUrl();
    console.log('[WebBridge] Connecting to daemon:', url);

    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WebBridge] Connected to daemon');
      ws.send(JSON.stringify({ type: 'hello', payload: { extensionVersion: '2.5.0' } }));
    };

    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'tool_call') {
        const { name, args } = msg.payload;
        const tool = tools[name];
        if (!tool) {
          ws.send(JSON.stringify({
            type: 'tool_result',
            responseToRequestId: msg.requestId,
            payload: { success: false, error: `Unknown tool: ${name}` }
          }));
          return;
        }
        try {
          const result = await tool(args || {});
          ws.send(JSON.stringify({
            type: 'tool_result',
            responseToRequestId: msg.requestId,
            payload: { success: true, ...result }
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'tool_result',
            responseToRequestId: msg.requestId,
            payload: { success: false, error: err.message }
          }));
        }
      }
    };

    ws.onclose = () => {
      console.log('[WebBridge] Disconnected, reconnecting in 3s...');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WebBridge] WS error:', err);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabIds.delete(tabId);
    if (activeTabId === tabId) activeTabId = null;
  });

  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId) {
      attachedTabIds.delete(source.tabId);
      if (activeTabId === source.tabId) activeTabId = null;
    }
  });

  // Start
  connect();
  console.log('[WebBridge] Background worker loaded v2.5');

})();
