/**
 * Vercel Edge: MCP-over-HTTP endpoint for METRC tools.
 * POST with JSON-RPC body: { method: "tools/list" } or { method: "tools/call", params: { name, arguments } }.
 */

export const config = { runtime: 'edge' };

import { getToolsList, executeTool } from '../lib/metrc-edge.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { jsonrpc, id, method, params } = body;
  if (method === 'tools/list') {
    const tools = getToolsList();
    return new Response(
      JSON.stringify({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, result: { tools } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (!name) {
      return new Response(
        JSON.stringify({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, error: { code: -32602, message: 'Missing tool name' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    try {
      const text = await executeTool(name, args);
      return new Response(
        JSON.stringify({
          jsonrpc: jsonrpc || '2.0',
          id: id ?? 1,
          result: { content: [{ type: 'text', text }] },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          jsonrpc: jsonrpc || '2.0',
          id: id ?? 1,
          result: {
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            isError: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ jsonrpc: jsonrpc || '2.0', id: id ?? 1, error: { code: -32601, message: `Method not found: ${method}` } }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
