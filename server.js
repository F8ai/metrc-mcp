#!/usr/bin/env node
/**
 * METRC MCP Server
 * Provides MCP tools for METRC cannabis tracking API (Colorado sandbox).
 * Uses Basic Auth (vendor key + user key).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

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

async function metrcFetch(path, params = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env or environment.'
    );
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const creds = Buffer.from(`${VENDOR}:${USER}`).toString('base64');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${creds}` },
  });
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
  { capabilities: { tools: {} } }
);

const tools = [
  {
    name: 'metrc_get_facilities',
    description: 'List all facilities and their license numbers for the authenticated account',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_strains',
    description: 'Get active strains for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: {
          type: 'string',
          description: 'Facility license number (e.g. SF-SBX-CO-1-8002). Get from metrc_get_facilities.',
        },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_items',
    description: 'Get active items (products) for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: {
          type: 'string',
          description: 'Facility license number',
        },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_locations',
    description: 'Get active locations for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: {
          type: 'string',
          description: 'Facility license number',
        },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_packages',
    description: 'Get active packages for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_harvests',
    description: 'Get active harvests for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batches',
    description: 'Get active plant batches for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_units_of_measure',
    description: 'Get active units of measure (no license required)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_waste_methods',
    description: 'Get waste methods (no license required)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_employees',
    description: 'Get employees for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let data;
    switch (name) {
      case 'metrc_get_facilities':
        data = await metrcFetch('/facilities/v2/');
        break;
      case 'metrc_get_strains':
        data = await metrcFetch('/strains/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_items':
        data = await metrcFetch('/items/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_locations':
        data = await metrcFetch('/locations/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_packages':
        data = await metrcFetch('/packages/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_harvests':
        data = await metrcFetch('/harvests/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_plant_batches':
        data = await metrcFetch('/plantbatches/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_units_of_measure':
        data = await metrcFetch('/unitsofmeasure/v2/active');
        break;
      case 'metrc_get_waste_methods':
        data = await metrcFetch('/wastemethods/v2/');
        break;
      case 'metrc_get_employees':
        data = await metrcFetch('/employees/v2/', {
          licenseNumber: args.license_number,
        });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    const text =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);
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
