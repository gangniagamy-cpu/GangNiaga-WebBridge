// GangNiaga WebBridge - Input Validation & Sanitization Utility
// Ensures incoming commands are safe and does basic protection against malicious injections.

const validator = {
  // Validate URL to ensure it is standard web protocol
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return ['http:', 'https:', 'about:'].includes(url.protocol);
    } catch {
      return false;
    }
  },
  
  // Validate domain format to prevent path traversal and shell injection
  isValidDomain(domain) {
    if (typeof domain !== 'string') return false;
    return /^[a-zA-Z0-9.-]+$/.test(domain) && 
           domain.length > 0 && 
           domain.length <= 253 && 
           !domain.includes('..');
  },
  
  // Validate CSS selector to prevent script injection in selectors
  isValidSelector(selector) {
    if (typeof selector !== 'string') return false;
    if (selector.length > 500) return false;
    
    // Block dangerous patterns
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'expression('];
    return !dangerous.some(d => selector.toLowerCase().includes(d));
  },
  
  // Validate JavaScript code (eval protection checks)
  isValidCode(code) {
    if (typeof code !== 'string') return false;
    if (code.length > 50000) return false; // 50KB limit
    
    // Block obviously dangerous patterns to prevent direct credentials/cookie stealing
    const dangerous = [
      'window.opener',
      'importScripts'
    ];
    
    return !dangerous.some(d => code.includes(d));
  },
  
  // Validate tab ID format
  isValidTabId(tabId) {
    return Number.isInteger(tabId) && tabId > 0;
  },
  
  // Validate screen coordinates for clicks
  isValidCoordinate(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && 
           x >= 0 && y >= 0 && x < 10000 && y < 10000;
  }
};

module.exports = validator;
