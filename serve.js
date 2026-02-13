#!/usr/bin/env node
/**
 * Railway HTTP entrypoint — wraps the Vercel Edge handler from api/mcp.js
 * into a standard Node.js HTTP server.
 */

import { createServer } from 'node:http';
import handler from './api/mcp.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const server = createServer(async (req, res) => {
  const startMs = Date.now();

  // Health check
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'metrc-mcp' }));
    return;
  }

  // Build a Web API Request from the Node IncomingMessage
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const webRequest = new Request(url.toString(), {
    method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ),
    body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
  });

  const webResponse = await handler(webRequest);

  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  const responseBody = await webResponse.text();
  res.end(responseBody);

  console.log(`${req.method} ${req.url} → ${webResponse.status} (${Date.now() - startMs}ms)`);
});

server.listen(PORT, () => {
  console.log(`metrc-mcp HTTP server listening on port ${PORT}`);
});
