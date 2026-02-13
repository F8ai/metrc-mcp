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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
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

async function metrcFetch(path, params = {}, options = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env or environment.'
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
  {
    name: 'metrc_get_plants_flowering',
    description: 'Get flowering plants for a facility (required before creating a harvest)',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_harvest_plants',
    description:
      'Create a harvest by harvesting flowering plants. Supply harvest name, harvest date (YYYY-MM-DD), and plant IDs from metrc_get_plants_flowering. Colorado also requires weight, unit, and drying location per plant.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        harvest_name: { type: 'string', description: 'Name for the harvest' },
        harvest_date: { type: 'string', description: 'Harvest date (YYYY-MM-DD)' },
        plant_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of plant Id values from flowering plants',
        },
        plant_labels: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of plant Label values from flowering plants (required for Colorado). Get from metrc_get_plants_flowering.',
        },
        weight_per_plant: {
          type: 'number',
          description: 'Weight per plant (e.g. 1). Default 1.',
        },
        unit_of_measure: { type: 'string', description: 'Unit of measure (e.g. Ounces). Default Ounces.' },
        drying_location_id: {
          type: 'number',
          description: 'Location Id for drying. Get from metrc_get_locations.',
        },
      },
      required: ['license_number', 'harvest_name', 'harvest_date', 'plant_ids'],
    },
  },
  {
    name: 'metrc_get_location_types',
    description: 'Get location types for a facility (need one that allows plants to create plantings)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_create_location',
    description: 'Create a location. Use a LocationTypeId that allows plants (ForPlants: true).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        name: { type: 'string', description: 'Location name' },
        location_type_id: { type: 'number', description: 'LocationTypeId from metrc_get_location_types' },
      },
      required: ['license_number', 'name', 'location_type_id'],
    },
  },
  {
    name: 'metrc_get_tags_plant_available',
    description: 'Get available plant tags for the facility (needed to create plantings)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batch_types',
    description: 'Get plant batch types (e.g. Seed, Clone) for the facility',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plants_vegetative',
    description: 'Get vegetative plants for a facility (can be moved to flowering)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_create_plant_batch_plantings',
    description:
      'Create a plant batch and plantings (individual plants). Requires strain_id, location_id, type (e.g. Clone), count, planting_date (YYYY-MM-DD), and plant tag labels from metrc_get_tags_plant_available.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        plant_batch_name: { type: 'string', description: 'Name for the plant batch' },
        strain_id: { type: 'number', description: 'Strain Id from metrc_get_strains' },
        strain_name: { type: 'string', description: 'Strain name (e.g. SBX Strain 1). Required by Colorado API.' },
        location_id: { type: 'number', description: 'Location Id (must allow plants)' },
        type: { type: 'string', description: 'Plant batch type, e.g. Clone or Seed' },
        count: { type: 'number', description: 'Number of plants to create' },
        planting_date: { type: 'string', description: 'Planting date YYYY-MM-DD' },
        plant_labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of plant tag labels from metrc_get_tags_plant_available (one per plant)',
        },
      },
      required: ['license_number', 'plant_batch_name', 'strain_id', 'location_id', 'type', 'count', 'planting_date', 'plant_labels'],
    },
  },
  {
    name: 'metrc_change_plants_growth_phase',
    description:
      'Change plant growth phase (e.g. to Flowering). Supply plant_ids and/or plant_labels, and new growth_phase (e.g. Flowering), and change_date (YYYY-MM-DD).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        growth_phase: { type: 'string', description: 'New phase: Vegetative or Flowering' },
        change_date: { type: 'string', description: 'Date of change YYYY-MM-DD' },
        plant_ids: { type: 'array', items: { type: 'number' }, description: 'Plant Ids to change' },
        plant_labels: { type: 'array', items: { type: 'string' }, description: 'Plant Labels to change' },
      },
      required: ['license_number', 'growth_phase', 'change_date'],
    },
  },
  // Lookups by ID/label
  {
    name: 'metrc_get_harvest',
    description: 'Get a single harvest by ID',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        harvest_id: { type: 'number', description: 'Harvest Id' },
      },
      required: ['license_number', 'harvest_id'],
    },
  },
  {
    name: 'metrc_get_package',
    description: 'Get a single package by ID or by label',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        package_id: { type: 'number', description: 'Package Id (use id or label, not both)' },
        package_label: { type: 'string', description: 'Package label (use id or label)' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant',
    description: 'Get a single plant by ID or by label',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        plant_id: { type: 'number', description: 'Plant Id' },
        plant_label: { type: 'string', description: 'Plant label' },
      },
      required: ['license_number'],
    },
  },
  // Packages - create, from harvest, adjust, location, finish
  {
    name: 'metrc_create_package',
    description: 'Create a new package. Requires item_id, tag, quantity, unit, location_id, and optional label.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        tag: { type: 'string', description: 'Package tag from metrc_get_tags_package_available' },
        location_id: { type: 'number' },
        item_id: { type: 'number' },
        quantity: { type: 'number' },
        unit_of_measure: { type: 'string' },
        is_production_batch: { type: 'boolean' },
        product_requires_remediation: { type: 'boolean' },
        actual_date: { type: 'string', description: 'YYYY-MM-DD' },
        ingredients: { type: 'array', items: { type: 'object' }, description: 'For derived packages' },
      },
      required: ['license_number', 'tag', 'location_id', 'item_id', 'quantity', 'unit_of_measure', 'actual_date'],
    },
  },
  {
    name: 'metrc_create_harvest_packages',
    description: 'Create packages from a harvest. Supply harvest_id and package definitions (item, quantity, unit, tag, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        harvest_name: { type: 'string' },
        packages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Tag: { type: 'string' },
              LocationId: { type: 'number' },
              ItemId: { type: 'number' },
              Quantity: { type: 'number' },
              UnitOfMeasure: { type: 'string' },
              IsProductionBatch: { type: 'boolean' },
              ProductRequiresRemediation: { type: 'boolean' },
              ActualDate: { type: 'string' },
            },
          },
        },
      },
      required: ['license_number', 'packages'],
    },
  },
  {
    name: 'metrc_adjust_package',
    description: 'Adjust package quantity. Supply package label, quantity, unit, reason, and adjustment date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        quantity: { type: 'number' },
        unit_of_measure: { type: 'string' },
        adjustment_reason: { type: 'string' },
        adjustment_date: { type: 'string' },
        reason_note: { type: 'string' },
      },
      required: ['license_number', 'label', 'quantity', 'unit_of_measure', 'adjustment_reason', 'adjustment_date'],
    },
  },
  {
    name: 'metrc_change_package_location',
    description: 'Change package location. Supply package label and new location_id.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        location_id: { type: 'number' },
      },
      required: ['license_number', 'label', 'location_id'],
    },
  },
  {
    name: 'metrc_finish_package',
    description: 'Finish a package (make it available for sale). Supply label and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'label', 'actual_date'],
    },
  },
  {
    name: 'metrc_unfinish_package',
    description: 'Unfinish a package. Supply label and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'label', 'actual_date'],
    },
  },
  // Bulk package actions (array payloads)
  {
    name: 'metrc_bulk_adjust_packages',
    description: 'Adjust multiple packages in one call. Supply license_number and adjustments array (each: label, quantity, unit_of_measure, adjustment_reason, adjustment_date, optional reason_note).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        adjustments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              quantity: { type: 'number' },
              unit_of_measure: { type: 'string' },
              adjustment_reason: { type: 'string' },
              adjustment_date: { type: 'string' },
              reason_note: { type: 'string' },
            },
            required: ['label', 'quantity', 'unit_of_measure', 'adjustment_reason', 'adjustment_date'],
          },
        },
      },
      required: ['license_number', 'adjustments'],
    },
  },
  {
    name: 'metrc_bulk_finish_packages',
    description: 'Finish multiple packages in one call. Supply license_number, actual_date, and labels array.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        actual_date: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Package labels to finish' },
      },
      required: ['license_number', 'actual_date', 'labels'],
    },
  },
  {
    name: 'metrc_bulk_change_package_location',
    description: 'Change location for multiple packages in one call. Supply license_number and moves array (each: label, location_id).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        moves: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              location_id: { type: 'number' },
            },
            required: ['label', 'location_id'],
          },
        },
      },
      required: ['license_number', 'moves'],
    },
  },
  // Harvest - packages from harvest, move, rename, finish
  {
    name: 'metrc_move_harvest',
    description: 'Move harvest to a different location. Supply harvest_id and new location_id.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        location_id: { type: 'number' },
      },
      required: ['license_number', 'harvest_id', 'location_id'],
    },
  },
  {
    name: 'metrc_rename_harvest',
    description: 'Rename a harvest. Supply harvest_id and new name.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        new_name: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'new_name'],
    },
  },
  {
    name: 'metrc_finish_harvest',
    description: 'Finish a harvest. Supply harvest_id and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'actual_date'],
    },
  },
  {
    name: 'metrc_unfinish_harvest',
    description: 'Unfinish a harvest. Supply harvest_id and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'actual_date'],
    },
  },
  // Inactive / historical
  {
    name: 'metrc_get_harvests_inactive',
    description: 'Get inactive harvests (with optional page)',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_packages_inactive',
    description: 'Get inactive packages',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batches_inactive',
    description: 'Get inactive plant batches',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  // Transfers
  {
    name: 'metrc_get_transfers_incoming',
    description: 'List incoming transfers',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_transfers_outgoing',
    description: 'List outgoing transfers',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Items create/update
  {
    name: 'metrc_create_item',
    description: 'Create a new item (product). Supply name, category, unit of measure, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        name: { type: 'string' },
        item_category: { type: 'string' },
        unit_of_measure: { type: 'string' },
        strain_id: { type: 'number' },
        item_brand: { type: 'string' },
        administration_method: { type: 'string' },
        unit_cbd_percent: { type: 'number' },
        unit_cbd_content: { type: 'number' },
        unit_cbd_content_unit: { type: 'string' },
        unit_thc_percent: { type: 'number' },
        unit_thc_content: { type: 'number' },
        unit_thc_content_unit: { type: 'string' },
      },
      required: ['license_number', 'name', 'item_category', 'unit_of_measure'],
    },
  },
  {
    name: 'metrc_update_item',
    description: 'Update an existing item. Supply id and fields to update.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        id: { type: 'number' },
        name: { type: 'string' },
        item_category: { type: 'string' },
        unit_of_measure: { type: 'string' },
      },
      required: ['license_number', 'id'],
    },
  },
  // Strains create/update
  {
    name: 'metrc_create_strain',
    description: 'Create a new strain',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        name: { type: 'string' },
        testing_status: { type: 'string' },
        thc_level: { type: 'number' },
        cbd_level: { type: 'number' },
        indica_percentage: { type: 'number' },
        sativa_percentage: { type: 'number' },
        genetics: { type: 'string' },
      },
      required: ['license_number', 'name'],
    },
  },
  {
    name: 'metrc_update_strain',
    description: 'Update an existing strain',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        id: { type: 'number' },
        name: { type: 'string' },
        testing_status: { type: 'string' },
        thc_level: { type: 'number' },
        cbd_level: { type: 'number' },
        indica_percentage: { type: 'number' },
        sativa_percentage: { type: 'number' },
        genetics: { type: 'string' },
      },
      required: ['license_number', 'id'],
    },
  },
  // Lab tests
  {
    name: 'metrc_get_lab_test_types',
    description: 'Get lab test types',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_lab_test_batches',
    description: 'Get lab test batches',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        package_id: { type: 'number' },
        harvest_id: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_lab_test_results',
    description: 'Get lab test results',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        package_id: { type: 'number' },
        harvest_id: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  // Waste
  {
    name: 'metrc_post_harvest_waste',
    description: 'Record waste on a harvest. Supply harvest_id, waste method, quantity, unit, and date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        harvest_name: { type: 'string' },
        waste_method_id: { type: 'number' },
        waste_amount: { type: 'number' },
        waste_unit_of_measure: { type: 'string' },
        waste_date: { type: 'string' },
        reason_note: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'harvest_name', 'waste_method_id', 'waste_amount', 'waste_unit_of_measure', 'waste_date'],
    },
  },
  // Processing
  {
    name: 'metrc_get_processing_active',
    description: 'Get active processing jobs',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_processing_job_types',
    description: 'Get processing job types',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Sandbox
  {
    name: 'metrc_sandbox_setup',
    description: 'Run sandbox integrator setup to seed test data (sandbox only)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  // Package tags (for create package)
  {
    name: 'metrc_get_tags_package_available',
    description: 'Get available package tags',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Pagination for existing list endpoints
  {
    name: 'metrc_get_packages_with_pagination',
    description: 'Get packages with optional page and pageSize',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page: { type: 'number' },
        page_size: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
];

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
      case 'metrc_get_plants_flowering':
        data = await metrcFetch('/plants/v2/flowering', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_harvest_plants': {
        const labels = args.plant_labels || [];
        const ids = args.plant_ids || [];
        const weight = args.weight_per_plant ?? 1;
        const unit = args.unit_of_measure || 'Ounces';
        const dryingId = args.drying_location_id;
        const body = ids.map((id, i) => {
          const o = {
            HarvestName: args.harvest_name,
            HarvestDate: args.harvest_date,
            Id: id,
            Weight: weight,
            UnitOfMeasure: unit,
            ActualDate: args.harvest_date,
          };
          if (labels[i] !== undefined) o.Label = labels[i];
          if (dryingId != null) o.DryingLocationId = dryingId;
          return o;
        });
        data = await metrcFetch(
          '/plants/v2/harvest',
          { licenseNumber: args.license_number },
          { method: 'PUT', body }
        );
        break;
      }
      case 'metrc_get_location_types':
        data = await metrcFetch('/locations/v2/types', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_create_location':
        data = await metrcFetch(
          '/locations/v2/',
          { licenseNumber: args.license_number },
          {
            method: 'POST',
            body: [{ Name: args.name, LocationTypeId: args.location_type_id }],
          }
        );
        break;
      case 'metrc_get_tags_plant_available':
        data = await metrcFetch('/tags/v2/plant/available', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_plant_batch_types':
        data = await metrcFetch('/plantbatches/v2/types', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_plants_vegetative':
        data = await metrcFetch('/plants/v2/vegetative', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_create_plant_batch_plantings': {
        let plantLabels = args.plant_labels;
        if (typeof plantLabels === 'string') plantLabels = JSON.parse(plantLabels);
        plantLabels = Array.isArray(plantLabels) ? plantLabels : [];
        const batchName = String(args.plant_batch_name ?? '').trim();
        if (!batchName) throw new Error('plant_batch_name is required');
        const arrayBody = plantLabels.map((label) => {
          const o = {
            PlantBatchName: batchName,
            Type: args.type,
            Count: 1,
            LocationId: args.location_id,
            ActualDate: args.planting_date,
            PlantLabel: label,
          };
          if (args.strain_name) o.Strain = args.strain_name;
          else o.StrainId = args.strain_id;
          return o;
        });
        data = await metrcFetch(
          '/plantbatches/v2/plantings',
          { licenseNumber: args.license_number },
          { method: 'POST', body: arrayBody }
        );
        break;
      }
      case 'metrc_change_plants_growth_phase': {
        const ids = args.plant_ids || [];
        const labels = args.plant_labels || [];
        const date = args.change_date;
        const phase = args.growth_phase;
        const body = [
          ...ids.map((Id) => ({ Id, GrowthPhase: phase, ActualDate: date })),
          ...labels.map((Label) => ({ Label, GrowthPhase: phase, ActualDate: date })),
        ];
        if (body.length === 0) throw new Error('Provide plant_ids or plant_labels');
        data = await metrcFetch(
          '/plants/v2/growthphase',
          { licenseNumber: args.license_number },
          { method: 'PUT', body }
        );
        break;
      }
      case 'metrc_get_harvest':
        data = await metrcFetch(`/harvests/v2/${args.harvest_id}`, {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_package':
        if (args.package_label != null) {
          data = await metrcFetch(`/packages/v2/${encodeURIComponent(args.package_label)}`, {
            licenseNumber: args.license_number,
          });
        } else if (args.package_id != null) {
          data = await metrcFetch(`/packages/v2/${args.package_id}`, {
            licenseNumber: args.license_number,
          });
        } else {
          throw new Error('Provide package_id or package_label');
        }
        break;
      case 'metrc_get_plant':
        if (args.plant_label != null) {
          data = await metrcFetch(`/plants/v2/${encodeURIComponent(args.plant_label)}`, {
            licenseNumber: args.license_number,
          });
        } else if (args.plant_id != null) {
          data = await metrcFetch(`/plants/v2/${args.plant_id}`, {
            licenseNumber: args.license_number,
          });
        } else {
          throw new Error('Provide plant_id or plant_label');
        }
        break;
      case 'metrc_create_package': {
        const pkg = {
          Tag: args.tag,
          LocationId: args.location_id,
          ItemId: args.item_id,
          Quantity: args.quantity,
          UnitOfMeasure: args.unit_of_measure,
          IsProductionBatch: args.is_production_batch ?? false,
          ProductRequiresRemediation: args.product_requires_remediation ?? false,
          ActualDate: args.actual_date,
        };
        if (args.ingredients) pkg.Ingredients = args.ingredients;
        data = await metrcFetch(
          '/packages/v2/',
          { licenseNumber: args.license_number },
          { method: 'POST', body: [pkg] }
        );
        break;
      }
      case 'metrc_create_harvest_packages':
        data = await metrcFetch(
          '/harvests/v2/packages',
          { licenseNumber: args.license_number },
          { method: 'POST', body: args.packages }
        );
        break;
      case 'metrc_adjust_package': {
        const adjBody = [{
          Label: args.label,
          Quantity: args.quantity,
          UnitOfMeasure: args.unit_of_measure,
          AdjustmentReason: args.adjustment_reason,
          AdjustmentDate: args.adjustment_date,
          ReasonNote: args.reason_note || '',
        }];
        data = await metrcFetch(
          '/packages/v2/adjust',
          { licenseNumber: args.license_number },
          { method: 'POST', body: adjBody }
        );
        break;
      }
      case 'metrc_change_package_location': {
        const locBody = [{ Label: args.label, LocationId: args.location_id }];
        data = await metrcFetch(
          '/packages/v2/location',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: locBody }
        );
        break;
      }
      case 'metrc_finish_package': {
        const finishBody = [{ Label: args.label, ActualDate: args.actual_date }];
        data = await metrcFetch(
          '/packages/v2/finish',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: finishBody }
        );
        break;
      }
      case 'metrc_unfinish_package': {
        const unfinishBody = [{ Label: args.label, ActualDate: args.actual_date }];
        data = await metrcFetch(
          '/packages/v2/unfinish',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: unfinishBody }
        );
        break;
      }
      case 'metrc_bulk_adjust_packages': {
        const adjustments = Array.isArray(args.adjustments) ? args.adjustments : [];
        if (adjustments.length === 0) throw new Error('adjustments array is required and must not be empty');
        const adjBody = adjustments.map((a) => ({
          Label: a.label,
          Quantity: a.quantity,
          UnitOfMeasure: a.unit_of_measure,
          AdjustmentReason: a.adjustment_reason,
          AdjustmentDate: a.adjustment_date,
          ReasonNote: a.reason_note || '',
        }));
        data = await metrcFetch(
          '/packages/v2/adjust',
          { licenseNumber: args.license_number },
          { method: 'POST', body: adjBody }
        );
        break;
      }
      case 'metrc_bulk_finish_packages': {
        const labels = Array.isArray(args.labels) ? args.labels : [];
        if (labels.length === 0) throw new Error('labels array is required and must not be empty');
        const finishBody = labels.map((l) => ({ Label: l, ActualDate: args.actual_date }));
        data = await metrcFetch(
          '/packages/v2/finish',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: finishBody }
        );
        break;
      }
      case 'metrc_bulk_change_package_location': {
        const moves = Array.isArray(args.moves) ? args.moves : [];
        if (moves.length === 0) throw new Error('moves array is required and must not be empty');
        const locBody = moves.map((m) => ({ Label: m.label, LocationId: m.location_id }));
        data = await metrcFetch(
          '/packages/v2/location',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: locBody }
        );
        break;
      }
      case 'metrc_move_harvest': {
        const moveBody = [{ Id: args.harvest_id, LocationId: args.location_id }];
        data = await metrcFetch(
          '/harvests/v2/location',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: moveBody }
        );
        break;
      }
      case 'metrc_rename_harvest': {
        const renameBody = [{ Id: args.harvest_id, NewName: args.new_name }];
        data = await metrcFetch(
          '/harvests/v2/rename',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: renameBody }
        );
        break;
      }
      case 'metrc_finish_harvest': {
        const finishBody = [{ Id: args.harvest_id, ActualDate: args.actual_date }];
        data = await metrcFetch(
          '/harvests/v2/finish',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: finishBody }
        );
        break;
      }
      case 'metrc_unfinish_harvest': {
        const unfinishBody = [{ Id: args.harvest_id, ActualDate: args.actual_date }];
        data = await metrcFetch(
          '/harvests/v2/unfinish',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: unfinishBody }
        );
        break;
      }
      case 'metrc_get_harvests_inactive': {
        const q = { licenseNumber: args.license_number };
        if (args.page_size != null) q.pageSize = args.page_size;
        if (args.page != null) q.page = args.page;
        data = await metrcFetch('/harvests/v2/inactive', q);
        break;
      }
      case 'metrc_get_packages_inactive': {
        const q = { licenseNumber: args.license_number };
        if (args.page_size != null) q.pageSize = args.page_size;
        if (args.page != null) q.page = args.page;
        data = await metrcFetch('/packages/v2/inactive', q);
        break;
      }
      case 'metrc_get_plant_batches_inactive': {
        const q = { licenseNumber: args.license_number };
        if (args.page_size != null) q.pageSize = args.page_size;
        if (args.page != null) q.page = args.page;
        data = await metrcFetch('/plantbatches/v2/inactive', q);
        break;
      }
      case 'metrc_get_transfers_incoming':
        data = await metrcFetch('/transfers/v2/incoming', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_transfers_outgoing':
        data = await metrcFetch('/transfers/v2/outgoing', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_create_item': {
        const item = {
          Name: args.name,
          ItemCategory: args.item_category,
          UnitOfMeasure: args.unit_of_measure,
          StrainId: args.strain_id,
          ItemBrand: args.item_brand,
          AdministrationMethod: args.administration_method,
          UnitCbdPercent: args.unit_cbd_percent,
          UnitCbdContent: args.unit_cbd_content,
          UnitCbdContentUnit: args.unit_cbd_content_unit,
          UnitThcPercent: args.unit_thc_percent,
          UnitThcContent: args.unit_thc_content,
          UnitThcContentUnit: args.unit_thc_content_unit,
        };
        Object.keys(item).forEach((k) => item[k] == null && delete item[k]);
        data = await metrcFetch(
          '/items/v2/',
          { licenseNumber: args.license_number },
          { method: 'POST', body: [item] }
        );
        break;
      }
      case 'metrc_update_item': {
        const item = {
          Id: args.id,
          Name: args.name,
          ItemCategory: args.item_category,
          UnitOfMeasure: args.unit_of_measure,
        };
        Object.keys(item).forEach((k) => item[k] == null && k !== 'Id' && delete item[k]);
        data = await metrcFetch(
          '/items/v2/',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: [item] }
        );
        break;
      }
      case 'metrc_create_strain': {
        const strain = {
          Name: args.name,
          TestingStatus: args.testing_status,
          ThcLevel: args.thc_level,
          CbdLevel: args.cbd_level,
          IndicaPercentage: args.indica_percentage,
          SativaPercentage: args.sativa_percentage,
          Genetics: args.genetics,
        };
        Object.keys(strain).forEach((k) => strain[k] == null && delete strain[k]);
        data = await metrcFetch(
          '/strains/v2/',
          { licenseNumber: args.license_number },
          { method: 'POST', body: [strain] }
        );
        break;
      }
      case 'metrc_update_strain': {
        const strain = {
          Id: args.id,
          Name: args.name,
          TestingStatus: args.testing_status,
          ThcLevel: args.thc_level,
          CbdLevel: args.cbd_level,
          IndicaPercentage: args.indica_percentage,
          SativaPercentage: args.sativa_percentage,
          Genetics: args.genetics,
        };
        Object.keys(strain).forEach((k) => strain[k] == null && k !== 'Id' && delete strain[k]);
        data = await metrcFetch(
          '/strains/v2/',
          { licenseNumber: args.license_number },
          { method: 'PUT', body: [strain] }
        );
        break;
      }
      case 'metrc_get_lab_test_types':
        data = await metrcFetch('/labtests/v2/types', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_lab_test_batches': {
        const q = { licenseNumber: args.license_number };
        if (args.package_id != null) q.packageId = args.package_id;
        if (args.harvest_id != null) q.harvestId = args.harvest_id;
        data = await metrcFetch('/labtests/v2/batches', q);
        break;
      }
      case 'metrc_get_lab_test_results': {
        const q = { licenseNumber: args.license_number };
        if (args.package_id != null) q.packageId = args.package_id;
        if (args.harvest_id != null) q.harvestId = args.harvest_id;
        data = await metrcFetch('/labtests/v2/results', q);
        break;
      }
      case 'metrc_post_harvest_waste': {
        const wasteBody = [{
          HarvestId: args.harvest_id,
          HarvestName: args.harvest_name,
          WasteMethodId: args.waste_method_id,
          WasteAmount: args.waste_amount,
          WasteUnitOfMeasure: args.waste_unit_of_measure,
          WasteDate: args.waste_date,
          ReasonNote: args.reason_note || '',
        }];
        data = await metrcFetch(
          '/harvests/v2/waste',
          { licenseNumber: args.license_number },
          { method: 'POST', body: wasteBody }
        );
        break;
      }
      case 'metrc_get_processing_active':
        data = await metrcFetch('/processing/v2/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_processing_job_types':
        data = await metrcFetch('/processing/v2/jobtypes/active', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_sandbox_setup':
        data = await metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
        break;
      case 'metrc_get_tags_package_available':
        data = await metrcFetch('/tags/v2/package/available', {
          licenseNumber: args.license_number,
        });
        break;
      case 'metrc_get_packages_with_pagination': {
        const q = { licenseNumber: args.license_number };
        if (args.page != null) q.page = args.page;
        if (args.page_size != null) q.pageSize = args.page_size;
        data = await metrcFetch('/packages/v2/active', q);
        break;
      }
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
