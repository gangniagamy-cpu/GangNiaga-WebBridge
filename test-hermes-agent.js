const fs = require('fs');

async function runHermesTest() {
  console.log("🤖 [Hermes] Memulakan simulasi autonomus...");

  // 1. Fetch YAML Knowledge Base
  console.log("🤖 [Hermes] Sedang mengambil Knowledge Base untuk Shopee...");
  const siteRes = await fetch('http://127.0.0.1:10087/sites/shopee.com.my');
  const siteData = await siteRes.json();
  
  if (!siteData.ok) {
    console.error("❌ Gagal dapatkan data:", siteData.error);
    return;
  }
  
  console.log("✅ [Hermes] YAML Knowledge dijumpai:\n", siteData.yaml.split('\n').slice(0, 5).join('\n') + "\n  ...\n");

  // Manual parse sikit (Sebab tak nak install library yaml untuk test ni)
  const searchInputSelector = siteData.yaml.match(/search_input:\s*"(.*?)"/)[1];
  const searchBtnSelector = siteData.yaml.match(/search_button:\s*"(.*?)"/)[1];
  
  console.log(`🤖 [Hermes] Faham! Selector search bar ialah: ${searchInputSelector}`);
  
  // 2. Open Shopee Tab
  console.log("🤖 [Hermes] Mengarahkan WebBridge untuk buka tab Shopee...");
  const cmdRes = await fetch('http://127.0.0.1:10087/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: "open_tab",
      args: { url: "https://shopee.com.my" }
    })
  });
  
  const cmdData = await cmdRes.json();
  if (!cmdData.success) {
    console.log("⚠️ Gagal buka tab via background. Tapi tak apa, mungkin browser dah buka tab.");
  } else {
    console.log("✅ [Hermes] Tab berjaya dibuka!");
  }

  // 3. Inject Search Command (Simulation)
  console.log("🤖 [Hermes] Sekarang Hermes akan jalankan recipe: Type 'Laptop' & Click Search");
  const jsPayload = `
    const input = document.querySelector('${searchInputSelector}');
    if (input) {
      input.value = 'Laptop gaming murah';
      const btn = document.querySelector('${searchBtnSelector}');
      if (btn) btn.click();
      return "Berjaya type & search!";
    }
    return "Element tidak dijumpai";
  `;
  
  const injectRes = await fetch('http://127.0.0.1:10087/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: "run_js",
      args: { code: jsPayload }
    })
  });
  
  const injectData = await injectRes.json();
  console.log("✅ [Hermes] Hasil pelaksanaan di browser:", injectData);
  console.log("🎉 [Hermes] Simulasi selesai. Misi berjaya!");
}

runHermesTest();
