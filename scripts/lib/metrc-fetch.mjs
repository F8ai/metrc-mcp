/**
 * Shared METRC API client for scripts.
 * Loads credentials from (1) .env in repo root, (2) MCP config .cursor/mcp.json (project or user).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

function loadEnvFile(envPath) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !match[1].startsWith('#')) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    });
  } catch (_) {}
}

function loadMcpConfigEnv(configPath) {
  try {
    if (!existsSync(configPath)) return;
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    const serverList = data?.mcpServers && typeof data.mcpServers === 'object'
      ? Object.values(data.mcpServers)
      : (data && typeof data === 'object' ? Object.values(data) : []);
    for (const s of serverList) {
      if (s && typeof s === 'object' && s.env && typeof s.env === 'object') {
        const { METRC_VENDOR_API_KEY, METRC_USER_API_KEY, METRC_LICENSE, METRC_API_URL } = s.env;
        if (METRC_VENDOR_API_KEY && METRC_USER_API_KEY) {
          if (!process.env.METRC_VENDOR_API_KEY) process.env.METRC_VENDOR_API_KEY = String(METRC_VENDOR_API_KEY);
          if (!process.env.METRC_USER_API_KEY) process.env.METRC_USER_API_KEY = String(METRC_USER_API_KEY);
          if (METRC_LICENSE && !process.env.METRC_LICENSE) process.env.METRC_LICENSE = String(METRC_LICENSE);
          if (METRC_API_URL && !process.env.METRC_API_URL) process.env.METRC_API_URL = String(METRC_API_URL);
          return;
        }
      }
    }
  } catch (_) {}
}

loadEnvFile(join(root, '.env'));
if (!process.env.METRC_VENDOR_API_KEY || !process.env.METRC_USER_API_KEY) {
  loadMcpConfigEnv(join(root, '.cursor', 'mcp.json'));
}
if (!process.env.METRC_VENDOR_API_KEY || !process.env.METRC_USER_API_KEY) {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) loadMcpConfigEnv(join(home, '.cursor', 'mcp.json'));
}

const BASE = process.env.METRC_API_URL || 'https://sandbox-api-co.metrc.com';
const VENDOR = process.env.METRC_VENDOR_API_KEY || '';
const USER = process.env.METRC_USER_API_KEY || '';

export function hasCredentials() {
  return !!(VENDOR && USER);
}

export async function metrcFetch(path, params = {}, options = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env (repo root) or in MCP config .cursor/mcp.json under env.'
    );
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const creds = Buffer.from(`${VENDOR}:${USER}`).toString('base64');
  const init = {
    method: options.method || 'GET',
    headers: { Authorization: `Basic ${creds}` },
  };
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url.toString(), init);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Default to Retail Cultivation (CO-21) — Accelerator (CO-1) has crippled categories and no ForPlants location types.
export const LICENSE = process.env.METRC_LICENSE || 'SF-SBX-CO-21-8002';

// ---------------------------------------------------------------------------
// Configurable fetch — used by multi-state seeders
// ---------------------------------------------------------------------------
const INTER_REQUEST_DELAY_MS = 200;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a METRC API fetch function bound to a specific config.
 *
 * @param {{ baseUrl: string, vendorKey: string, userKey: string }} config
 * @returns {(path: string, params?: object, options?: object) => Promise<any>}
 */
export function createMetrcFetch(config) {
  const { baseUrl, vendorKey, userKey } = config;
  if (!vendorKey || !userKey) {
    throw new Error('createMetrcFetch requires vendorKey and userKey');
  }

  const creds = Buffer.from(`${vendorKey}:${userKey}`).toString('base64');

  return async function configuredFetch(path, params = {}, options = {}) {
    const url = new URL(path, baseUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const init = {
      method: options.method || 'GET',
      headers: { Authorization: `Basic ${creds}` },
    };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await sleep(INTER_REQUEST_DELAY_MS);
        const res = await fetch(url.toString(), init);
        const text = await res.text();

        if (res.ok) {
          try { return JSON.parse(text); } catch { return text; }
        }

        // Do not retry 4xx client errors (except 429 rate limit)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(text || `HTTP ${res.status}`);
        }

        lastError = text || `HTTP ${res.status}`;
      } catch (err) {
        if (err.message && !err.message.startsWith('HTTP')) {
          // Network error — retry
          lastError = err.message;
        } else {
          throw err;
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      }
    }

    throw new Error(lastError || 'Request failed after retries');
  };
}

/**
 * Load .env from a given path (for use by orchestrator scripts).
 * Does not overwrite existing env vars.
 */
export { loadEnvFile };

/**
 * State-specific METRC sandbox configurations.
 */
export function getStateConfig() {
  return {
    CO: {
      label: 'Colorado',
      baseUrl: 'https://sandbox-api-co.metrc.com',
      vendorKey: process.env.METRC_VENDOR_API_KEY || '',
      userKey: process.env.METRC_USER_API_KEY || '',
    },
    MA: {
      label: 'Massachusetts',
      baseUrl: 'https://sandbox-api-ma.metrc.com',
      vendorKey: '4csZ4tqRJBvNX7kkXiQbWj45O2c0IOdMhpoircz-ok3H3ZpT',
      userKey: 'EOyqdLe19nKlbzQYokyEahcTWt8scwnwABANSsT69J0D-0Gr',
    },
  };
}
