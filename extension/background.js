var background=(function(){
  function e(e){return e==null||typeof e==`function`?{main:e}:e}
  var t=new Set,n=null,r=null;
  async function isSensitiveAction(selector) {
    if (!selector) return false;
    let s = String(selector).toLowerCase();
    let sensitiveKeywords = ['pay', 'buy', 'checkout', 'submit', 'purchase', 'confirm', 'order', 'card', 'password', 'login'];
    
    // 1. Basic selector string check (first-line defense)
    if (sensitiveKeywords.some(kw => s.includes(kw))) {
      return true;
    }

    // 2. Check current page URL
    try {
      let activeTab = await s();
      if (activeTab && activeTab.url) {
        let url = activeTab.url.toLowerCase();
        if (sensitiveKeywords.some(kw => url.includes(kw))) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[safety] failed to check active tab URL:', e);
    }

    // 3. Deep DOM inspection
    try {
      let props = null;
      if (D(selector)) {
        let node = E(selector);
        if (node) {
          let { object } = await a(`DOM.resolveNode`, { backendNodeId: node.backendDOMNodeId });
          if (object?.objectId) {
            let checkRes = await a(`Runtime.callFunctionOn`, {
              objectId: object.objectId,
              functionDeclaration: `function() {
                const el = this;
                const text = (el.textContent || el.value || '').toLowerCase();
                const tag = el.tagName.toLowerCase();
                const type = el.getAttribute('type')?.toLowerCase() || '';
                const name = el.getAttribute('name')?.toLowerCase() || '';
                const id = el.id?.toLowerCase() || '';
                const cls = el.className?.toLowerCase() || '';
                const placeholder = el.getAttribute('placeholder')?.toLowerCase() || '';
                
                let formAction = '';
                const form = el.closest('form');
                if (form) {
                  formAction = form.getAttribute('action')?.toLowerCase() || '';
                }
                return { text, tag, type, name, id, cls, placeholder, formAction };
              }`,
              returnByValue: true
            });
            if (checkRes.result?.value) {
              props = checkRes.result.value;
            }
          }
        }
      } else {
        let params = {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return null;
            const text = (el.textContent || el.value || '').toLowerCase();
            const tag = el.tagName.toLowerCase();
            const type = el.getAttribute('type')?.toLowerCase() || '';
            const name = el.getAttribute('name')?.toLowerCase() || '';
            const id = el.id?.toLowerCase() || '';
            const cls = el.className?.toLowerCase() || '';
            const placeholder = el.getAttribute('placeholder')?.toLowerCase() || '';
            
            let formAction = '';
            const form = el.closest('form');
            if (form) {
              formAction = form.getAttribute('action')?.toLowerCase() || '';
            }
            return { text, tag, type, name, id, cls, placeholder, formAction };
          })()`,
          returnByValue: true
        };
        let ctxId = getContextId();
        if (ctxId !== undefined) params.contextId = ctxId;
        let res = await a(`Runtime.evaluate`, params);
        if (res.result?.value) {
          props = res.result.value;
        }
      }

      if (props) {
        const checkStrings = [
          props.text,
          props.type,
          props.name,
          props.id,
          props.cls,
          props.placeholder,
          props.formAction
        ];

        for (let str of checkStrings) {
          if (str && sensitiveKeywords.some(kw => str.includes(kw))) {
            console.warn(`[safety] sensitive keyword matched in element property:`, str);
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('[safety] deep DOM inspection failed:', err);
    }

    return false;
  }

  // A. Self-Healing Helpers using Gemini Nano (window.ai)
  async function trySelfHealingClick(selector) {
    if (typeof ai === 'undefined' || !ai.languageModel) return null;
    try {
      let activeTab = await s();
      let elementsExpr = `(() => {
        const els = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable]'));
        return els.map((el, i) => ({
          index: i,
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: el.className || '',
          text: (el.textContent || el.value || '').trim().slice(0, 50),
          placeholder: el.placeholder || '',
          role: el.getAttribute('role') || ''
        })).filter(el => el.text || el.id || el.className || el.placeholder);
      })()`;
      let params = { expression: elementsExpr, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let res = await a(`Runtime.evaluate`, params);
      let elements = res.result?.value;
      if (!elements || elements.length === 0) return null;

      let elementsList = elements.map(el => `Index ${el.index}: <${el.tag} id="${el.id}" class="${el.className}" placeholder="${el.placeholder}">${el.text}</${el.tag}>`).join('\n');
      let prompt = `We are looking for an element matching selector "${selector}" but it was not found. 
Here is a list of interactive elements on the page:
${elementsList}

Which index is the closest semantic match to the intended action? Reply with ONLY the index number (e.g. 5) and nothing else. If no element matches, reply "NONE".`;

      const session = await ai.languageModel.create();
      const answer = (await session.prompt(prompt)).trim();
      session.destroy();

      let matchedIndex = parseInt(answer, 10);
      if (!isNaN(matchedIndex) && matchedIndex >= 0) {
        let clickExpr = `(() => {
          const els = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable]'));
          const el = els[${matchedIndex}];
          if (!el) return { error: 'healed element not found at index ${matchedIndex}' };
          el.scrollIntoView({ block: 'center' });
          el.click();
          return { success: true, healed: true, originalSelector: ${JSON.stringify(selector)}, index: ${matchedIndex}, tag: el.tagName, text: el.textContent?.slice(0, 100) };
        })()`;
        let clickParams = { expression: clickExpr, returnByValue: true };
        if (ctxId !== undefined) clickParams.contextId = ctxId;
        let clickRes = await a(`Runtime.evaluate`, clickParams);
        let val = clickRes.result?.value;
        if (val && !val.error) return val;
      }
    } catch (err) {
      console.warn('[self-healing] click failed:', err);
    }
    return null;
  }

  async function trySelfHealingFill(selector, value) {
    if (typeof ai === 'undefined' || !ai.languageModel) return null;
    try {
      let activeTab = await s();
      let elementsExpr = `(() => {
        const els = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable]'));
        return els.map((el, i) => ({
          index: i,
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: el.className || '',
          text: (el.textContent || el.value || '').trim().slice(0, 50),
          placeholder: el.placeholder || '',
          role: el.getAttribute('role') || ''
        })).filter(el => el.id || el.className || el.placeholder || el.text);
      })()`;
      let params = { expression: elementsExpr, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let res = await a(`Runtime.evaluate`, params);
      let elements = res.result?.value;
      if (!elements || elements.length === 0) return null;

      let elementsList = elements.map(el => `Index ${el.index}: <${el.tag} id="${el.id}" class="${el.className}" placeholder="${el.placeholder}">${el.text}</${el.tag}>`).join('\n');
      let prompt = `We are looking for an input/textarea element matching selector "${selector}" to fill. 
Here is a list of text input elements on the page:
${elementsList}

Which index is the closest semantic match to the target input field? Reply with ONLY the index number (e.g. 3) and nothing else. If no element matches, reply "NONE".`;

      const session = await ai.languageModel.create();
      const answer = (await session.prompt(prompt)).trim();
      session.destroy();

      let matchedIndex = parseInt(answer, 10);
      if (!isNaN(matchedIndex) && matchedIndex >= 0) {
        let fillExpr = `(() => {
          const els = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable]'));
          const el = els[${matchedIndex}];
          if (!el) return { error: 'healed element not found at index ${matchedIndex}' };
          ${O(`el`, value)}
          return { success: true, healed: true, originalSelector: ${JSON.stringify(selector)}, index: ${matchedIndex}, tag: el.tagName, mode: el.isContentEditable ? 'contenteditable' : 'value' };
        })()`;
        let fillParams = { expression: fillExpr, returnByValue: true };
        if (ctxId !== undefined) fillParams.contextId = ctxId;
        let fillRes = await a(`Runtime.evaluate`, fillParams);
        let val = fillRes.result?.value;
        if (val && !val.error) return val;
      }
    } catch (err) {
      console.warn('[self-healing] fill failed:', err);
    }
    return null;
  }

  // B. Anti-Bot Autopilot Helpers
  var currentMouseX = 0, currentMouseY = 0;
  function getBezierPoints(x1, y1, x2, y2, steps = 10) {
    const cp1x = x1 + (x2 - x1) * 0.25 + (Math.random() - 0.5) * 100;
    const cp1y = y1 + (y2 - y1) * 0.25 + (Math.random() - 0.5) * 100;
    const cp2x = x1 + (x2 - x1) * 0.75 + (Math.random() - 0.5) * 100;
    const cp2y = y1 + (y2 - y1) * 0.75 + (Math.random() - 0.5) * 100;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.pow(1 - t, 3) * x1 + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * x2;
      const y = Math.pow(1 - t, 3) * y1 + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * y2;
      points.push({ x, y });
    }
    return points;
  }
  async function moveMouseHumanLike(targetX, targetY) {
    const steps = 5 + Math.floor(Math.random() * 8);
    const points = getBezierPoints(currentMouseX, currentMouseY, targetX, targetY, steps);
    for (const pt of points) {
      await a(`Input.dispatchMouseEvent`, { type: `mouseMoved`, x: Math.round(pt.x), y: Math.round(pt.y), button: `none`, buttons: 0 }).catch(()=>{});
      await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
    }
    currentMouseX = targetX;
    currentMouseY = targetY;
  }

  // C. Zero-Trust Cloud Relay Tunnel Helpers (Web Crypto AES-GCM)
  var cryptoSecretKey = null;
  async function setCryptoSecret(secretText) {
    if (!secretText) { cryptoSecretKey = null; return; }
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secretText));
    cryptoSecretKey = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function encryptPayload(obj) {
    if (!cryptoSecretKey) return obj;
    try {
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoSecretKey, encoder.encode(JSON.stringify(obj)));
      const combined = new Uint8Array(12 + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), 12);
      let binary = '';
      for (let i = 0; i < combined.byteLength; i++) binary += String.fromCharCode(combined[i]);
      return { encrypted: true, data: btoa(binary) };
    } catch (err) {
      console.error('[crypto] encrypt failed:', err);
      return obj;
    }
  }
  async function decryptPayload(obj) {
    if (!cryptoSecretKey || !obj.encrypted || !obj.data) return obj;
    try {
      const binary = atob(obj.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const iv = bytes.slice(0, 12);
      const ciphertext = bytes.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoSecretKey, ciphertext);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (err) {
      console.error('[crypto] decrypt failed:', err);
      throw Error('Decryption failed. Check secret key.');
    }
  }

  chrome.tabs.onRemoved.addListener(e=>{t.delete(e),n===e&&(n=null),r===e&&(r=null)}),
  chrome.debugger.onDetach.addListener(e=>{e.tabId&&(t.delete(e.tabId),n===e.tabId&&(n=null))});
  
  // Modifying i(e) to enable Runtime and Page domains
  async function i(e){
    if(t.has(e)){n=e;return}
    try{await chrome.debugger.detach({tabId:e})}catch{}
    await chrome.debugger.attach({tabId:e},`1.3`),t.add(e),n=e;
    await chrome.debugger.sendCommand({tabId:e},`Runtime.enable`).catch(()=>{});
    await chrome.debugger.sendCommand({tabId:e},`Page.enable`).catch(()=>{});
  }
  
  async function a(e,t){if(n===null)throw Error(`No tab attached. Call attach(tabId) first.`);return await chrome.debugger.sendCommand({tabId:n},e,t)}
  function o(){return n}
  async function s(){if(n!==null)try{let e=await chrome.tabs.get(n);if(e)return e}catch{t.delete(n),n=null}if(r!==null)try{let e=await chrome.tabs.get(r);if(e)return e}catch{r=null}let[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e?.id)throw Error(`No active tab found`);return r=e.id,e}
  function c(e){r=e}
  function l(e){n=e}
  
  // Tab grouping
  var u={twitter:`blue`,xhs:`red`,zhihu:`blue`,worldquant:`purple`},d=[`green`,`yellow`,`cyan`,`orange`,`pink`,`grey`],f=new Map,p=new Map,m=0,h=!1;
  function ee(){h||(h=!0,chrome.tabGroups.onRemoved.addListener(e=>{for(let[t,n]of f)if(n===e.id){f.delete(t);break}}))}
  async function g(e,t,n){try{let r=f.get(t);if(r!=null){await chrome.tabs.group({tabIds:e,groupId:r});return}let i=`agent:${t}`,a=await chrome.tabGroups.query({title:i});if(a.length>0){let n=a[0].id;await chrome.tabs.group({tabIds:e,groupId:n}),f.set(t,n);return}n&&p.set(t,n);let o=n??p.get(t)??i,s=await chrome.tabs.group({tabIds:e}),c=u[t]??d[m++%d.length];await chrome.tabGroups.update(s,{title:o,color:c,collapsed:!1}),f.set(t,s)}catch{}}
  
  // Context & Dialog State for frame_switch and handle_dialog
  var frameContexts = new Map(); // tabId -> Map(frameId -> contextId)
  var currentFrameId = new Map(); // tabId -> frameId
  var dialogConfig = {
    active: false,
    action: `auto`,
    promptText: ``,
    persistent: false
  };
  var consoleLogs = new Map(); // tabId -> Array of logs

  function getContextId() {
    let activeTabId = o();
    if (activeTabId && currentFrameId.has(activeTabId)) {
      let fId = currentFrameId.get(activeTabId);
      let cMap = frameContexts.get(activeTabId);
      if (cMap && cMap.has(fId)) {
        return cMap.get(fId);
      }
    }
    return undefined;
  }
  
  // Register global debugger event listener for frames, dialogs, console logs
  chrome.debugger.onEvent.addListener((source, method, params) => {
    let tabId = source.tabId;
    if (!tabId) return;
    
    if (method === `Runtime.executionContextCreated`) {
      let context = params.context;
      let frameId = context.auxData?.frameId;
      if (frameId) {
        if (!frameContexts.has(tabId)) {
          frameContexts.set(tabId, new Map());
        }
        frameContexts.get(tabId).set(frameId, context.id);
      }
    }
    
    if (method === `Runtime.executionContextDestroyed`) {
      let contextId = params.executionContextId;
      let cMap = frameContexts.get(tabId);
      if (cMap) {
        for (let [fId, cId] of cMap.entries()) {
          if (cId === contextId) {
            cMap.delete(fId);
            break;
          }
        }
      }
    }
    
    if (method === `Runtime.executionContextsCleared`) {
      frameContexts.delete(tabId);
      currentFrameId.delete(tabId);
    }
    
    if (method === `Page.javascriptDialogOpening`) {
      if (dialogConfig.active) {
        chrome.debugger.sendCommand({ tabId }, `Page.handleJavaScriptDialog`, {
          accept: dialogConfig.action === `accept` || dialogConfig.action === `auto`,
          promptText: dialogConfig.promptText
        }).catch(() => {});
        if (!dialogConfig.persistent) {
          dialogConfig.active = false;
        }
      }
    }
    
    if (method === `Runtime.consoleAPICalled`) {
      let args = params.args.map(arg => {
        if (arg.value !== undefined) return typeof arg.value === `object` ? JSON.stringify(arg.value) : String(arg.value);
        return arg.description || ``;
      }).join(` `);
      let logEntry = { timestamp: Date.now(), level: params.type, text: args };
      if (!consoleLogs.has(tabId)) consoleLogs.set(tabId, []);
      consoleLogs.get(tabId).push(logEntry);
    }
    
    if (method === `Log.entryAdded`) {
      let logEntry = { timestamp: params.entry.timestamp, level: params.entry.level, text: params.entry.text };
      if (!consoleLogs.has(tabId)) consoleLogs.set(tabId, []);
      consoleLogs.get(tabId).push(logEntry);
    }
  });

  // Tools classes
  var _=class{
    name=`navigate`;
    async execute(e){
      let t=e.url;
      if(!t)throw Error(`navigate: url is required`);
      let n,r=e.newTab,o=e._session,l=e.group_title;
      if(r)return n=await chrome.tabs.create({url:t,active:!0}),c(n.id),o&&await g(n.id,o,l),await i(n.id),await this.waitForLoad(n.id),{success:!0,url:t,tabId:n.id};
      if(n=await s(),n.url?.startsWith(`chrome://`)||n.url?.startsWith(`edge://`))return n=await chrome.tabs.create({url:t,active:!0}),c(n.id),await this.waitForLoad(n.id),{success:!0,url:t,tabId:n.id};
      await i(n.id),c(n.id);
      let u=n.url===t||n.url===t+`/`,d;
      return u?await a(`Page.reload`,{ignoreCache:!0}):d=(await a(`Page.navigate`,{url:t})).frameId,await this.waitForLoad(n.id),{success:!0,url:t,tabId:n.id,frameId:d}
    }
    waitForLoad(e){
      return new Promise((t,n)=>{
        let r=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(a),n(Error(`navigate: page load timeout (30s)`))},3e4),
        i=e=>e.status===`complete`&&!!e.url&&e.url!==`about:blank`,
        a=(n,o,s)=>{n===e&&o.status===`complete`&&i(s)&&(clearTimeout(r),chrome.tabs.onUpdated.removeListener(a),t())};
        chrome.tabs.get(e,e=>{i(e)?(clearTimeout(r),t()):chrome.tabs.onUpdated.addListener(a)})
      })
    }
  },
  v=class{
    name=`find_tab`;
    async execute(e){
      let t=e.url;
      if(!t)throw Error(`find_tab: url is required`);
      let n=e._session,r=e.active,a=y(t),o;
      if(r&&(o=(await chrome.windows.getLastFocused({populate:!0,windowTypes:[`normal`]})).tabs?.find(e=>e.active&&e.url&&te(e.url,a))),o||=(await chrome.tabs.query({url:a}))[0],!o)throw Error(`find_tab: no open tab found matching ${t} — open the page first, or use navigate to open it`);
      let s=o.id;
      return n&&await g(s,n),await i(s),c(s),{success:!0,url:o.url??t,tabId:s}
    }
  };
  
  function y(e){if(e.includes(`*`))return e;try{return`*://${new URL(e).hostname}/*`}catch{return`*://${e.replace(/^\.+/,``)}/*`}}
  function te(e,t){try{return new URL(e).hostname===t.replace(/^\*:\/\//,``).replace(/\/\*$/,``)}catch{return!1}}
  
  var ne=class{
    name=`evaluate`;
    async execute(e){
      let t=e.code;
      if(!t)throw Error(`evaluate: code is required`);
      await i((await s()).id);
      let params={expression:t,returnByValue:!0,awaitPromise:!0};
      let ctxId=getContextId();
      if(ctxId!==undefined)params.contextId=ctxId;
      let n=await a(`Runtime.evaluate`,params);
      if(n.exceptionDetails){let e=n.exceptionDetails.exception?.description||n.exceptionDetails.text;throw Error(`evaluate: ${e}`)}
      return{type:n.result.type,value:n.result.value}
    }
  },
  b=new Set,
  x=new Map;
  
  function S(e){let t=x.get(e);return t||(t=new Map,x.set(e,t)),t}
  
  var C=class e{
    name=`network`;
    async execute(e){
      let t=e.cmd;
      if(!t)throw Error(`network: cmd is required (start/stop/list/detail)`);
      switch(t){
        case`start`:return this.start();
        case`stop`:return this.stop();
        case`list`:return this.list(e.filter);
        case`detail`:return this.detail(e.requestId);
        default:throw Error(`network: unknown cmd "${t}"`)
      }
    }
    async start(){
      let t=await s();
      await i(t.id);
      let n=t.id;
      return x.set(n,new Map),b.add(n),await a(`Network.enable`),e._listenerAdded||=(chrome.debugger.onEvent.addListener((e,t,n)=>{
        let r=e.tabId;
        if(!r||!b.has(r))return;
        let i=S(r);
        if(t===`Network.requestWillBeSent`&&i.set(n.requestId,{requestId:n.requestId,url:n.request.url,method:n.request.method,timestamp:n.timestamp}),t===`Network.responseReceived`){let e=i.get(n.requestId);e&&(e.status=n.response.status,e.mimeType=n.response.mimeType)}
        if(t===`Network.loadingFinished`){let e=i.get(n.requestId);e&&(e.completed=!0)}
      }),!0),{success:!0,message:`network capture started`}
    }
    async stop(){
      let e=o();
      if(e!==null){b.delete(e);try{await a(`Network.disable`)}catch{}}
      return{success:!0,message:`network capture stopped`}
    }
    list(e){
      let t=o(),n=[...(t===null?new Map:S(t)).values()];
      return e&&(n=n.filter(t=>t.url.includes(e))),{count:n.length,requests:n.map(e=>({requestId:e.requestId,url:e.url,method:e.method,status:e.status,mimeType:e.mimeType,completed:e.completed??!1}))}
    }
    async detail(e){
      if(!e)throw Error(`network: requestId is required for detail`);
      let t=o(),n=(t===null?new Map:S(t)).get(e);
      if(!n)throw Error(`network: request "${e}" not found`);
      let r=await a(`Network.getResponseBody`,{requestId:e}),i=r.body;
      if(!r.base64Encoded)try{i=JSON.parse(r.body)}catch{}
      return{requestId:n.requestId,url:n.url,method:n.method,status:n.status,mimeType:n.mimeType,base64Encoded:r.base64Encoded,body:i}
    }
  },
  w=new Map,
  T=1,
  re=new Set([`button`,`link`,`textbox`,`checkbox`,`radio`,`combobox`,`listbox`,`menuitem`,`menuitemcheckbox`,`menuitemradio`,`option`,`searchbox`,`slider`,`spinbutton`,`switch`,`tab`,`treeitem`]);
  
  function ie(){w.clear(),T=1}
  function ae(e,t,n){let r=`e${T++}`;return w.set(r,{backendDOMNodeId:e,role:t,name:n}),r}
  function E(e){let t=e.startsWith(`@`)?e.slice(1):e;return w.get(t)}
  function D(e){return/^@?e\d+$/.test(e)}
  
  var oe=class{
    name=`snapshot`;
    async execute(e){
      let t=await s();
      await i(t.id),ie();
      let n=await a(`Accessibility.getFullAXTree`),r=this.buildTree(n.nodes);
      return{url:t.url,title:t.title,tree:r}
    }
    buildTree(e){let t=new Map;for(let n of e)t.set(n.nodeId,n);return e.length===0?[]:this.formatChildren(e[0],t)}
    formatChildren(e,t){
      let n=[],r=e=>{
        let n=e.role?.value;
        if(!n||n===`none`||n===`generic`){
          if(e.childIds?.length){
            let n=[];
            for(let i of e.childIds){let e=t.get(i);if(e){let t=r(e);t&&n.push(t)}}
            return n.length===1?n[0]:n.length>0?n:null
          }
          return null
        }
        let i={role:n};
        if(e.name?.value&&(i.name=e.name.value),e.value?.value&&(i.value=e.value.value),e.description?.value&&(i.description=e.description.value),re.has(n)&&e.backendDOMNodeId!=null&&(i.ref=`@${ae(e.backendDOMNodeId,n,e.name?.value??``)}`),e.childIds?.length){
          let n=[];
          for(let i of e.childIds){let e=t.get(i);if(e){let t=r(e);t&&(Array.isArray(t)?n.push(...t):n.push(t))}}
          n.length>0&&(i.children=n)
        }
        return i
      };
      if(e.childIds)for(let i of e.childIds){let e=t.get(i);if(e){let t=r(e);t&&(Array.isArray(t)?n.push(...t):n.push(t))}}
      return n
    }
  },
  se=class{
    name=`click`;
    async execute(e){
      let t=e.selector;
      if(!t)throw Error(`click: selector is required (CSS selector or @e ref)`);
      if(await isSensitiveAction(t) && !e._approved){
        return {
          success: false,
          require_confirmation: true,
          message: `Sensitive action detected on selector "${t}". Please verify and run the tool again with "_approved: true" to proceed.`
        };
      }
      return await i((await s()).id),D(t)?this.clickByRef(t):this.clickBySelector(t)
    }
    async clickByRef(e){
      let t=E(e);
      if(!t)throw Error(`click: unknown ref "${e}". Run snapshot first to get refs.`);
      let{object:n}=await a(`DOM.resolveNode`,{backendNodeId:t.backendDOMNodeId});
      if(!n?.objectId)throw Error(`click: could not resolve ref "${e}" to DOM element`);
      let r=await a(`Runtime.callFunctionOn`,{objectId:n.objectId,functionDeclaration:`function() {
         this.scrollIntoView({ block: 'center' });
         this.click();
         return { success: true, tag: this.tagName, text: this.textContent?.slice(0, 100) };
       }`,returnByValue:!0});
      if(r.exceptionDetails)throw Error(`click: ${r.exceptionDetails.text}`);
      return r.result.value||{success:!0}
    }
    async clickBySelector(e){
      let params={expression:`(() => {
         const el = document.querySelector(${JSON.stringify(e)});
         if (!el) return { error: 'element not found: ${e}' };
         el.scrollIntoView({ block: 'center' });
         el.click();
         return { success: true, tag: el.tagName, text: el.textContent?.slice(0, 100) };
       })()`,returnByValue:!0,awaitPromise:!1};
      let ctxId=getContextId();
      if(ctxId!==undefined)params.contextId=ctxId;
      let t=await a(`Runtime.evaluate`,params);
      if(t.exceptionDetails)throw Error(`click: ${t.exceptionDetails.text}`);
      let n=t.result.value;
      if(n?.error){
        let healed = await trySelfHealingClick(e);
        if (healed) return healed;
        throw Error(n.error);
      }
      return n||{success:!0}
    }
  },
  ce=class{
    name=`fill`;
    async execute(e){
      let t=e.selector,n=e.value;
      if(!t)throw Error(`fill: selector is required (CSS selector or @e ref)`);
      if(n==null)throw Error(`fill: value is required`);
      if(await isSensitiveAction(t) && !e._approved){
        return {
          success: false,
          require_confirmation: true,
          message: `Sensitive action detected on selector "${t}". Please verify and run the tool again with "_approved: true" to proceed.`
        };
      }
      return await i((await s()).id),D(t)?this.fillByRef(t,n):this.fillBySelector(t,n)
    }
    async fillByRef(e,t){
      let n=E(e);
      if(!n)throw Error(`fill: unknown ref "${e}". Run snapshot first to get refs.`);
      let{object:r}=await a(`DOM.resolveNode`,{backendNodeId:n.backendDOMNodeId});
      if(!r?.objectId)throw Error(`fill: could not resolve ref "${e}" to DOM element`);
      let i=await a(`Runtime.callFunctionOn`,{objectId:r.objectId,functionDeclaration:`function() { ${O(`this`,t)} }`,returnByValue:!0});
      if(i.exceptionDetails)throw Error(`fill: ${i.exceptionDetails.text}`);
      return i.result.value||{success:!0}
    }
    async fillBySelector(e,t){
      let params={expression:`(() => {
         const el = document.querySelector(${JSON.stringify(e)});
         if (!el) return { error: 'element not found: ${e}' };
         ${O(`el`,t)}
       })()`,returnByValue:!0,awaitPromise:!1};
      let ctxId=getContextId();
      if(ctxId!==undefined)params.contextId=ctxId;
      let n=await a(`Runtime.evaluate`,params);
      if(n.exceptionDetails)throw Error(`fill: ${n.exceptionDetails.text}`);
      let r=n.result.value;
      if(r?.error){
        let healed = await trySelfHealingFill(e, t);
        if (healed) return healed;
        throw Error(r.error);
      }
      return r||{success:!0}
    }
  };
  
  function O(e,t){
    let n=JSON.stringify(t);
    return`
    const __target = ${e};
    __target.focus();
    if (__target.isContentEditable) {
      const __sel = window.getSelection();
      if (__sel) {
        const __range = document.createRange();
        __range.selectNodeContents(__target);
        __sel.removeAllRanges();
        __sel.addRange(__range);
      }
      let __inserted = false;
      try {
        __inserted = document.execCommand('insertText', false, ${n});
      } catch (_e) {
        __inserted = false;
      }
      if (!__inserted) {
        __target.textContent = ${n};
        __target.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: ${n},
          bubbles: true,
        }));
      }
      return { success: true, tag: __target.tagName, mode: 'contenteditable' };
    }
    const __nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    if (__nativeSetter) {
      __nativeSetter.call(__target, ${n});
    } else {
      __target.value = ${n};
    }
    __target.dispatchEvent(new Event('input', { bubbles: true }));
    __target.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, tag: __target.tagName, mode: 'value' };
  `}
  
  var le=class{
    name=`mouse_click`;
    async execute(e){
      let t=e.selector;
      if(!t)throw Error(`mouse_click: selector is required (CSS selector or @e ref)`);
      if(await isSensitiveAction(t) && !e._approved){
        return {
          success: false,
          require_confirmation: true,
          message: `Sensitive action detected on selector "${t}". Please verify and run the tool again with "_approved: true" to proceed.`
        };
      }
      await i((await s()).id);
      let n=D(t)?await this.objectIdFromRef(t):await this.objectIdFromSelector(t);
      await a(`Runtime.callFunctionOn`,{objectId:n,functionDeclaration:`function() { this.scrollIntoView({ block: 'center', inline: 'center' }); }`});
      let r;
      try{r=await a(`DOM.getBoxModel`,{objectId:n})}catch(e){throw Error(`mouse_click: element has no layout box (display:none / detached / zero-size). Use 'click' for DOM-level fallback. (CDP: ${e.message})`)}
      if(!r.model||!r.model.content||r.model.content.length<8)throw Error(`mouse_click: element has no layout box (display:none / detached / zero-size). Use 'click' for DOM-level fallback.`);
      let o=r.model.content,c=(o[0]+o[2]+o[4]+o[6])/4,l=(o[1]+o[3]+o[5]+o[7])/4;
      await moveMouseHumanLike(c, l);
      await a(`Input.dispatchMouseEvent`,{type:`mousePressed`,x:c,y:l,button:`left`,buttons:1,clickCount:1});
      await new Promise(r => setTimeout(r, 50 + Math.random() * 80));
      await a(`Input.dispatchMouseEvent`,{type:`mouseReleased`,x:c,y:l,button:`left`,buttons:0,clickCount:1});
      let u=await a(`Runtime.callFunctionOn`,{objectId:n,functionDeclaration:`function() { return { tag: this.tagName, text: (this.textContent || '').slice(0, 100) }; }`,returnByValue:!0});
      return{success:!0,x:Math.round(c),y:Math.round(l),tag:u.result.value?.tag??``,text:u.result.value?.text??``}
    }
    async objectIdFromRef(e){
      let t=E(e);
      if(!t)throw Error(`mouse_click: unknown ref "${e}". Run snapshot first to get refs.`);
      let{object:n}=await a(`DOM.resolveNode`,{backendNodeId:t.backendDOMNodeId});
      if(!n?.objectId)throw Error(`mouse_click: could not resolve ref "${e}" to DOM element`);
      return n.objectId
    }
    async objectIdFromSelector(e){
      let params={expression:`document.querySelector(${JSON.stringify(e)})`,returnByValue:!1};
      let ctxId=getContextId();
      if(ctxId!==undefined)params.contextId=ctxId;
      let t=await a(`Runtime.evaluate`,params);
      if(t.exceptionDetails)throw Error(`mouse_click: ${t.exceptionDetails.text}`);
      if(t.result.subtype===`null`||!t.result.objectId)throw Error(`mouse_click: element not found: ${e}`);
      return t.result.objectId
    }
  },
  ue=class{
    name=`cdp`;
    async execute(e){
      let t=e.method;
      if(!t)throw Error(`cdp: method is required (e.g., "Input.dispatchMouseEvent")`);
      let n=e.params??{};
      await i((await s()).id);
      let r=await a(t,n);
      return r==null?{}:typeof r==`object`&&!Array.isArray(r)?r:{value:r}
    }
  },
  k=class{
    name=`key_type`;
    async execute(e){
      let t=e.text;
      if(typeof t!=`string`)throw Error(`key_type: text is required (string)`);
      await i((await s()).id);
      for (let char of t) {
        if (/[a-zA-Z]/.test(char) && Math.random() < 0.05) {
          const typos = {
            a:'qwsz', b:'vghn', c:'xdfv', d:'ersfxc', e:'wsdr', f:'rtgvcd', g:'tyhbvf', h:'yujnbg',
            i:'ujko', j:'uikmnh', k:'ijlm', l:'okp', m:'njk', n:'bhjm', o:'iklp', p:'ol',
            q:'wa', r:'edft', s:'wadzx', t:'rfgy', u:'yhji', v:'cfgb', w:'qase', x:'zsdc',
            y:'tghu', z:'asx'
          };
          let possibleTypos = typos[char.toLowerCase()] || '';
          if (possibleTypos) {
            let typoChar = possibleTypos[Math.floor(Math.random() * possibleTypos.length)];
            await a(`Input.insertText`, { text: typoChar }).catch(()=>{});
            await new Promise(r => setTimeout(r, 80 + Math.random() * 100));
            await a(`Input.dispatchKeyEvent`, { type: 'rawKeyDown', windowsVirtualKeyCode: 8, key: 'Backspace', code: 'Backspace' }).catch(()=>{});
            await a(`Input.dispatchKeyEvent`, { type: 'keyUp', windowsVirtualKeyCode: 8, key: 'Backspace', code: 'Backspace' }).catch(()=>{});
            await new Promise(r => setTimeout(r, 100 + Math.random() * 120));
          }
        }
        await a(`Input.insertText`, { text: char }).catch(()=>{});
        await new Promise(r => setTimeout(r, 30 + Math.random() * 70));
      }
      return { success: true, length: t.length }
    }
  },
  A={alt:{bit:1,key:`Alt`,code:`AltLeft`,vkc:18},ctrl:{bit:2,key:`Control`,code:`ControlLeft`,vkc:17},control:{bit:2,key:`Control`,code:`ControlLeft`,vkc:17},cmd:{bit:4,key:`Meta`,code:`MetaLeft`,vkc:91},meta:{bit:4,key:`Meta`,code:`MetaLeft`,vkc:91},shift:{bit:8,key:`Shift`,code:`ShiftLeft`,vkc:16}},
  j=A.shift.bit,
  M=null;
  
  async function N(){return M===null&&(M=(await chrome.runtime.getPlatformInfo()).os),M}
  function P(e){return e===`mac`?A.cmd:A.ctrl}
  
  var F={enter:{key:`Enter`,code:`Enter`,vkc:13,text:`\r`},return:{key:`Enter`,code:`Enter`,vkc:13,text:`\r`},escape:{key:`Escape`,code:`Escape`,vkc:27},esc:{key:`Escape`,code:`Escape`,vkc:27},tab:{key:`Tab`,code:`Tab`,vkc:9},backspace:{key:`Backspace`,code:`Backspace`,vkc:8},delete:{key:`Delete`,code:`Delete`,vkc:46},space:{key:` `,code:`Space`,vkc:32,text:` `},arrowup:{key:`ArrowUp`,code:`ArrowUp`,vkc:38},arrowdown:{key:`ArrowDown`,code:`ArrowDown`,vkc:40},arrowleft:{key:`ArrowLeft`,code:`ArrowLeft`,vkc:37},arrowright:{key:`ArrowRight`,code:`ArrowRight`,vkc:39},home:{key:`Home`,code:`Home`,vkc:36},end:{key:`End`,code:`End`,vkc:35},pageup:{key:`PageUp`,code:`PageUp`,vkc:33},pagedown:{key:`PageDown`,code:`PageDown`,vkc:34}};
  
  function I(e){
    let t=e.toLowerCase();
    if(F[t])return F[t];
    let n=t.match(/^f(\d{1,2})$/);
    if(n){let e=parseInt(n[1],10);if(e>=1&&e<=12)return{key:`F${e}`,code:`F${e}`,vkc:111+e}}
    if(e.length===1){
      if(/^[a-zA-Z]$/.test(e)){let t=e.toLowerCase(),n=e.toUpperCase();return{key:t,code:`Key${n}`,vkc:n.charCodeAt(0),text:t}}
      if(/^[0-9]$/.test(e))return{key:e,code:`Digit${e}`,vkc:e.charCodeAt(0),text:e}
    }
    throw Error(`send_keys: unknown key "${e}". Supported: ${Object.keys(F).join(`, `)}, F1-F12, single letters/digits.`)
  }
  
  function L(e,t){
    let n=e.split(`+`).map(e=>e.trim()).filter(Boolean);
    if(n.length===0)throw Error(`send_keys: empty segment`);
    let r=0,i=[];
    for(let e=0;e<n.length-1;e++){
      let a=n[e].toLowerCase(),o=a===`mod`?t:A[a];
      if(o===void 0)throw Error(`send_keys: "${n[e]}" is not a modifier. Use Alt/Ctrl/Cmd/Meta/Shift, or Mod (auto-resolves to Cmd on Mac, Ctrl on Win/Linux).`);
      r|=o.bit,i.push(o)
    }
    let a=I(n[n.length-1]);
    return{modifierBits:r,modifierKeys:i,spec:a}
  }
  
  function R(e,t){
    if(!t||e.key.length!==1||!/^[a-z]$/.test(e.key))return e;
    let n=e.key.toUpperCase();
    return{...e,key:n,text:n}
  }
  
  var z=class{
    name=`send_keys`;
    async execute(e){
      let t=e.keys;
      if(typeof t!=`string`||!t.trim())throw Error(`send_keys: keys is required (string), e.g. "Enter" or "Mod+A" or "Shift+Tab" or "Enter Escape"`);
      let n=e.repeat,r=n===void 0?1:Number(n);
      if(!Number.isInteger(r)||r<1||r>100)throw Error(`send_keys: repeat must be an integer in [1, 100]`);
      let o=await N(),c=P(o),l=t.trim().split(/\s+/).map(e=>L(e,c));
      await i((await s()).id);
      let u=0;
      for(let e=0;e<r;e++)for(let{modifierBits:e,modifierKeys:t,spec:n}of l){
        let r=R(n,(e&j)!==0),i=0;
        for(let e of t)i|=e.bit,await a(`Input.dispatchKeyEvent`,{type:`keyDown`,modifiers:i,key:e.key,code:e.code,windowsVirtualKeyCode:e.vkc});
        let o=(e&~j)===0&&r.text!==void 0?{text:r.text}:{};
        await a(`Input.dispatchKeyEvent`,{type:`keyDown`,modifiers:e,key:r.key,code:r.code,windowsVirtualKeyCode:r.vkc,...o}),
        await a(`Input.dispatchKeyEvent`,{type:`keyUp`,modifiers:e,key:r.key,code:r.code,windowsVirtualKeyCode:r.vkc});
        for(let e=t.length-1;e>=0;e--){let n=t[e];i&=~n.bit,await a(`Input.dispatchKeyEvent`,{type:`keyUp`,modifiers:i,key:n.key,code:n.code,windowsVirtualKeyCode:n.vkc})}
        u++
      }
      return{success:!0,dispatched:u,os:o}
    }
  },
  B=class{
    name=`screenshot`;
    async execute(e){
      await i((await s()).id);
      let t=e.format||`png`,n=t===`jpeg`?e.quality||80:void 0,r=typeof e.selector==`string`?e.selector:``,o={format:t};
      if(n!==void 0&&(o.quality=n),r){
        let e=D(r)?await this.objectIdFromRef(r):await this.objectIdFromSelector(r);
        await a(`Runtime.callFunctionOn`,{objectId:e,functionDeclaration:`function() { this.scrollIntoView({ block: 'center', inline: 'center' }); }`});
        let t;
        try{t=await a(`DOM.getBoxModel`,{objectId:e})}catch(e){throw Error(`screenshot: element has no layout box (display:none / detached / zero-size). (CDP: ${e.message})`)}
        let n=t.model?.border;
        if(!n||n.length<8)throw Error(`screenshot: element has no layout box (display:none / detached / zero-size).`);
        let i=[n[0],n[2],n[4],n[6]],s=[n[1],n[3],n[5],n[7]],c=Math.min(...i),l=Math.min(...s),u=Math.max(...i)-c,d=Math.max(...s)-l;
        if(u<=0||d<=0)throw Error(`screenshot: element has zero-size box (width=${u}, height=${d}).`);
        o.clip={x:c,y:l,width:u,height:d,scale:1}
      }
      let c=await a(`Page.captureScreenshot`,o);
      return{format:t,dataLength:c.data.length,data:c.data}
    }
    async objectIdFromRef(e){
      let t=E(e);
      if(!t)throw Error(`screenshot: unknown ref "${e}". Run snapshot first to get refs.`);
      let{object:n}=await a(`DOM.resolveNode`,{backendNodeId:t.backendDOMNodeId});
      if(!n?.objectId)throw Error(`screenshot: could not resolve ref "${e}" to DOM element`);
      return n.objectId
    }
    async objectIdFromSelector(e){
      let params={expression:`document.querySelector(${JSON.stringify(e)})`,returnByValue:!1};
      let ctxId=getContextId();
      if(ctxId!==undefined)params.contextId=ctxId;
      let t=await a(`Runtime.evaluate`,params);
      if(t.exceptionDetails)throw Error(`screenshot: ${t.exceptionDetails.text}`);
      if(t.result.subtype===`null`||!t.result.objectId)throw Error(`screenshot: element not found: ${e}`);
      return t.result.objectId
    }
  },
  V={letter:[8.5,11],legal:[8.5,14],a4:[8.27,11.69],a3:[11.69,16.54],tabloid:[11,17]},
  H=class{
    name=`save_as_pdf`;
    async execute(e){
      await i((await s()).id);
      let[t,n]=V[(e.paper_format||`letter`).toLowerCase()]??V.letter,r=typeof e.scale==`number`?e.scale:1;
      if(r<.1||r>2)throw Error(`save_as_pdf: scale must be in [0.1, 2.0], got ${r}`);
      let o=await a(`Page.printToPDF`,{printBackground:e.print_background!==!1,landscape:!!e.landscape,scale:r,paperWidth:t,paperHeight:n,preferCSSPageSize:!0});
      if(!o?.data)throw Error(`save_as_pdf: CDP Page.printToPDF returned no data`);
      let c=``;
      try{c=(await a(`Runtime.evaluate`,{expression:`document.title`,returnByValue:!0})).result?.value??``}catch{}
      return{data:o.data,mimeType:`application/pdf`,dataLength:o.data.length,pageTitle:c,requestedFileName:e.file_name||``}
    }
  },
  U=class{
    name=`upload`;
    async execute(e){
      let t=e.selector,n=e.files;
      if(!t)throw Error(`upload: selector is required (CSS selector for file input)`);
      if(!n||!Array.isArray(n)||n.length===0)throw Error(`upload: files is required (array of local file paths)`);
      await i((await s()).id);
      let{nodeId:r}=await a(`DOM.querySelector`,{nodeId:(await a(`DOM.getDocument`)).root.nodeId,selector:t});
      if(!r)throw Error(`upload: element not found: ${t}`);
      return await a(`DOM.setFileInputFiles`,{files:n,nodeId:r}),{success:!0,selector:t,fileCount:n.length,files:n}
    }
  },
  de=class{
    name=`close_tab`;
    async execute(e){
      let t=e._tabId;
      if(t==null)return{success:!0,closed:!1,reason:`session has no tab`};
      try{return await chrome.tabs.remove(t),{success:!0,closed:!0}}catch{return{success:!0,closed:!1,reason:`tab already closed`}}
    }
  },
  fe=class{
    name=`list_tabs`;
    async execute(e){
      let t=pe(e);
      if(t.length===0)return{success:!0,tabs:[]};
      let n=[];
      for(let e of t)try{
        let t=await chrome.tabs.get(e),r;
        if(t.groupId!=null&&t.groupId!==chrome.tabGroups.TAB_GROUP_ID_NONE)try{r=(await chrome.tabGroups.get(t.groupId)).title}catch{}
        n.push({tabId:t.id,url:t.url??``,title:t.title??``,active:t.active,groupTitle:r})
      }catch{}
      return{success:!0,tabs:n}
    }
  };
  
  function pe(e){let t=e._tabIds;if(Array.isArray(t)&&t.length>0)return t;let n=e._tabId;return n==null?[]:[n]}
  
  var me=class{
    name=`close_session`;
    async execute(e){
      let t=he(e);
      if(t.length===0)return{success:!0,closed:0};
      let n=0;
      for(let e of t)try{await chrome.tabs.remove(e),n++}catch{}
      return{success:!0,closed:n}
    }
  };
  
  function he(e){let t=e._tabIds;if(Array.isArray(t)&&t.length>0)return t;let n=e._tabId;return n==null?[]:[n]}
  
  // ==================== NEW TOOLS START ====================
  
  // P0 - Must Have
  class WaitForTool {
    name = `wait_for`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`wait_for: selector is required`);
      let state = e.state || `visible`;
      let timeout = e.timeout !== undefined ? Number(e.timeout) : 10000;
      let polling = e.polling !== undefined ? Number(e.polling) : 250;
      
      let startTime = Date.now();
      await i((await s()).id);
      
      while (true) {
        let isMatch = false;
        if (D(selector)) {
          let refObj = E(selector);
          if (refObj) {
            try {
              let { object } = await a(`DOM.resolveNode`, { backendNodeId: refObj.backendDOMNodeId });
              if (object && object.objectId) {
                if (state === `attached`) {
                  isMatch = true;
                } else if (state === `visible`) {
                  let box = await a(`DOM.getBoxModel`, { objectId: object.objectId }).catch(() => null);
                  if (box && box.model) isMatch = true;
                } else if (state === `hidden`) {
                  let box = await a(`DOM.getBoxModel`, { objectId: object.objectId }).catch(() => null);
                  if (!box || !box.model) isMatch = true;
                }
              } else {
                if (state === `detached` || state === `hidden`) isMatch = true;
              }
            } catch {
              if (state === `detached` || state === `hidden`) isMatch = true;
            }
          } else {
            if (state === `detached` || state === `hidden`) isMatch = true;
          }
        } else {
          let expression = `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { attached: false, visible: false };
            const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && 
                            window.getComputedStyle(el).visibility !== 'hidden' && 
                            window.getComputedStyle(el).display !== 'none';
            return { attached: true, visible };
          })()`;
          let params = { expression, returnByValue: true };
          let ctxId = getContextId();
          if (ctxId !== undefined) params.contextId = ctxId;
          
          let res = await a(`Runtime.evaluate`, params).catch(() => null);
          let val = res?.result?.value;
          if (val) {
            if (state === `attached` && val.attached) isMatch = true;
            else if (state === `detached` && !val.attached) isMatch = true;
            else if (state === `visible` && val.visible) isMatch = true;
            else if (state === `hidden` && !val.visible) isMatch = true;
          } else {
            if (state === `detached` || state === `hidden`) isMatch = true;
          }
        }
        
        if (isMatch) return { success: true, selector, state };
        if (Date.now() - startTime > timeout) {
          throw Error(`wait_for: timeout after ${timeout}ms waiting for ${selector} to be ${state}`);
        }
        await new Promise(r => setTimeout(r, polling));
      }
    }
  }

  class ExtractTextTool {
    name = `extract_text`;
    async execute(e) {
      let selector = e.selector;
      let format = e.format || `plain`;
      let maxLength = e.max_length !== undefined ? Number(e.max_length) : 50000;
      
      await i((await s()).id);
      let expression = ``;
      if (selector) {
        if (D(selector)) {
          let refObj = E(selector);
          if (!refObj) throw Error(`extract_text: unknown ref "${selector}"`);
          let { object } = await a(`DOM.resolveNode`, { backendNodeId: refObj.backendDOMNodeId });
          if (!object?.objectId) throw Error(`extract_text: could not resolve ref "${selector}"`);
          
          let func = `function() {
            if (${JSON.stringify(format)} === 'html') return this.innerHTML;
            return this.innerText || this.textContent;
          }`;
          let res = await a(`Runtime.callFunctionOn`, { objectId: object.objectId, functionDeclaration: func, returnByValue: true });
          let text = res.result?.value ?? ``;
          return { text: text.slice(0, maxLength) };
        } else {
          expression = `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: 'element not found' };
            if (${JSON.stringify(format)} === 'html') return { text: el.innerHTML };
            return { text: el.innerText || el.textContent };
          })()`;
        }
      } else {
        expression = `(() => {
          if (${JSON.stringify(format)} === 'html') return { text: document.documentElement.innerHTML };
          return { text: document.body ? (document.body.innerText || document.body.textContent) : '' };
        })()`;
      }
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`extract_text: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`extract_text: ${val.error}`);
      let text = val?.text || (typeof val === `string` ? val : ``);
      return { text: text.slice(0, maxLength) };
    }
  }

  class HandleDialogTool {
    name = `handle_dialog`;
    async execute(e) {
      let action = e.action || `auto`;
      let promptText = e.prompt_text || ``;
      let persistent = !!e.persistent;
      
      await i((await s()).id);
      await a(`Page.enable`).catch(() => {});
      
      dialogConfig.active = true;
      dialogConfig.action = action;
      dialogConfig.promptText = promptText;
      dialogConfig.persistent = persistent;
      
      return { success: true, action, persistent };
    }
  }

  class ScrollTool {
    name = `scroll`;
    async execute(e) {
      let direction = e.direction || `down`;
      let amount = e.amount !== undefined ? Number(e.amount) : 500;
      let selector = e.selector;
      let smooth = e.smooth !== false;
      
      await i((await s()).id);
      
      let behavior = smooth ? `smooth` : `auto`;
      let expression = ``;
      
      if (selector) {
        if (D(selector)) {
          let refObj = E(selector);
          if (!refObj) throw Error(`scroll: unknown ref "${selector}"`);
          let { object } = await a(`DOM.resolveNode`, { backendNodeId: refObj.backendDOMNodeId });
          if (!object?.objectId) throw Error(`scroll: could not resolve ref "${selector}"`);
          
          let func = `function() {
            let x = 0, y = 0;
            if (${JSON.stringify(direction)} === 'down') y = ${amount};
            else if (${JSON.stringify(direction)} === 'up') y = -${amount};
            else if (${JSON.stringify(direction)} === 'right') x = ${amount};
            else if (${JSON.stringify(direction)} === 'left') x = -${amount};
            else if (${JSON.stringify(direction)} === 'bottom') y = this.scrollHeight;
            else if (${JSON.stringify(direction)} === 'top') y = -this.scrollHeight;
            
            this.scrollBy({ left: x, top: y, behavior: ${JSON.stringify(behavior)} });
            return { success: true };
          }`;
          let res = await a(`Runtime.callFunctionOn`, { objectId: object.objectId, functionDeclaration: func, returnByValue: true });
          return res.result?.value ?? { success: true };
        } else {
          expression = `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: 'element not found' };
            let x = 0, y = 0;
            if (${JSON.stringify(direction)} === 'down') y = ${amount};
            else if (${JSON.stringify(direction)} === 'up') y = -${amount};
            else if (${JSON.stringify(direction)} === 'right') x = ${amount};
            else if (${JSON.stringify(direction)} === 'left') x = -${amount};
            else if (${JSON.stringify(direction)} === 'bottom') y = el.scrollHeight;
            else if (${JSON.stringify(direction)} === 'top') y = -el.scrollHeight;
            
            el.scrollBy({ left: x, top: y, behavior: ${JSON.stringify(behavior)} });
            return { success: true };
          })()`;
        }
      } else {
        expression = `(() => {
          let x = 0, y = 0;
          if (${JSON.stringify(direction)} === 'down') y = ${amount};
          else if (${JSON.stringify(direction)} === 'up') y = -${amount};
          else if (${JSON.stringify(direction)} === 'right') x = ${amount};
          else if (${JSON.stringify(direction)} === 'left') x = -${amount};
          else if (${JSON.stringify(direction)} === 'bottom') y = document.documentElement.scrollHeight;
          else if (${JSON.stringify(direction)} === 'top') y = -document.documentElement.scrollHeight;
          
          window.scrollBy({ left: x, top: y, behavior: ${JSON.stringify(behavior)} });
          return { success: true };
        })()`;
      }
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`scroll: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`scroll: ${val.error}`);
      return val || { success: true };
    }
  }

  class IframeSwitchTool {
    name = `iframe_switch`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`iframe_switch: selector is required`);
      
      let tabId = (await s()).id;
      await i(tabId);
      
      await a(`Runtime.enable`).catch(() => {});
      
      if (selector === `_top`) {
        currentFrameId.delete(tabId);
        return { success: true, frameId: `_top` };
      }
      
      let contextId = undefined;
      if (currentFrameId.has(tabId)) {
        let fId = currentFrameId.get(tabId);
        let cMap = frameContexts.get(tabId);
        if (cMap && cMap.has(fId)) {
          contextId = cMap.get(fId);
        }
      }
      
      let evalParams = {
        expression: `document.querySelector(${JSON.stringify(selector)})`,
        contextId
      };
      let res = await a(`Runtime.evaluate`, evalParams);
      if (res.exceptionDetails) throw Error(`iframe_switch: ${res.exceptionDetails.text}`);
      if (res.result.subtype === `null` || !res.result.objectId) {
        throw Error(`iframe_switch: element not found: ${selector}`);
      }
      
      let objId = res.result.objectId;
      let nodeDesc = await a(`DOM.describeNode`, { objectId: objId });
      let frameId = nodeDesc.node?.frameId;
      if (!frameId) {
        throw Error(`iframe_switch: element is not a frame or iframe`);
      }
      
      currentFrameId.set(tabId, frameId);
      return { success: true, frameId };
    }
  }

  // P1 - High Value
  class HoverTool {
    name = `hover`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`hover: selector is required`);
      let duration = e.duration !== undefined ? Number(e.duration) : 0;
      
      await i((await s()).id);
      let objId = D(selector) ? await this.objectIdFromRef(selector) : await this.objectIdFromSelector(selector);
      
      await a(`Runtime.callFunctionOn`, {
        objectId: objId,
        functionDeclaration: `function() { this.scrollIntoView({ block: "center", inline: "center" }); }`
      });
      
      let box;
      try {
        box = await a(`DOM.getBoxModel`, { objectId: objId });
      } catch (err) {
        throw Error(`hover: element has no layout box. (CDP: ${err.message})`);
      }
      
      let content = box.model.content;
      let x = (content[0] + content[2] + content[4] + content[6]) / 4;
      let y = (content[1] + content[3] + content[5] + content[7]) / 4;
      
      await moveMouseHumanLike(x, y);
      
      if (duration > 0) {
        await new Promise(r => setTimeout(r, duration));
      }
      return { success: true, x: Math.round(x), y: Math.round(y) };
    }
    async objectIdFromRef(e) {
      let t = E(e);
      if (!t) throw Error(`hover: unknown ref "${e}"`);
      let { object: n } = await a(`DOM.resolveNode`, { backendNodeId: t.backendDOMNodeId });
      if (!n?.objectId) throw Error(`hover: could not resolve ref "${e}"`);
      return n.objectId;
    }
    async objectIdFromSelector(e) {
      let params = { expression: `document.querySelector(${JSON.stringify(e)})`, returnByValue: false };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let t = await a(`Runtime.evaluate`, params);
      if (t.exceptionDetails) throw Error(`hover: ${t.exceptionDetails.text}`);
      if (t.result.subtype === `null` || !t.result.objectId) throw Error(`hover: element not found: ${e}`);
      return t.result.objectId;
    }
  }

  class SelectOptionTool {
    name = `select_option`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`select_option: selector is required`);
      let value = e.value;
      if (value === undefined) throw Error(`select_option: value is required`);
      let by = e.by || `value`;
      
      await i((await s()).id);
      let values = Array.isArray(value) ? value : [value];
      
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found' };
        if (el.tagName !== 'SELECT') return { error: 'element is not a select dropdown' };
        
        const values = ${JSON.stringify(values)};
        const by = ${JSON.stringify(by)};
        let matchedCount = 0;
        
        for (let i = 0; i < el.options.length; i++) {
          const opt = el.options[i];
          let match = false;
          if (by === 'value') {
            match = values.includes(opt.value);
          } else if (by === 'text') {
            match = values.includes(opt.text || opt.textContent);
          } else if (by === 'index') {
            match = values.includes(i) || values.includes(String(i));
          }
          opt.selected = match;
          if (match) matchedCount++;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, matchedCount };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`select_option: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`select_option: ${val.error}`);
      return val || { success: true };
    }
  }

  class WaitForNetworkIdleTool {
    name = `wait_for_network_idle`;
    async execute(e) {
      let timeout = e.timeout !== undefined ? Number(e.timeout) : 15000;
      let idleTime = e.idle_time !== undefined ? Number(e.idle_time) : 500;
      let maxInflight = e.max_inflight !== undefined ? Number(e.max_inflight) : 0;
      
      let tabId = (await s()).id;
      await i(tabId);
      await a(`Network.enable`);
      
      let inflight = new Set();
      let requestListener = (event, method, params) => {
        if (event.tabId !== tabId) return;
        if (method === `Network.requestWillBeSent`) {
          inflight.add(params.requestId);
        } else if (method === `Network.loadingFinished` || method === `Network.loadingFailed`) {
          inflight.delete(params.requestId);
        }
      };
      
      chrome.debugger.onEvent.addListener(requestListener);
      let startTime = Date.now();
      let lastIdleTime = Date.now();
      
      try {
        while (true) {
          let now = Date.now();
          if (inflight.size > maxInflight) {
            lastIdleTime = now;
          }
          if (now - lastIdleTime >= idleTime) {
            return { success: true, elapsed: now - startTime };
          }
          if (now - startTime > timeout) {
            throw Error(`wait_for_network_idle: timeout after ${timeout}ms with ${inflight.size} requests in flight`);
          }
          await new Promise(r => setTimeout(r, 50));
        }
      } finally {
        chrome.debugger.onEvent.removeListener(requestListener);
        if (!b.has(tabId)) {
          await a(`Network.disable`).catch(() => {});
        }
      }
    }
  }

  class ExtractTableTool {
    name = `extract_table`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`extract_table: selector is required`);
      let headers = e.headers !== false;
      let format = e.format || `json`;
      
      await i((await s()).id);
      
      let expression = `(() => {
        const table = document.querySelector(${JSON.stringify(selector)});
        if (!table) return { error: 'element not found' };
        if (table.tagName !== 'TABLE') return { error: 'element is not a table' };
        
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return { data: [] };
        
        let startIdx = 0;
        let headerKeys = [];
        if (${headers}) {
          const firstRowCells = Array.from(rows[0].querySelectorAll('th, td')).map(c => (c.textContent || '').trim());
          headerKeys = firstRowCells;
          startIdx = 1;
        }
        
        const data = [];
        for (let i = startIdx; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => (c.textContent || '').trim());
          if (cells.length === 0) continue;
          
          if (${headers}) {
            const rowObj = {};
            for (let j = 0; j < headerKeys.length; j++) {
              rowObj[headerKeys[j] || ('column_' + j)] = cells[j] || '';
            }
            data.push(rowObj);
          } else {
            data.push(cells);
          }
        }
        
        if (${JSON.stringify(format)} === 'csv') {
          let csvContent = '';
          if (${headers}) {
            csvContent += headerKeys.join(',') + '\\n';
            data.forEach(row => {
              csvContent += Object.values(row).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',') + '\\n';
            });
          } else {
            data.forEach(row => {
              csvContent += row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',') + '\\n';
            });
          }
          return { csv: csvContent };
        }
        return { data };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`extract_table: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`extract_table: ${val.error}`);
      return val || { data: [] };
    }
  }

  class ConsoleLogTool {
    name = `console_log`;
    async execute(e) {
      let cmd = e.cmd || `list`;
      let level = e.level || `all`;
      let filter = e.filter || ``;
      
      let tabId = (await s()).id;
      await i(tabId);
      
      if (cmd === `start`) {
        consoleLogs.set(tabId, []);
        await a(`Runtime.enable`).catch(() => {});
        await a(`Log.enable`).catch(() => {});
        return { success: true, message: `console log capture started` };
      }
      if (cmd === `stop`) {
        consoleLogs.delete(tabId);
        return { success: true, message: `console log capture stopped` };
      }
      
      let logs = consoleLogs.get(tabId) || [];
      if (level !== `all`) {
        logs = logs.filter(l => l.level === level);
      }
      if (filter) {
        logs = logs.filter(l => l.text.toLowerCase().includes(filter.toLowerCase()));
      }
      return { count: logs.length, logs };
    }
  }

  // P2 - Nice to Have
  class DragDropTool {
    name = `drag_drop`;
    async execute(e) {
      let source = e.source;
      let target = e.target;
      if (!source || !target) throw Error(`drag_drop: source and target are required`);
      let steps = e.steps !== undefined ? Number(e.steps) : 10;
      
      await i((await s()).id);
      let srcObj = D(source) ? await this.objectIdFromRef(source) : await this.objectIdFromSelector(source);
      let destObj = D(target) ? await this.objectIdFromRef(target) : await this.objectIdFromSelector(target);
      
      await a(`Runtime.callFunctionOn`, {
        objectId: srcObj,
        functionDeclaration: `function() { this.scrollIntoView({ block: "center", inline: "center" }); }`
      });
      
      let srcBox = await a(`DOM.getBoxModel`, { objectId: srcObj });
      let destBox = await a(`DOM.getBoxModel`, { objectId: destObj });
      
      let srcContent = srcBox.model.content;
      let destContent = destBox.model.content;
      
      let srcX = (srcContent[0] + srcContent[2] + srcContent[4] + srcContent[6]) / 4;
      let srcY = (srcContent[1] + srcContent[3] + srcContent[5] + srcContent[7]) / 4;
      
      let destX = (destContent[0] + destContent[2] + destContent[4] + destContent[6]) / 4;
      let destY = (destContent[1] + destContent[3] + destContent[5] + destContent[7]) / 4;
      
      await a(`Input.dispatchMouseEvent`, { type: `mouseMoved`, x: srcX, y: srcY, button: `none`, buttons: 0 });
      await a(`Input.dispatchMouseEvent`, { type: `mousePressed`, x: srcX, y: srcY, button: `left`, buttons: 1, clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        let curX = srcX + (destX - srcX) * (i / steps);
        let curY = srcY + (destY - srcY) * (i / steps);
        await a(`Input.dispatchMouseEvent`, { type: `mouseMoved`, x: curX, y: curY, button: `left`, buttons: 1 });
        await new Promise(r => setTimeout(r, 20));
      }
      await a(`Input.dispatchMouseEvent`, { type: `mouseReleased`, x: destX, y: destY, button: `left`, buttons: 0, clickCount: 1 });
      return { success: true, from: { x: Math.round(srcX), y: Math.round(srcY) }, to: { x: Math.round(destX), y: Math.round(destY) } };
    }
    async objectIdFromRef(e) {
      let t = E(e);
      if (!t) throw Error(`drag_drop: unknown ref "${e}"`);
      let { object: n } = await a(`DOM.resolveNode`, { backendNodeId: t.backendDOMNodeId });
      if (!n?.objectId) throw Error(`drag_drop: could not resolve ref "${e}"`);
      return n.objectId;
    }
    async objectIdFromSelector(e) {
      let params = { expression: `document.querySelector(${JSON.stringify(e)})`, returnByValue: false };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let t = await a(`Runtime.evaluate`, params);
      if (t.exceptionDetails) throw Error(`drag_drop: ${t.exceptionDetails.text}`);
      if (t.result.subtype === `null` || !t.result.objectId) throw Error(`drag_drop: element not found: ${e}`);
      return t.result.objectId;
    }
  }

  class DoubleClickTool {
    name = `double_click`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`double_click: selector is required`);
      
      await i((await s()).id);
      let objId = D(selector) ? await this.objectIdFromRef(selector) : await this.objectIdFromSelector(selector);
      
      await a(`Runtime.callFunctionOn`, {
        objectId: objId,
        functionDeclaration: `function() { this.scrollIntoView({ block: "center", inline: "center" }); }`
      });
      
      let box = await a(`DOM.getBoxModel`, { objectId: objId });
      let content = box.model.content;
      let x = (content[0] + content[2] + content[4] + content[6]) / 4;
      let y = (content[1] + content[3] + content[5] + content[7]) / 4;
      
      await a(`Input.dispatchMouseEvent`, { type: `mouseMoved`, x, y, button: `none`, buttons: 0 });
      await a(`Input.dispatchMouseEvent`, { type: `mousePressed`, x, y, button: `left`, buttons: 1, clickCount: 1 });
      await a(`Input.dispatchMouseEvent`, { type: `mouseReleased`, x, y, button: `left`, buttons: 0, clickCount: 1 });
      await a(`Input.dispatchMouseEvent`, { type: `mousePressed`, x, y, button: `left`, buttons: 1, clickCount: 2 });
      await a(`Input.dispatchMouseEvent`, { type: `mouseReleased`, x, y, button: `left`, buttons: 0, clickCount: 2 });
      
      return { success: true, x: Math.round(x), y: Math.round(y) };
    }
    async objectIdFromRef(e) {
      let t = E(e);
      if (!t) throw Error(`double_click: unknown ref "${e}"`);
      let { object: n } = await a(`DOM.resolveNode`, { backendNodeId: t.backendDOMNodeId });
      if (!n?.objectId) throw Error(`double_click: could not resolve ref "${e}"`);
      return n.objectId;
    }
    async objectIdFromSelector(e) {
      let params = { expression: `document.querySelector(${JSON.stringify(e)})`, returnByValue: false };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let t = await a(`Runtime.evaluate`, params);
      if (t.exceptionDetails) throw Error(`double_click: ${t.exceptionDetails.text}`);
      if (t.result.subtype === `null` || !t.result.objectId) throw Error(`double_click: element not found: ${e}`);
      return t.result.objectId;
    }
  }

  class RightClickTool {
    name = `right_click`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`right_click: selector is required`);
      
      await i((await s()).id);
      let objId = D(selector) ? await this.objectIdFromRef(selector) : await this.objectIdFromSelector(selector);
      
      await a(`Runtime.callFunctionOn`, {
        objectId: objId,
        functionDeclaration: `function() { this.scrollIntoView({ block: "center", inline: "center" }); }`
      });
      
      let box = await a(`DOM.getBoxModel`, { objectId: objId });
      let content = box.model.content;
      let x = (content[0] + content[2] + content[4] + content[6]) / 4;
      let y = (content[1] + content[3] + content[5] + content[7]) / 4;
      
      await a(`Input.dispatchMouseEvent`, { type: `mouseMoved`, x, y, button: `none`, buttons: 0 });
      await a(`Input.dispatchMouseEvent`, { type: `mousePressed`, x, y, button: `right`, buttons: 2, clickCount: 1 });
      await a(`Input.dispatchMouseEvent`, { type: `mouseReleased`, x, y, button: `right`, buttons: 0, clickCount: 1 });
      return { success: true, x: Math.round(x), y: Math.round(y) };
    }
    async objectIdFromRef(e) {
      let t = E(e);
      if (!t) throw Error(`right_click: unknown ref "${e}"`);
      let { object: n } = await a(`DOM.resolveNode`, { backendNodeId: t.backendDOMNodeId });
      if (!n?.objectId) throw Error(`right_click: could not resolve ref "${e}"`);
      return n.objectId;
    }
    async objectIdFromSelector(e) {
      let params = { expression: `document.querySelector(${JSON.stringify(e)})`, returnByValue: false };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let t = await a(`Runtime.evaluate`, params);
      if (t.exceptionDetails) throw Error(`right_click: ${t.exceptionDetails.text}`);
      if (t.result.subtype === `null` || !t.result.objectId) throw Error(`right_click: element not found: ${e}`);
      return t.result.objectId;
    }
  }

  class FocusTool {
    name = `focus`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`focus: selector is required`);
      
      await i((await s()).id);
      let objId = D(selector) ? await this.objectIdFromRef(selector) : await this.objectIdFromSelector(selector);
      
      let res = await a(`Runtime.callFunctionOn`, {
        objectId: objId,
        functionDeclaration: `function() { this.focus(); return { success: true }; }`,
        returnByValue: true
      });
      if (res.exceptionDetails) throw Error(`focus: ${res.exceptionDetails.text}`);
      return res.result?.value || { success: true };
    }
    async objectIdFromRef(e) {
      let t = E(e);
      if (!t) throw Error(`focus: unknown ref "${e}"`);
      let { object: n } = await a(`DOM.resolveNode`, { backendNodeId: t.backendDOMNodeId });
      if (!n?.objectId) throw Error(`focus: could not resolve ref "${e}"`);
      return n.objectId;
    }
    async objectIdFromSelector(e) {
      let params = { expression: `document.querySelector(${JSON.stringify(e)})`, returnByValue: false };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      let t = await a(`Runtime.evaluate`, params);
      if (t.exceptionDetails) throw Error(`focus: ${t.exceptionDetails.text}`);
      if (t.result.subtype === `null` || !t.result.objectId) throw Error(`focus: element not found: ${e}`);
      return t.result.objectId;
    }
  }

  class ExtractLinksTool {
    name = `extract_links`;
    async execute(e) {
      let selector = e.selector;
      let filter = e.filter || ``;
      let includeText = e.include_text !== false;
      
      await i((await s()).id);
      let expression = `(() => {
        const container = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document'};
        if (!container) return { error: 'container element not found' };
        
        const links = Array.from(container.querySelectorAll('a'));
        let results = links.map(l => ({
          href: l.href,
          text: ${includeText} ? (l.textContent || '').trim() : undefined
        }));
        if (${JSON.stringify(filter)}) {
          const regex = new RegExp(${JSON.stringify(filter).replace(/\*/g, '.*')});
          results = results.filter(r => regex.test(r.href));
        }
        return { links: results };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`extract_links: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`extract_links: ${val.error}`);
      return val || { links: [] };
    }
  }

  class ExtractFormsTool {
    name = `extract_forms`;
    async execute(e) {
      let selector = e.selector;
      await i((await s()).id);
      
      let expression = `(() => {
        const container = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document'};
        if (!container) return { error: 'container element not found' };
        
        const forms = Array.from(container.querySelectorAll('form'));
        const results = forms.map(f => {
          const fields = Array.from(f.querySelectorAll('input, select, textarea')).map(el => ({
            name: el.name || el.id || '',
            type: el.tagName === 'INPUT' ? el.type : el.tagName.toLowerCase(),
            value: el.value || '',
            required: el.required || false,
            placeholder: el.placeholder || '',
            disabled: el.disabled || false
          }));
          return {
            id: f.id || '',
            action: f.action || '',
            method: f.method || 'get',
            fields
          };
        });
        return { forms: results };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`extract_forms: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`extract_forms: ${val.error}`);
      return val || { forms: [] };
    }
  }

  class ExtractMetaTool {
    name = `extract_meta`;
    async execute(e) {
      let includeJsonLd = e.include_jsonld !== false;
      let includeOg = e.include_og !== false;
      
      await i((await s()).id);
      let expression = `(() => {
        const meta = {};
        meta.title = document.title;
        const metas = Array.from(document.querySelectorAll('meta'));
        metas.forEach(m => {
          const name = m.getAttribute('name') || m.getAttribute('property');
          const content = m.getAttribute('content');
          if (name && content) {
            meta[name] = content;
          }
        });
        const links = Array.from(document.querySelectorAll('link'));
        links.forEach(l => {
          const rel = l.getAttribute('rel');
          if (rel === 'canonical' || rel === 'icon' || rel === 'shortcut icon') {
            meta[rel] = l.getAttribute('href');
          }
        });
        let jsonld = [];
        if (${includeJsonLd}) {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          scripts.forEach(s => {
            try {
              jsonld.push(JSON.parse(s.textContent || '{}'));
            } catch {}
          });
        }
        return { meta, jsonld };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`extract_meta: ${res.exceptionDetails.text}`);
      return res.result?.value || { meta: {}, jsonld: [] };
    }
  }

  class QuerySelectorAllTool {
    name = `query_selector_all`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`query_selector_all: selector is required`);
      let attributes = e.attributes || [];
      let limit = e.limit !== undefined ? Number(e.limit) : 100;
      
      await i((await s()).id);
      let expression = `(() => {
        const els = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).slice(0, ${limit});
        const attrs = ${JSON.stringify(attributes)};
        return els.map(el => {
          const obj = {
            tagName: el.tagName,
            text: (el.textContent || '').trim().slice(0, 100)
          };
          attrs.forEach(a => {
            obj[a] = el.getAttribute(a) || '';
          });
          return obj;
        });
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`query_selector_all: ${res.exceptionDetails.text}`);
      return { results: res.result?.value || [] };
    }
  }

  class AssertTool {
    name = `assert`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`assert: selector is required`);
      let condition = e.condition || `exists`;
      let value = e.value || ``;
      
      await i((await s()).id);
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) {
          return { success: false, reason: 'element not found' };
        }
        if (${JSON.stringify(condition)} === 'exists') {
          return { success: true };
        }
        if (${JSON.stringify(condition)} === 'visible') {
          const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && 
                          window.getComputedStyle(el).visibility !== 'hidden' && 
                          window.getComputedStyle(el).display !== 'none';
          return { success: visible, reason: visible ? '' : 'element is hidden' };
        }
        if (${JSON.stringify(condition)} === 'text_contains') {
          const text = (el.textContent || '').trim().toLowerCase();
          const search = ${JSON.stringify(value)}.toLowerCase();
          const ok = text.includes(search);
          return { success: ok, reason: ok ? '' : 'text "' + text + '" does not contain "' + search + '"' };
        }
        if (${JSON.stringify(condition)} === 'has_class') {
          const ok = el.classList.contains(${JSON.stringify(value)});
          return { success: ok, reason: ok ? '' : 'element classes are "' + el.className + '"' };
        }
        return { success: false, reason: 'unknown condition' };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`assert: ${res.exceptionDetails.text}`);
      return res.result?.value || { success: false, reason: `no result` };
    }
  }

  class BatchTool {
    name = `batch`;
    async execute(e) {
      let commands = e.commands;
      if (!commands || !Array.isArray(commands)) throw Error(`batch: commands must be an array`);
      let stopOnError = e.stop_on_error !== false;
      
      let results = [];
      for (let cmd of commands) {
        try {
          let result = await _e(cmd.tool, cmd.args || {});
          results.push({ tool: cmd.tool, success: true, result });
        } catch (err) {
          results.push({ tool: cmd.tool, success: false, error: err.message });
          if (stopOnError) break;
        }
      }
      return { results };
    }
  }

  // P3 - Extra Nice to Have
  class GetCookiesTool {
    name = `get_cookies`;
    async execute(e) {
      await i((await s()).id);
      let params = {};
      if (e.domain) params.urls = [e.domain];
      
      let res = await a(`Network.getCookies`, params).catch(async () => {
        let currentTab = await s();
        if (currentTab?.url) {
          let ck = await chrome.cookies.getAll({ url: currentTab.url });
          return { cookies: ck };
        }
        return { cookies: [] };
      });
      let cookies = res.cookies || [];
      if (e.name) {
        cookies = cookies.filter(c => c.name === e.name);
      }
      return { cookies };
    }
  }

  class SetCookieTool {
    name = `set_cookie`;
    async execute(e) {
      let name = e.name;
      let value = e.value;
      let domain = e.domain;
      if (!name || value === undefined || !domain) throw Error(`set_cookie: name, value, and domain are required`);
      let path = e.path || `/`;
      
      await i((await s()).id);
      let params = { name, value, domain, path };
      if (e.expires) params.expires = Number(e.expires);
      
      await a(`Network.setCookie`, params).catch(async () => {
        let currentTab = await s();
        if (currentTab?.url) {
          await chrome.cookies.set({
            url: currentTab.url,
            name,
            value,
            domain,
            path,
            expirationDate: e.expires ? Number(e.expires) : undefined
          });
        }
      });
      return { success: true };
    }
  }

  class LocalStorageTool {
    name = `local_storage`;
    async execute(e) {
      let cmd = e.cmd;
      if (!cmd) throw Error(`local_storage: cmd is required (get/set/remove/clear/keys)`);
      let key = e.key;
      let value = e.value;
      
      await i((await s()).id);
      let expression = ``;
      if (cmd === `get`) {
        if (!key) throw Error(`local_storage: key is required for get`);
        expression = `localStorage.getItem(${JSON.stringify(key)})`;
      } else if (cmd === `set`) {
        if (!key || value === undefined) throw Error(`local_storage: key and value are required for set`);
        expression = `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)}) || true`;
      } else if (cmd === `remove`) {
        if (!key) throw Error(`local_storage: key is required for remove`);
        expression = `localStorage.removeItem(${JSON.stringify(key)}) || true`;
      } else if (cmd === `clear`) {
        expression = `localStorage.clear() || true`;
      } else if (cmd === `keys`) {
        expression = `Object.keys(localStorage)`;
      }
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`local_storage: ${res.exceptionDetails.text}`);
      return { value: res.result?.value };
    }
  }

  class EmulateDeviceTool {
    name = `emulate_device`;
    async execute(e) {
      let device = e.device;
      let width = e.width ? Number(e.width) : undefined;
      let height = e.height ? Number(e.height) : undefined;
      let userAgent = e.user_agent;
      let touch = e.touch;
      
      let presets = {
        'iphone 15': { width: 393, height: 852, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', touch: true, scale: 3, mobile: true },
        'pixel 8': { width: 412, height: 915, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', touch: true, scale: 2.63, mobile: true },
        'ipad pro': { width: 1024, height: 1366, ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', touch: true, scale: 2, mobile: true }
      };
      
      let config = {};
      if (device && presets[device.toLowerCase()]) {
        let p = presets[device.toLowerCase()];
        config.width = width || p.width;
        config.height = height || p.height;
        config.ua = userAgent || p.ua;
        config.touch = touch !== undefined ? touch : p.touch;
        config.scale = p.scale;
        config.mobile = p.mobile;
      } else {
        config.width = width || 1280;
        config.height = height || 800;
        config.ua = userAgent || ``;
        config.touch = !!touch;
        config.scale = 1;
        config.mobile = false;
      }
      
      await i((await s()).id);
      await a(`Emulation.setDeviceMetricsOverride`, {
        width: config.width,
        height: config.height,
        deviceScaleFactor: config.scale,
        mobile: config.mobile,
        screenOrientation: { angle: 0, type: config.width > config.height ? `landscapePrimary` : `portraitPrimary` }
      });
      if (config.ua) {
        await a(`Network.setUserAgentOverride`, { userAgent: config.ua });
      }
      await a(`Emulation.setTouchEmulationEnabled`, {
        enabled: config.touch,
        maxTouchPoints: config.touch ? 5 : 0
      });
      return { success: true, emulated: config };
    }
  }

  class SetGeolocationTool {
    name = `set_geolocation`;
    async execute(e) {
      let lat = e.latitude;
      let lon = e.longitude;
      if (lat === undefined || lon === undefined) throw Error(`set_geolocation: latitude and longitude are required`);
      let acc = e.accuracy !== undefined ? Number(e.accuracy) : 1;
      
      await i((await s()).id);
      await a(`Emulation.setGeolocationOverride`, {
        latitude: Number(lat),
        longitude: Number(lon),
        accuracy: acc
      });
      return { success: true };
    }
  }

  class InjectCssTool {
    name = `inject_css`;
    async execute(e) {
      let css = e.css;
      if (!css) throw Error(`inject_css: css content is required`);
      
      await i((await s()).id);
      let expression = `(() => {
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(css)};
        document.head.appendChild(style);
        return { success: true };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`inject_css: ${res.exceptionDetails.text}`);
      return res.result?.value || { success: true };
    }
  }

  class PageHashTool {
    name = `page_hash`;
    async execute(e) {
      let selector = e.selector;
      await i((await s()).id);
      
      let expression = `(() => {
        const target = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
        if (!target) return { error: 'target element not found' };
        const text = target.innerText || target.textContent || '';
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) + hash) + text.charCodeAt(i);
          hash = hash & hash;
        }
        return { hash: String(hash) };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`page_hash: ${res.exceptionDetails.text}`);
      return res.result?.value || { error: `no result` };
    }
  }

  class PerformanceMetricsTool {
    name = `performance_metrics`;
    async execute(e) {
      await i((await s()).id);
      await a(`Performance.enable`).catch(() => {});
      let res = await a(`Performance.getMetrics`);
      let metrics = {};
      if (res.metrics) {
        res.metrics.forEach(m => { metrics[m.name] = m.value; });
      }
      return { metrics };
    }
  }

  class GetAttributeTool {
    name = `get_attribute`;
    async execute(e) {
      let selector = e.selector;
      let attribute = e.attribute;
      if (!selector || !attribute) throw Error(`get_attribute: selector and attribute are required`);
      
      await i((await s()).id);
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found' };
        return { value: el.getAttribute(${JSON.stringify(attribute)}) };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`get_attribute: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`get_attribute: ${val.error}`);
      return val || { value: null };
    }
  }

  class SetAttributeTool {
    name = `set_attribute`;
    async execute(e) {
      let selector = e.selector;
      let attribute = e.attribute;
      let value = e.value;
      if (!selector || !attribute || value === undefined) throw Error(`set_attribute: selector, attribute, and value are required`);
      
      await i((await s()).id);
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found' };
        el.setAttribute(${JSON.stringify(attribute)}, ${JSON.stringify(value)});
        return { success: true };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`set_attribute: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`set_attribute: ${val.error}`);
      return val || { success: true };
    }
  }

  class ClearFieldTool {
    name = `clear_field`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`clear_field: selector is required`);
      
      await i((await s()).id);
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found' };
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`clear_field: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`clear_field: ${val.error}`);
      return val || { success: true };
    }
  }

  class CheckCheckboxTool {
    name = `check_checkbox`;
    async execute(e) {
      let selector = e.selector;
      if (!selector) throw Error(`check_checkbox: selector is required`);
      let checked = e.checked !== false;
      
      await i((await s()).id);
      let expression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'element not found' };
        if (el.tagName !== 'INPUT' || (el.type !== 'checkbox' && el.type !== 'radio')) {
          return { error: 'element is not a checkbox or radio input' };
        }
        if (el.checked !== ${checked}) {
          el.checked = ${checked};
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return { success: true, checked: el.checked };
      })()`;
      
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`check_checkbox: ${res.exceptionDetails.text}`);
      let val = res.result?.value;
      if (val?.error) throw Error(`check_checkbox: ${val.error}`);
      return val || { success: true };
    }
  }

  class GetPageSourceTool {
    name = `get_page_source`;
    async execute(e) {
      await i((await s()).id);
      let expression = `document.documentElement.outerHTML`;
      let params = { expression, returnByValue: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`get_page_source: ${res.exceptionDetails.text}`);
      return { source: res.result?.value || `` };
    }
  }

  class BlockUrlsTool {
    name = `block_urls`;
    async execute(e) {
      let patterns = e.patterns;
      if (!patterns || !Array.isArray(patterns)) throw Error(`block_urls: patterns must be an array of strings`);
      
      await i((await s()).id);
      await a(`Network.enable`);
      await a(`Network.setBlockedURLs`, { urls: patterns });
      return { success: true, blocked: patterns };
    }
  }

  class SetUserAgentTool {
    name = `set_user_agent`;
    async execute(e) {
      let ua = e.user_agent;
      if (!ua) throw Error(`set_user_agent: user_agent is required`);
      
      await i((await s()).id);
      await a(`Network.setUserAgentOverride`, { userAgent: ua });
      return { success: true };
    }
  }

  class LocalAiTool {
    name = `local_ai`;
    async execute(e) {
      let prompt = e.prompt;
      if (!prompt) throw Error(`local_ai: prompt is required`);
      let systemPrompt = e.system_prompt;
      
      if (typeof ai === `undefined` || !ai.languageModel) {
        throw Error(`local_ai: Chrome Built-in AI (Gemini Nano) is not enabled or supported on this browser version. Make sure chrome://flags/#prompt-api-for-gemini-nano is enabled.`);
      }
      
      let options = {};
      if (systemPrompt) options.systemPrompt = systemPrompt;
      
      const session = await ai.languageModel.create(options);
      const result = await session.prompt(prompt);
      session.destroy();
      
      return { success: true, response: result };
    }
  }

  class LocalSummarizeTool {
    name = `local_summarize`;
    async execute(e) {
      let text = e.text;
      let selector = e.selector;
      if (!text && !selector) throw Error(`local_summarize: text or selector is required`);
      
      await i((await s()).id);
      
      if (selector) {
        let expression = `document.querySelector(${JSON.stringify(selector)})?.innerText || ''`;
        let params = { expression, returnByValue: true };
        let ctxId = getContextId();
        if (ctxId !== undefined) params.contextId = ctxId;
        let res = await a(`Runtime.evaluate`, params);
        text = res.result?.value || ``;
      }
      
      if (!text) throw Error(`local_summarize: no text found to summarize`);
      
      if (typeof ai === `undefined` || !ai.summarizer) {
        throw Error(`local_summarize: Chrome Built-in AI Summarizer API is not enabled or supported. Enable chrome://flags/#optimization-guide-on-device-model.`);
      }
      
      const summarizer = await ai.summarizer.create({
        type: e.type || `key-points`,
        format: e.format || `markdown`,
        length: e.length || `medium`
      });
      
      const result = await summarizer.summarize(text);
      summarizer.destroy();
      
      return { success: true, summary: result };
    }
  }

  class AutoOrganizeTabsTool {
    name = `auto_organize_tabs`;
    async execute(e) {
      let mode = e.mode || `domain`;
      let tabs = await chrome.tabs.query({ currentWindow: true });
      
      let groups = new Map();
      for (let tab of tabs) {
        if (tab.pinned) continue;
        let key = ``;
        if (mode === `domain`) {
          try {
            key = new URL(tab.url).hostname.replace(`www.`, ``);
          } catch {
            key = `other`;
          }
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(tab.id);
      }
      
      let createdGroups = 0;
      for (let [title, tabIds] of groups.entries()) {
        if (tabIds.length < 2) continue;
        
        let groupId = await chrome.tabs.group({ tabIds });
        let color = d[createdGroups % d.length];
        await chrome.tabGroups.update(groupId, { title, color, collapsed: true });
        createdGroups++;
      }
      
      return { success: true, groupsCreated: createdGroups };
    }
  }

  class YoutubeTranscriptTool {
    name = `youtube_transcript`;
    async execute(e) {
      await i((await s()).id);
      let expression = `(async () => {
        let btn = document.querySelector('button[aria-label="Show transcript"]') || 
                  document.querySelector('#primary-button ytd-button-renderer a') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Show transcript'));
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
        let lines = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
        if (lines.length === 0) {
          lines = Array.from(document.querySelectorAll('.ytd-transcript-segment-renderer'));
        }
        return lines.map(line => {
          let time = line.querySelector('.segment-timestamp')?.textContent?.trim() || '';
          let text = line.querySelector('.segment-text')?.textContent?.trim() || '';
          return '[' + time + '] ' + text;
        }).join('\\n');
      })()`;
      
      let params = { expression, returnByValue: true, awaitPromise: true };
      let ctxId = getContextId();
      if (ctxId !== undefined) params.contextId = ctxId;
      
      let res = await a(`Runtime.evaluate`, params);
      if (res.exceptionDetails) throw Error(`youtube_transcript: ${res.exceptionDetails.text}`);
      return { transcript: res.result?.value || `Transcript not found or video has no transcript enabled` };
    }
  }

  class CrossTabExtractTool {
    name = `cross_tab_extract`;
    async execute(e) {
      let tabIds = e.tab_ids;
      if (!tabIds || !Array.isArray(tabIds)) throw Error(`cross_tab_extract: tab_ids array is required`);
      
      let results = [];
      for (let id of tabIds) {
        try {
          await i(id);
          let expression = `document.body ? (document.body.innerText || document.body.textContent) : ''`;
          let res = await a(`Runtime.evaluate`, { expression, returnByValue: true });
          results.push({ tabId: id, success: true, text: res.result?.value || `` });
        } catch (err) {
          results.push({ tabId: id, success: false, error: err.message });
        }
      }
      return { results };
    }
  }

  class SwarmBroadcastTool {
    name = `swarm_broadcast`;
    async execute(e) {
      let topic = e.topic || `default`;
      let message = e.message;
      if (!message) throw Error(`swarm_broadcast: message is required`);
      
      let key = `swarm:${topic}`;
      let data = await chrome.storage.local.get([key]);
      let list = data[key] || [];
      list.push({
        timestamp: Date.now(),
        sender: o() || `conductor`,
        message: message
      });
      if (list.length > 100) list.shift();
      await chrome.storage.local.set({ [key]: list });
      return { success: true, topic, messageCount: list.length };
    }
  }

  class SwarmReadTool {
    name = `swarm_read`;
    async execute(e) {
      let topic = e.topic || `default`;
      let since = e.since || 0;
      let clear = e.clear || false;
      
      let key = `swarm:${topic}`;
      if (clear) {
        await chrome.storage.local.remove([key]);
        return { success: true, messages: [] };
      }
      
      let data = await chrome.storage.local.get([key]);
      let list = data[key] || [];
      let filtered = list.filter(m => m.timestamp > since);
      return { success: true, messages: filtered };
    }
  }

  class SaveAsPdfTool {
    name = `save_as_pdf`;
    async execute(e) {
      await i((await s()).id);
      let res = await a(`Page.printToPDF`, e.options || { printBackground: true });
      return { success: true, pdfData: res.data };
    }
  }
  
  // ==================== NEW TOOLS END ====================
  
  var W=new Map;
  function G(e){W.set(e.name,e)}
  
  function ge(){
    ee();
    G(new _);
    G(new v);
    G(new ne);
    G(new C);
    G(new oe);
    G(new se);
    G(new ce);
    G(new le);
    G(new ue);
    G(new k);
    G(new z);
    G(new B);
    G(new H);
    G(new U);
    G(new de);
    G(new fe);
    G(new me);
    
    // Register New Tools
    G(new WaitForTool);
    G(new ExtractTextTool);
    G(new HandleDialogTool);
    G(new ScrollTool);
    G(new IframeSwitchTool);
    G(new HoverTool);
    G(new SelectOptionTool);
    G(new WaitForNetworkIdleTool);
    G(new ExtractTableTool);
    G(new ConsoleLogTool);
    G(new DragDropTool);
    G(new DoubleClickTool);
    G(new RightClickTool);
    G(new FocusTool);
    G(new ExtractLinksTool);
    G(new ExtractFormsTool);
    G(new ExtractMetaTool);
    G(new QuerySelectorAllTool);
    G(new AssertTool);
    G(new BatchTool);
    G(new GetCookiesTool);
    G(new SetCookieTool);
    G(new LocalStorageTool);
    G(new EmulateDeviceTool);
    G(new SetGeolocationTool);
    G(new InjectCssTool);
    G(new PageHashTool);
    G(new PerformanceMetricsTool);
    G(new GetAttributeTool);
    G(new SetAttributeTool);
    G(new ClearFieldTool);
    G(new CheckCheckboxTool);
    G(new GetPageSourceTool);
    G(new BlockUrlsTool);
    G(new SetUserAgentTool);
    G(new LocalAiTool);
    G(new LocalSummarizeTool);
    G(new AutoOrganizeTabsTool);
    G(new YoutubeTranscriptTool);
    G(new CrossTabExtractTool);
    G(new SwarmBroadcastTool);
    G(new SwarmReadTool);
    G(new SaveAsPdfTool);
  }
  
  async function _e(e,t){
    let n=W.get(e);
    if(!n)throw Error(`Unknown tool: ${e}. Available: ${[...W.keys()].join(`, `)}`);
    let r=t._tabId;
    return r!=null&&e!==`close_tab`&&e!==`list_tabs`&&e!==`close_session`&&(await i(r),l(r),delete t._tabId),n.execute(t)
  }
  
  var ve=`ws://127.0.0.1:10087/ws`,
  K=`agent-extension-reconnect`,
  ye=5e3,
  q={SHOULD_RECONNECT:`ws_should_reconnect`,WS_URL:`ws_url`},
  J=new class{
    socket=null;
    state=`disconnected`;
    currentUrl=``;
    shouldReconnect=!1;
    reconnectTimer=null;
    isDisconnecting=!1;
    reconnectAttempts=0;
    isConnected(){return this.state===`connected`}
    getServerUrl(){return this.currentUrl}
    async connect(e){
      if(e&&e!==this.currentUrl){
        this.reconnectAttempts=0;
        if((this.state===`connecting`||this.state===`connected`)&&await this.disconnect());
      }
      if(this.state===`connecting`||this.state===`connected`)return;
      this.isDisconnecting=!1,this.shouldReconnect=!0,this.state=`connecting`;
      let t=e||this.currentUrl;
      try {
        let urlObj = new URL(t);
        let secret = urlObj.searchParams.get('secret');
        if (secret) {
          await setCryptoSecret(secret);
          urlObj.searchParams.delete('secret');
          t = urlObj.toString();
        } else {
          let localStore = await chrome.storage.local.get(['e2ee_secret']);
          if (localStore.e2ee_secret) {
            await setCryptoSecret(localStore.e2ee_secret);
          } else {
            cryptoSecretKey = null;
          }
        }
      } catch {
        cryptoSecretKey = null;
      }
      this.currentUrl=t,await chrome.storage.session.set({[q.SHOULD_RECONNECT]:!0,[q.WS_URL]:t}),t&&await chrome.storage.local.set({local_url:t});
      try{
        let nativePort = chrome.runtime.connectNative('com.gangniaga.webbridge');
        let e = {
          readyState: 1,
          send: (data) => nativePort.postMessage(JSON.parse(data)),
          close: () => nativePort.disconnect(),
          listeners: {},
          addEventListener: function(evt, handler) {
            if(!this.listeners[evt]) this.listeners[evt]=[];
            this.listeners[evt].push(handler);
          },
          emit: function(evt, data) {
            if(this.listeners[evt]) this.listeners[evt].forEach(h=>h(data));
          }
        };
        nativePort.onMessage.addListener(msg => e.emit('message', {data: JSON.stringify(msg)}));
        nativePort.onDisconnect.addListener(() => e.emit('close'));
        this.socket = e;
        
        setTimeout(() => e.emit('open'), 100);

        e.addEventListener(`open`,()=>{
          if(this.isDisconnecting){e.close();return}
          this.state=`connected`,this.reconnectAttempts=0,this.clearReconnectTimer(),console.log(`[ws] connected natively`),
          this.send({type:`hello`,payload:{extensionVersion:chrome.runtime.getManifest().version}})
        }),
        e.addEventListener(`message`,async ev=>{
          try{
            let t=JSON.parse(ev.data);
            await this.handleMessage(t);
          }catch(err){console.error(`[ws] invalid message:`,err)}
        }),
        e.addEventListener(`close`,()=>{this.socket===e&&(this.state=`disconnected`,this.socket=null,console.log(`[ws] disconnected`),!this.isDisconnecting&&this.shouldReconnect&&this.scheduleReconnect())}),
        e.addEventListener(`error`,err=>{console.error(`[ws] error:`,err)})
      }catch(e){this.state=`disconnected`,console.error(`[ws] connect failed:`,e),this.shouldReconnect&&this.scheduleReconnect()}
    }
    async testConnection(e){
      return new Promise(t=>{
        let n;
        try{n=new WebSocket(e)}catch(e){t({ok:!1,reason:e?.message||`invalid url`});return}
        let r=setTimeout(()=>{try{n.close()}catch{}t({ok:!1,reason:`timeout`})},5e3),i=!1;
        n.addEventListener(`open`,()=>{if(!i){i=!0,clearTimeout(r);try{n.close()}catch{}t({ok:!0})}}),
        n.addEventListener(`error`,()=>{if(!i){i=!0,clearTimeout(r);try{n.close()}catch{}t({ok:!1,reason:`connect failed`})}})
      })
    }
    async disconnect(){this.isDisconnecting=!0,this.shouldReconnect=!1,this.clearReconnectTimer(),await chrome.storage.session.set({[q.SHOULD_RECONNECT]:!1}),await chrome.alarms.clear(K),this.socket&&=(this.socket.close(),null),this.state=`disconnected`}
    async reconnectIfNeeded(){
      if(this.state===`connected`||this.state===`connecting`)return;
      let e=await chrome.storage.session.get([q.SHOULD_RECONNECT,q.WS_URL]);
      if(e[q.SHOULD_RECONNECT]&&e[q.WS_URL]){this.shouldReconnect=!0,await this.connect(e[q.WS_URL]);return}
      let t=await chrome.storage.local.get([`local_url`]);
      if(t.local_url){this.shouldReconnect=!0,await this.connect(t.local_url);return}
      this.shouldReconnect=!0,await this.connect(ve)
    }
    async scheduleReconnect(){
      let delay=Math.min(1000*Math.pow(2,this.reconnectAttempts++),30000);
      this.reconnectTimer=setTimeout(()=>{this.connect(this.currentUrl)},delay),await chrome.alarms.create(K,{delayInMinutes:1})
    }
    clearReconnectTimer(){this.reconnectTimer&&=(clearTimeout(this.reconnectTimer),null),chrome.alarms.clear(K)}
    async handleMessage(e){
      try {
        e = await decryptPayload(e);
      } catch (err) {
        this.sendRaw({ type: `error`, payload: { error: err.message } });
        return;
      }
      switch(e.type){
        case`ping`:await this.send({type:`pong`});break;
        case`hello_ack`:break;
        case`tool_call`:this.handleToolCall(e);break;
        default:console.log(`[ws] unhandled message type:`,e.type)
      }
    }
    async handleToolCall(e){
      let t=e.payload;
      if(!t?.name){await this.send({type:`tool_result`,responseToRequestId:e.requestId,payload:{error:`missing tool name`}});return}
      try{let n=await _e(t.name,t.args||{});await this.send({type:`tool_result`,responseToRequestId:e.requestId,payload:{data:n}})}
      catch(t){await this.send({type:`tool_result`,responseToRequestId:e.requestId,payload:{error:t.message}})}
    }
    async send(e){
      let payload = await encryptPayload(e);
      this.sendRaw(payload);
    }
    sendRaw(e){this.socket?.readyState===1&&this.socket.send(JSON.stringify(e))}
  },
  be=`agent-extension-reconnect`,
  Y=e(()=>{
    ge(),
    J.reconnectIfNeeded(),
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    chrome.omnibox.onInputEntered.addListener(async (text) => {
      if (J.isConnected()) {
        J.send({
          type: `user_query`,
          payload: { query: text, timestamp: Date.now() }
        });
      }
    });
    chrome.alarms.onAlarm.addListener(e=>{e.name===be&&J.reconnectIfNeeded()}),
    chrome.runtime.onMessage.addListener((e,t,n)=>((async()=>{
      try{
        switch(e.type){
          case`GET_STATUS`:n({connected:J.isConnected(),serverUrl:J.getServerUrl()});break;
          case`CONNECT`:await J.connect(e.url),n({success:!0});break;
          case`DISCONNECT`:await J.disconnect(),n({success:!0});break;
          case`TEST_CONNECTION`:n(await J.testConnection(e.url));break;
          case`GENERATE_CONNECTION`:{
            let t=await fetch(`${e.serverBase}/api/connections`,{method:`POST`});
            if(!t.ok)throw Error(`Server error: ${t.status}`);
            n(await t.json());
            break
          }
          default:n({error:`unknown type: ${e.type}`})
        }
      }catch(e){n({error:e.message})}
    })(),!0))
  });
  
  globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;
  
  var X=class{
    constructor(e){
      if(e===`<all_urls>`)this.isAllUrls=!0,this.protocolMatches=[...X.PROTOCOLS],this.hostnameMatch=`*`,this.pathnameMatch=`*`;
      else{
        let t=/(.*):\/\/(.*?)(\/.*)/.exec(e);
        if(t==null)throw new Q(e,`Incorrect format`);
        let[n,r,i,a]=t;
        xe(e,r),Se(e,i),this.protocolMatches=r===`*`?[`http`,`https`]:[r],this.hostnameMatch=i,this.pathnameMatch=a
      }
    }
    includes(e){
      if(this.isAllUrls)return!0;
      let t=typeof e==`string`?new URL(e):e instanceof Location?new URL(e.href):e;
      return!!this.protocolMatches.find(e=>{
        if(e===`http`)return this.isHttpMatch(t);
        if(e===`https`)return this.isHttpsMatch(t);
        if(e===`file`)return this.isFileMatch(t);
        if(e===`ftp`)return this.isFtpMatch(t);
        if(e===`urn`)return this.isUrnMatch(t)
      })
    }
    isHttpMatch(e){return e.protocol===`http:`&&this.isHostPathMatch(e)}
    isHttpsMatch(e){return e.protocol===`https:`&&this.isHostPathMatch(e)}
    isHostPathMatch(e){
      if(!this.hostnameMatch||!this.pathnameMatch)return!1;
      let t=[this.convertPatternToRegex(this.hostnameMatch),this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./,``))],n=this.convertPatternToRegex(this.pathnameMatch);
      return!!t.find(t=>t.test(e.hostname))&&n.test(e.pathname)
    }
    isFileMatch(e){throw Error(`Not implemented: file:// pattern matching. Open a PR to add support`)}
    isFtpMatch(e){throw Error(`Not implemented: ftp:// pattern matching. Open a PR to add support`)}
    isUrnMatch(e){throw Error(`Not implemented: urn:// pattern matching. Open a PR to add support`)}
    convertPatternToRegex(e){let t=this.escapeForRegex(e).replace(/\\\*/g,`.*`);return RegExp(`^${t}$`)}
    escapeForRegex(e){return e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`)}
  },
  Z=X;
  Z.PROTOCOLS=[`http`,`https`,`file`,`ftp`,`urn`];
  
  var Q=class extends Error{constructor(e,t){super(`Invalid match pattern "${e}": ${t}`)}};
  
  function xe(e,t){if(!Z.PROTOCOLS.includes(t)&&t!==`*`)throw new Q(e,`${t} not a valid protocol (${Z.PROTOCOLS.join(`, `)})`)}
  function Se(e,t){
    if(t.includes(`:`))throw new Q(e,`Hostname cannot include a port`);
    if(t.includes(`*`)&&t.length>1&&!t.startsWith(`*.`))throw new Q(e,`If using a wildcard (*), it must go at the start of the hostname`)
  }
  
  var Ce={
    debug:(...e)=>([...e],void 0),
    log:(...e)=>([...e],void 0),
    warn:(...e)=>([...e],void 0),
    error:(...e)=>([...e],void 0)
  },
  $;
  
  try{
    $=Y.main(),
    $ instanceof Promise&&console.warn(`The background's main() function return a promise, but it must be synchronous`)
  }catch(e){
    throw Ce.error(`The background crashed on startup!`),e
  }
  return $
})();