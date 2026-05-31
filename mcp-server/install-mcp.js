import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=========================================");
console.log("🤖 GANGNIAGA MCP SERVER AUTO-INSTALLER");
console.log("=========================================\n");

const targetConfigs = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  path.join(os.homedir(), '.hermes', 'mcp_config.json'),
  path.join(__dirname, '..', 'test_mcp_config.json')
];

const yamlConfigPath = path.join(os.homedir(), '.hermes', 'config.yaml');

let installedCount = 0;

// 1. Install to JSON configs
for (const configPath of targetConfigs) {
  try {
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
      args: [path.join(__dirname, 'index.js').replace(/\\/g, '/')]
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Berjaya pasang JSON di: ${configPath}`);
    installedCount++;
  } catch (err) {
    console.log(`❌ Ralat memasang JSON di ${configPath}:`, err.message);
  }
}

// 2. Install to YAML config (Official Hermes Agent config.yaml)
try {
  const dir = path.dirname(yamlConfigPath);
  if (fs.existsSync(dir)) {
    let content = '';
    if (fs.existsSync(yamlConfigPath)) {
      content = fs.readFileSync(yamlConfigPath, 'utf8');
    }

    const scriptPath = path.join(__dirname, 'index.js').replace(/\\/g, '/');
    const entry = `  gangniaga-webbridge:
    command: "node"
    args:
      - "${scriptPath}"`;

    if (!content.includes('mcp_servers:')) {
      content += `\n\nmcp_servers:\n${entry}\n`;
      fs.writeFileSync(yamlConfigPath, content, 'utf8');
      console.log(`✅ Berjaya pasang YAML di: ${yamlConfigPath}`);
      installedCount++;
    } else {
      // Find mcp_servers block
      const lines = content.split('\n');
      let mcpServersIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('mcp_servers:')) {
          mcpServersIndex = i;
          break;
        }
      }

      if (mcpServersIndex !== -1) {
        if (!content.includes('gangniaga-webbridge:')) {
          lines.splice(mcpServersIndex + 1, 0, entry);
          fs.writeFileSync(yamlConfigPath, lines.join('\n'), 'utf8');
          console.log(`✅ Berjaya pasang YAML di: ${yamlConfigPath}`);
          installedCount++;
        } else {
          console.log(`ℹ️ gangniaga-webbridge sudah wujud di: ${yamlConfigPath}`);
        }
      }
    }
  }
} catch (err) {
  console.log(`❌ Ralat memasang YAML di ${yamlConfigPath}:`, err.message);
}

if (installedCount > 0) {
  console.log("\n🎉 Pemasangan Selesai! Sila restart AI Agent / Claude Desktop anda.");
} else {
  console.log("\n⚠️ Tiada konfigurasi AI dijumpai. Anda mungkin perlu masukkan JSON/YAML secara manual.");
}
