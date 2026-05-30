// GangNiaga WebBridge - Content Script
// Injected into all pages for DOM interaction with Shadow DOM traversal support

(function() {
  'use strict';

  // Helper to query elements recursively inside Open Shadow DOMs
  function queryAllElementsDeep(selector, root = document) {
    const elements = [];
    
    function traverse(node) {
      if (!node) return;
      
      if (node.querySelectorAll) {
        try {
          const matches = node.querySelectorAll(selector);
          matches.forEach(m => {
            if (!elements.includes(m)) elements.push(m);
          });
        } catch (e) {
          // Ignore invalid selector syntax errors during traversal
        }
      }
      
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      
      let child = node.firstElementChild;
      while (child) {
        traverse(child);
        child = child.nextElementSibling;
      }
    }
    
    traverse(root);
    return elements;
  }

  function queryElementDeep(selector, root = document) {
    const results = queryAllElementsDeep(selector, root);
    return results.length > 0 ? results[0] : null;
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[GangNiaga] Content script received:', request.action);
    
    switch (request.action) {
      case 'getDOMInfo':
        sendResponse({
          url: window.location.href,
          title: document.title,
          forms: Array.from(queryAllElementsDeep('form')).map(f => ({id: f.id, action: f.action})),
          inputs: Array.from(queryAllElementsDeep('input, textarea')).slice(0,20).map(i => ({type: i.type, id: i.id, placeholder: i.placeholder})),
          images: Array.from(queryAllElementsDeep('img')).slice(0,10).map(i => ({src: i.src, alt: i.alt})),
          links: Array.from(queryAllElementsDeep('a[href]')).slice(0,10).map(a => ({href: a.href, text: a.textContent.trim().slice(0,50)}))
        });
        break;
        
      case 'extractImages':
        const imgs = Array.from(queryAllElementsDeep('img'))
          .filter(i => i.src && !i.src.startsWith('data:'))
          .map(i => ({src: i.src, alt: i.alt || '', width: i.naturalWidth, height: i.naturalHeight}));
        sendResponse({images: imgs, count: imgs.length});
        break;
        
      case 'extractText':
        const text = document.body ? document.body.innerText : '';
        sendResponse({text: text.slice(0, 5000), length: text.length});
        break;
        
      case 'clickElement':
        const el = queryElementDeep(request.selector);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          sendResponse({success: true, tag: el.tagName, text: el.textContent.trim().slice(0,50)});
        } else {
          sendResponse({success: false, error: 'Element not found: ' + request.selector});
        }
        break;
        
      case 'fillInput':
        const inp = queryElementDeep(request.selector);
        if (inp) {
          inp.focus();
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(inp, request.value);
          } else {
            inp.value = request.value;
          }
          inp.dispatchEvent(new Event('input', {bubbles: true}));
          inp.dispatchEvent(new Event('change', {bubbles: true}));
          sendResponse({success: true});
        } else {
          sendResponse({success: false, error: 'Input not found: ' + request.selector});
        }
        break;
        
      case 'scrollTo':
        window.scrollTo(request.x || 0, request.y || 0);
        sendResponse({success: true, scrolledTo: {x: request.x, y: request.y}});
        break;
        
      case 'getPageStructure':
        const structure = {
          url: window.location.href,
          title: document.title,
          headings: Array.from(queryAllElementsDeep('h1,h2,h3')).map(h => ({level: h.tagName, text: h.textContent.trim()})),
          sections: Array.from(queryAllElementsDeep('section, article, [role="main"]')).map(s => ({tag: s.tagName, id: s.id, className: s.className})),
          navLinks: Array.from(queryAllElementsDeep('nav a, [role="navigation"] a')).slice(0,10).map(a => ({href: a.href, text: a.textContent.trim()}))
        };
        sendResponse(structure);
        break;
        
      default:
        sendResponse({error: 'Unknown action: ' + request.action});
    }
    
    return true; // Keep message channel open for async response
  });

  console.log('[GangNiaga] Content script loaded on', window.location.href);
})();