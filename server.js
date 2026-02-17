#!/usr/bin/env node
/**
 * METRC MCP Server
 * Provides MCP tools for METRC cannabis tracking API (Colorado sandbox).
 * Uses Basic Auth (vendor key + user key).
 *
 * Tool definitions: lib/tools.js (single source of truth)
 * Tool execution:   lib/tool-executor.js (shared with Edge runtime)
 * Input validation:  lib/validate.js (validates before METRC API call)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { encodeBasicAuth } from '@f8ai/metrc-client';
import { getToolsList } from './lib/tools.js';
import { executeTool } from './lib/tool-executor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from repo root (same dir as server.js)
try {
  const envPath = join(__dirname, '.env');
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

const BASE = process.env.METRC_API_URL || 'https://sandbox-api-co.metrc.com';
const VENDOR = process.env.METRC_VENDOR_API_KEY || '';
const USER = process.env.METRC_USER_API_KEY || '';

async function metrcFetch(path, params = {}, options = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env or environment.'
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

const server = new Server(
  { name: 'metrc-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// Skills exposed as MCP resources (metrc://skills/<name>) so any MCP client can read them
const SKILL_RESOURCES = [
  { uri: 'metrc://skills/needs-attention', name: 'Needs attention', description: 'What needs attention? Compliance, expiring tags, stuck harvests/transfers. Use with METRC tools.' },
  { uri: 'metrc://skills/facility-summary', name: 'Facility summary', description: 'Summarize the facility: counts, state, overview. Use with METRC tools.' },
  { uri: 'metrc://skills/traceability', name: 'Traceability', description: 'Package origin and harvest outputs. Use with METRC tools.' },
  { uri: 'metrc://skills/inventory-summary', name: 'Inventory summary', description: 'Inventory by item, location, or strain. Use with METRC tools.' },
  { uri: 'metrc://skills/audit-ready-snapshot', name: 'Audit-ready snapshot', description: 'Audit in a week? Check risk areas, health snapshot, cleanup recommendations. Use with METRC tools.' },
  { uri: 'metrc://skills/fifo-aging-pull', name: 'FIFO / aging pull', description: 'What to pull for samples, vendor days, discounting; FIFO; warn before breaking full case. Use with METRC tools.' },
  { uri: 'metrc://skills/fragmentation-detection', name: 'Fragmentation detection', description: 'Show package fragmentation; multiple partials per item/location. Use with METRC tools.' },
  { uri: 'metrc://skills/sample-out-low-counts', name: 'Sample-out low counts', description: 'Low-count packages for samples or sales incentives. Use with METRC tools.' },
  { uri: 'metrc://skills/slow-moving-inventory', name: 'Slow-moving inventory', description: 'Slow or non-moving inventory detection. Use with METRC tools.' },
  { uri: 'metrc://skills/aging-discount-sampling', name: 'Aging discount/sampling', description: 'Aging inventory; discount or sampling recommendations. Use with METRC tools.' },
  { uri: 'metrc://skills/package-consolidation', name: 'Package consolidation', description: 'Recommend re-sticker, combine low-counts, simplify units. Use with METRC tools.' },
  { uri: 'metrc://skills/README', name: 'Skills index', description: 'Index of all METRC analysis skills.' },
];

// Tool definitions from single source of truth
const tools = getToolsList();

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: SKILL_RESOURCES,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params?.uri;
  if (!uri || !uri.startsWith('metrc://skills/')) {
    throw new Error('Invalid or unsupported resource URI. Use metrc://skills/<name> (e.g. metrc://skills/needs-attention).');
  }
  const slug = uri.replace('metrc://skills/', '').trim() || 'README';
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  const path = join(__dirname, 'skills', safeSlug === 'README' ? 'README.md' : `${safeSlug}.md`);
  if (!existsSync(path)) {
    throw new Error(`Skill not found: ${slug}. Available: needs-attention, facility-summary, traceability, inventory-summary, audit-ready-snapshot, fifo-aging-pull, fragmentation-detection, sample-out-low-counts, slow-moving-inventory, aging-discount-sampling, package-consolidation, README.`);
  }
  const text = readFileSync(path, 'utf-8');
  return {
    contents: [{ type: 'text', text }],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    const text = await executeTool(name, args, metrcFetch);
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('METRC MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
