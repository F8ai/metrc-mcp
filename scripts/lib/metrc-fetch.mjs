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

export const LICENSE = process.env.METRC_LICENSE || 'SF-SBX-CO-1-8002';
