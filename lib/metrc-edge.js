/**
 * Edge-safe METRC client for Vercel Edge (api/mcp, api/chat).
 *
 * Tool definitions and execution logic are imported from shared modules
 * (lib/tools.js, lib/tool-executor.js). This file provides:
 *   1. Edge-safe metrcFetch (auth via @f8ai/metrc-client)
 *   2. Re-exports for backwards compatibility with api/mcp.js and api/chat.js
 *
 * Uses process.env: METRC_API_URL, METRC_VENDOR_API_KEY, METRC_USER_API_KEY.
 */

import { encodeBasicAuth } from '@f8ai/metrc-client';
import { getToolsList as _getToolsList, getOpenAITools as _getOpenAITools } from './tools.js';
import { executeTool as _executeTool } from './tool-executor.js';

const BASE = process.env.METRC_API_URL || 'https://sandbox-api-co.metrc.com';
const VENDOR = process.env.METRC_VENDOR_API_KEY || '';
const USER = process.env.METRC_USER_API_KEY || '';

/** Edge-safe METRC API fetch with Basic auth. */
export async function metrcFetch(path, params = {}, options = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in environment.'
    );
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const init = {
    method: options.method || 'GET',
    headers: { Authorization: encodeBasicAuth(VENDOR, USER) },
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

// Re-export tool list functions (backwards-compatible with api/mcp.js and api/chat.js)
export const TOOLS = _getToolsList();
export const getToolsList = _getToolsList;
export const getOpenAITools = _getOpenAITools;

/** Execute a tool using the edge-safe metrcFetch. */
export async function executeTool(name, args = {}) {
  return _executeTool(name, args, metrcFetch);
}
