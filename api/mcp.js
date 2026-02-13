/**
 * Vercel Edge: MCP-over-HTTP endpoint for METRC tools.
 * POST with JSON-RPC body: { method: "tools/list" } or { method: "tools/call", params: { name, arguments } }.
 */

export const config = { runtime: 'edge' };

import { getToolsList, executeTool } from '../lib/metrc-edge.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://f8ai.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
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
    const license = args.license_number ? ` license=${args.license_number}` : '';
    if (!name) {
      console.log(`[MCP] tools/call → ERROR missing tool name`);
      return jsonResponse({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, error: { code: -32602, message: 'Missing tool name' } }, 400);
    }
    try {
      const text = await executeTool(name, args);
      const resultLen = typeof text === 'string' ? text.length : 0;
      console.log(`[MCP] tools/call ${name}${license} → OK ${resultLen} chars (${Date.now() - startMs}ms)`);
      return jsonResponse({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? 1,
        result: { content: [{ type: 'text', text }] },
      });
    } catch (err) {
      console.error(`[MCP] tools/call ${name}${license} → ERROR: ${err.message} (${Date.now() - startMs}ms)`);
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
