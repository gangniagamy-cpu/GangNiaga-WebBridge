const fs = require('fs');
const path = require('path');
const os = require('os');

console.log("=========================================");
console.log("🤖 GANGNIAGA MCP SERVER AUTO-INSTALLER");
console.log("=========================================\n");

// Get absolute path of index.js
const mcpServerPath = path.join(__dirname, 'index.js').replace(/\\/g, '\\\\');

// Target configs (Support for Claude Desktop & Custom Hermes Configs)
const targetConfigs = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  path.join(os.homedir(), '.hermes', 'mcp_config.json'),
  path.join(path.join(__dirname, '..', 'test_mcp_config.json')) // Fallback just to show it works
];

let installedCount = 0;

for (const configPath of targetConfigs) {
  try {
    // If config file doesn't exist but the directory does, create an empty one (except for Claude)
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      if (configPath.includes('.hermes')) fs.mkdirSync(dir, { recursive: true });
      else continue;
    }

    let config = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      config = content.trim() ? JSON.parse(content) : config;
    }

    if (!config.mcpServers) config.mcpServers = {};

    // Inject GangNiaga MCP Server
    config.mcpServers["gangniaga-webbridge"] = {
      command: "node",
      args: [path.join(__dirname, 'index.js')]
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Berjaya pasang di: ${configPath}`);
    installedCount++;
  } catch (err) {
    console.log(`❌ Ralat memasang di ${configPath}:`, err.message);
  }
}

if (installedCount > 0) {
  console.log("\n🎉 Pemasangan Selesai! Sila restart AI Agent / Claude Desktop anda.");
} else {
  console.log("\n⚠️ Tiada konfigurasi AI dijumpai. Anda mungkin perlu masukkan JSON secara manual.");
}

