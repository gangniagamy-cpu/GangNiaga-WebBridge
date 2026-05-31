// GangNiaga WebBridge - Cognitive Decoy & Fingerprint Shield Script
// Injected into the MAIN world at document_start before any page scripts load.

(function () {
  'use strict';

  console.log('[GangNiaga Shield] Injecting anti-bot cognitive armor...');

  try {
    // 1. Evade navigator.webdriver detection
    if (navigator.webdriver !== undefined) {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });
    }

    // 2. Spoof window.chrome to look like authentic desktop Chrome
    const mockChrome = {
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed',
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running',
        },
      },
      runtime: {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update',
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic',
        },
        PlatformArch: {
          ARM: 'arm',
          ARM64: 'arm64',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        PlatformNaclArch: {
          ARM: 'arm',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win',
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available',
        },
      },
    };

    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        value: mockChrome,
        writable: true,
        configurable: true,
      });
    }

    // 3. Spoof Plugins & Languages (bots usually have empty plugins array)
    if (navigator.plugins.length === 0) {
      const mockPlugins = [
        {
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          name: 'PDF Viewer',
        },
        {
          description: 'Default PDF Viewer',
          filename: 'internal-pdf-viewer',
          name: 'Chrome PDF Viewer',
        },
        { description: 'Native Client', filename: 'internal-nacl-plugin', name: 'Native Client' },
      ];

      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true,
      });
    }

    // 4. Secure Languages Array
    if (!navigator.languages || navigator.languages.length === 0) {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true,
      });
    }

    // 5. Canvas Hash Deflection (Anti-Fingerprinting)
    // Injects a minuscule noise fluctuation (+/- 1 on a single pixel) to prevent deterministic canvas tracking
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
      const imgData = originalGetImageData.apply(this, arguments);
      if (imgData.data && imgData.data.length > 4) {
        // Shift a single pixel color slightly to randomize canvas hashes without distorting the visual layout
        imgData.data[0] = (imgData.data[0] + (Math.random() > 0.5 ? 1 : -1) + 256) % 256;
      }
      return imgData;
    };

    // 6. WebGL Vendor & Renderer Cloaking
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
      if (parameter === 0x9245) {
        return 'Google Inc. (NVIDIA)';
      }
      if (parameter === 0x9246) {
        return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)';
      }
      return originalGetParameter.apply(this, arguments);
    };

    console.log('[GangNiaga Shield] Shield loaded successfully.');
  } catch (err) {
    console.error('[GangNiaga Shield] Initialization failed:', err);
  }
})();
