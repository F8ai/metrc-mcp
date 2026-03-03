/**
 * Vercel Edge: MCP-over-HTTP endpoint for METRC tools.
 * POST with JSON-RPC body: { method: "tools/list" } or { method: "tools/call", params: { name, arguments } }.
 */

export const config = { runtime: 'edge' };

import { getToolsList, executeTool } from '../lib/metrc-edge.js';

const DEFAULT_ORIGIN = 'https://f8ai.github.io';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function getCorsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || '';
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Store req in module scope — safe in Edge runtime (one request per isolate)
let _currentReq = null;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_currentReq) },
  });
}

export default async function handler(req) {
  _currentReq = req;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Bearer token auth — opt-in via MCP_API_KEY env var
  const apiKey = process.env.MCP_API_KEY;
  if (apiKey) {
    const auth = req.headers.get('authorization');
    if (!auth || auth !== `Bearer ${apiKey}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }

  const { jsonrpc, id, method, params } = body;
  const startMs = Date.now();

  if (method === 'tools/list') {
    const tools = getToolsList();
    console.log(`[MCP] tools/list → ${tools.length} tools (${Date.now() - startMs}ms)`);
    return jsonResponse({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, result: { tools } });
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (!name) {
      console.log(`[MCP] tools/call → ERROR missing tool name`);
      return jsonResponse({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, error: { code: -32602, message: 'Missing tool name' } }, 400);
    }
    try {
      const text = await executeTool(name, args);
      const resultLen = typeof text === 'string' ? text.length : 0;
      console.log(`[MCP] tools/call ${name} → OK ${resultLen} chars (${Date.now() - startMs}ms)`);
      return jsonResponse({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? 1,
        result: { content: [{ type: 'text', text }] },
      });
    } catch (err) {
      console.error(`[MCP] tools/call ${name} → ERROR (${Date.now() - startMs}ms)`);
      return jsonResponse({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? 1,
        result: {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        },
      });
    }
  }

  console.log(`[MCP] unknown method: ${method}`);
  return jsonResponse({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, error: { code: -32601, message: `Method not found: ${method}` } }, 404);
}
