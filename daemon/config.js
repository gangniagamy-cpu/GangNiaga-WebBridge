const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUTH_FILE_PATH = path.join(__dirname, '.webbridge-auth.json');
const SECRET_KEY = process.env.GANGNIAGA_SECRET || null;
const PORT = 10087;
const COMMAND_TIMEOUT_MS = Number.parseInt(process.env.GANGNIAGA_TIMEOUT_MS, 10) || 30000;

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function getApiKey() {
  let apiKey = process.env.GANGNIAGA_API_KEY || null;
  if (!apiKey && fs.existsSync(AUTH_FILE_PATH)) {
    try {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE_PATH, 'utf8'));
      apiKey = authData.apiKey;
    } catch (error) {
      console.warn('[config] failed to read auth file:', error.message);
    }
  }

  if (!apiKey) {
    apiKey = generateApiKey();
    try {
      fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify({ apiKey }, null, 2), 'utf8');
    } catch (error) {
      console.error('[config] failed to persist auth key:', error.message);
    }
  }
  return apiKey;
}

module.exports = {
  PORT,
  COMMAND_TIMEOUT_MS,
  AUTH_FILE_PATH,
  SECRET_KEY,
  getApiKey,
};
