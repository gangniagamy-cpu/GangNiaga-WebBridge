// GangNiaga WebBridge - Input Validation & Sanitization Utility
// Ensures incoming commands are safe and protects against common injection patterns.

const validator = {
  // Validate URL to ensure it is standard web protocol and not a URL injection vector.
  isValidUrl(string) {
    if (typeof string !== 'string' || string.length > 1000) return false;
    try {
      const url = new URL(string);
      if (!['http:', 'https:'].includes(url.protocol)) return false;
      if (url.username || url.password) return false;
      if (!url.hostname || url.hostname.trim() === '') return false;
      if (url.hostname.includes(' ')) return false;
      return true;
    } catch {
      return false;
    }
  },

  // Validate domain format to prevent path traversal and shell injection.
  isValidDomain(domain) {
    if (typeof domain !== 'string') return false;
    return (
      /^[a-zA-Z0-9.-]+$/.test(domain) &&
      domain.length > 0 &&
      domain.length <= 253 &&
      !domain.includes('..')
    );
  },

  // Validate CSS selector to prevent script injection in selectors.
  isValidSelector(selector) {
    if (typeof selector !== 'string') return false;
    if (selector.length > 500) return false;

    const dangerous = [
      'javascript:',
      'data:',
      'vbscript:',
      'expression(',
      'document.',
      'window.',
      'eval(',
      'new Function',
      'Function(',
      'innerHTML',
      'outerHTML',
      'contentWindow',
      '<',
      '>',
    ];

    const normalized = selector.toLowerCase();
    return !dangerous.some((d) => normalized.includes(d));
  },

  // Validate JavaScript code (eval protection checks).
  isValidCode(code) {
    if (typeof code !== 'string') return false;
    if (code.length > 50000) return false; // 50KB limit

    const dangerous = [
      'window.opener',
      'importscripts',
      'document.cookie',
      'localstorage',
      'sessionstorage',
      'eval(',
      'new function',
      'function(',
      'document.write',
      'document.writeln',
      'window.location',
      'window.open',
      'xmlhttprequest',
      'fetch(',
      'postmessage',
    ];

    const normalized = code.replace(/\s+/g, ' ').toLowerCase();
    return !dangerous.some((d) => normalized.includes(d));
  },

  // Validate tab ID format.
  isValidTabId(tabId) {
    return Number.isInteger(tabId) && tabId > 0;
  },

  // Validate screen coordinates for clicks.
  isValidCoordinate(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < 10000 && y < 10000;
  },
};

module.exports = validator;
