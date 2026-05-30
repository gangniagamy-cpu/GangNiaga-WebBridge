async function runHermesTest() {
  // Read API key from daemon auth file
  const fs = require('fs');
  const authFile = process.env.GANGNIAGA_API_KEY || (() => {
    try {
      const authPath = 'D:\\\\GangNiaga-WebBridge\\\\daemon\\\\.webbridge-auth.json';
      return JSON.parse(fs.readFileSync(authPath, 'utf8')).apiKey;
    } catch (e) { return null; }
  })();

  const HEADERS = {
    'Content-Type': 'application/json',
    ...(authFile ? { 'Authorization': `Bearer ${authFile}` } : {})
  };

  console.log("[Hermes] Memulakan simulasi autonomus...");

  // 1. Fetch YAML Knowledge Base
  console.log("[Hermes] Sedang mengambil Knowledge Base untuk Shopee...");
  const siteRes = await fetch('http://127.0.0.1:10087/sites/shopee.com.my', {
    headers: HEADERS
  });
  const siteData = await siteRes.json();

  if (!siteData.ok) {
    console.error("Gagal dapatkan data:", siteData.error);
    return;
  }

  console.log("[Hermes] YAML Knowledge dijumpai:\n", siteData.yaml.split('\n').slice(0, 5).join('\n') + "\n  ...\n");

  // Manual parse selectors
  const searchInputSelector = siteData.yaml.match(/search_input:\s*"(.*?)"/)[1];
  const searchBtnSelector = siteData.yaml.match(/search_button:\s*"(.*?)"/)[1];

  console.log(`[Hermes] Faham! Selector search bar ialah: ${searchInputSelector}`);

  // 2. Open Shopee Tab (use 'navigate' with newTab=true, correct action name)
  console.log("[Hermes] Mengarahkan WebBridge untuk buka tab Shopee...");
  const cmdRes = await fetch('http://127.0.0.1:10087/command', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      action: "navigate",
      args: { url: "https://shopee.com.my", newTab: true }
    })
  });

  const cmdData = await cmdRes.json();
  if (!cmdData.success) {
    console.log("Gagal buka tab via background (extension mungkin tak connect). Teruskan...");
  } else {
    console.log("[Hermes] Tab berjaya dibuka!");
  }

  // 3. Use os_screenshot (action name & arg path fixed)
  const ssRes = await fetch('http://127.0.0.1:10087/command', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      action: "os_screenshot",
      args: { path: "D:/hermes_test.png" }
    })
  });
  const ssData = await ssRes.json();
  console.log("[Hermes] Screenshot result:", ssData.success ? "OK" : ssData.error);

  // 4. Use evaluate (not run_js) with React-compatible value setter
  console.log("[Hermes] Sekarang Hermes akan jalankan recipe: Type 'Laptop' & Click Search");
  const jsPayload = `
    (function() {
      const input = document.querySelector('${searchInputSelector}');
      if (!input) return {error: 'Search input not found', url: window.location.href};
      input.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) { nativeSetter.call(input, 'Laptop gaming murah'); }
      else { input.value = 'Laptop gaming murah'; }
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      const btn = document.querySelector('${searchBtnSelector}');
      if (btn) btn.click();
      return {success: true, value: input.value};
    })()
  `;

  const evalRes = await fetch('http://127.0.0.1:10087/command', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      action: "evaluate",
      args: { code: jsPayload }
    })
  });

  const evalData = await evalRes.json();
  console.log("[Hermes] Hasil pelaksanaan di browser:", evalData);
  console.log("[Hermes] Simulasi selesai!");
}

runHermesTest().catch(e => console.error("Fatal:", e.message));
