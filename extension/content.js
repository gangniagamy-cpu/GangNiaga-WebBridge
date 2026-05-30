// GangNiaga WebBridge - Content Script
// Injected into all pages for DOM interaction

(function() {
  'use strict';

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[GangNiaga] Content script received:', request.action);
    
    switch (request.action) {
      case 'getDOMInfo':
        sendResponse({
          url: window.location.href,
          title: document.title,
          forms: Array.from(document.forms).map(f => ({id: f.id, action: f.action})),
          inputs: Array.from(document.querySelectorAll('input, textarea')).slice(0,20).map(i => ({type: i.type, id: i.id, placeholder: i.placeholder})),
          images: Array.from(document.querySelectorAll('img')).slice(0,10).map(i => ({src: i.src, alt: i.alt})),
          links: Array.from(document.querySelectorAll('a[href]')).slice(0,10).map(a => ({href: a.href, text: a.textContent.trim().slice(0,50)}))
        });
        break;
        
      case 'extractImages':
        const imgs = Array.from(document.querySelectorAll('img'))
          .filter(i => i.src && !i.src.startsWith('data:'))
          .map(i => ({src: i.src, alt: i.alt || '', width: i.naturalWidth, height: i.naturalHeight}));
        sendResponse({images: imgs, count: imgs.length});
        break;
        
      case 'extractText':
        const text = document.body ? document.body.innerText : '';
        sendResponse({text: text.slice(0, 5000), length: text.length});
        break;
        
      case 'clickElement':
        const el = document.querySelector(request.selector);
        if (el) {
          el.click();
          sendResponse({success: true, tag: el.tagName, text: el.textContent.trim().slice(0,50)});
        } else {
          sendResponse({success: false, error: 'Element not found: ' + request.selector});
        }
        break;
        
      case 'fillInput':
        const inp = document.querySelector(request.selector);
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
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({level: h.tagName, text: h.textContent.trim()})),
          sections: Array.from(document.querySelectorAll('section, article, [role="main"]')).map(s => ({tag: s.tagName, id: s.id, className: s.className})),
          navLinks: Array.from(document.querySelectorAll('nav a, [role="navigation"] a')).slice(0,10).map(a => ({href: a.href, text: a.textContent.trim()}))
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