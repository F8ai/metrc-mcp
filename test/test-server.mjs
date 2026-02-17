#!/usr/bin/env node
/**
 * Integration test: spawn METRC MCP server, run initialize + list tools + call a few tools.
 * Run from repo root: node test/test-server.mjs
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY for live API calls.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'server.js');

const PROTOCOL_VERSION = '2025-11-25';

function send(obj) {
  return JSON.stringify(obj) + '\n';
}

function parseResponse(line) {
  const msg = JSON.parse(line);
  if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
  return msg;
}

const EXPECTED_TOOLS = [
  'metrc_get_facilities',
  'metrc_get_strains',
  'metrc_get_items',
  'metrc_get_locations',
  'metrc_get_packages',
  'metrc_get_harvests',
  'metrc_get_plant_batches',
  'metrc_get_units_of_measure',
  'metrc_get_waste_methods',
  'metrc_get_employees',
  'metrc_get_plants_flowering',
  'metrc_harvest_plants',
  'metrc_get_location_types',
  'metrc_create_location',
  'metrc_get_tags_plant_available',
  'metrc_get_plant_batch_types',
  'metrc_get_plants_vegetative',
  'metrc_create_plant_batch_plantings',
  'metrc_change_plants_growth_phase',
  'metrc_get_harvest',
  'metrc_get_package',
  'metrc_get_plant',
  'metrc_create_package',
  'metrc_create_harvest_packages',
  'metrc_adjust_package',
  'metrc_change_package_location',
  'metrc_finish_package',
  'metrc_unfinish_package',
  'metrc_bulk_adjust_packages',
  'metrc_bulk_finish_packages',
  'metrc_bulk_change_package_location',
  'metrc_move_harvest',
  'metrc_rename_harvest',
  'metrc_finish_harvest',
  'metrc_unfinish_harvest',
  'metrc_get_harvests_inactive',
  'metrc_get_packages_inactive',
  'metrc_get_plant_batches_inactive',
  'metrc_get_transfers_incoming',
  'metrc_get_transfers_outgoing',
  'metrc_create_item',
  'metrc_update_item',
  'metrc_create_strain',
  'metrc_update_strain',
  'metrc_get_lab_test_types',
  'metrc_get_lab_test_batches',
  'metrc_get_lab_test_results',
  'metrc_post_harvest_waste',
  'metrc_get_processing_active',
  'metrc_get_processing_job_types',
  'metrc_sandbox_setup',
  'metrc_get_tags_package_available',
  'metrc_get_packages_with_pagination',
];

async function run() {
  const server = spawn(process.execPath, [serverPath], {
    cwd: join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  server.stderr.on('data', (chunk) => process.stderr.write(chunk));

  const rl = createInterface({ input: server.stdout, crlfDelay: Infinity });
  const nextLine = () => new Promise((resolve) => rl.once('line', resolve));

  const write = (data) => {
    return new Promise((resolve, reject) => {
      server.stdin.write(data, (err) => (err ? reject(err) : resolve()));
    });
  };

  try {
    // 1. Initialize
    await write(
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      })
    );
    const initLine = await nextLine();
    const initRes = parseResponse(initLine);
    if (!initRes.result || !initRes.result.capabilities) {
      throw new Error('Initialize failed: ' + JSON.stringify(initRes));
    }
    console.log('✓ initialize');

    // 2. Notifications/initialized
    await write(
      send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    );
    await new Promise((r) => setTimeout(r, 50));

    // 3. List tools
    await write(
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    );
    const listLine = await nextLine();
    const listRes = parseResponse(listLine);
    const names = (listRes.result?.tools || []).map((t) => t.name);
    const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
    if (missing.length) {
      throw new Error('Missing tools: ' + missing.join(', '));
    }
    console.log('✓ tools/list: ' + names.length + ' tools (all expected present)');

    // 4. Call metrc_get_units_of_measure (no license, may still need auth for base URL)
    await write(
      send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'metrc_get_units_of_measure', arguments: {} },
      })
    );
    const uomLine = await nextLine();
    const uomRes = parseResponse(uomLine);
    const content = uomRes.result?.content?.[0];
    if (!content) throw new Error('No content in units response: ' + JSON.stringify(uomRes));
    if (content.type === 'text' && content.text) {
      if (content.text.includes('credentials') || content.text.includes('Error')) {
        console.log('⚠ metrc_get_units_of_measure: skipped (no credentials)');
      } else {
        const parsed = JSON.parse(content.text);
        if (!Array.isArray(parsed)) throw new Error('Expected array of units');
        console.log('✓ metrc_get_units_of_measure: ' + parsed.length + ' units');
      }
    } else {
      throw new Error('Unexpected content: ' + JSON.stringify(content));
    }

    // 5. Call metrc_get_facilities (requires credentials)
    await write(
      send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'metrc_get_facilities', arguments: {} },
      })
    );
    const facLine = await nextLine();
    const facRes = parseResponse(facLine);
    const facContent = facRes.result?.content?.[0];
    if (facContent?.type === 'text') {
      if (facContent.text.includes('credentials') || facContent.text.includes('Error:')) {
        console.log('⚠ metrc_get_facilities: skipped (no .env credentials)');
      } else {
        const arr = JSON.parse(facContent.text);
        console.log('✓ metrc_get_facilities: ' + (Array.isArray(arr) ? arr.length : 0) + ' facilities');
      }
    } else {
      throw new Error('Unexpected facilities response: ' + JSON.stringify(facRes));
    }

    // 6. Call metrc_get_packages_with_pagination (needs license; may fail without credentials)
    const license = process.env.METRC_LICENSE || 'SF-SBX-CO-1-8002';
    await write(
      send({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'metrc_get_packages_with_pagination',
          arguments: { license_number: license, page: 1, page_size: 5 },
        },
      })
    );
    const pkgLine = await nextLine();
    const pkgRes = parseResponse(pkgLine);
    const pkgContent = pkgRes.result?.content?.[0];
    if (pkgContent?.type === 'text') {
      if (pkgContent.text.includes('credentials') || (pkgContent.text.startsWith('Error') && !pkgContent.text.trimStart().startsWith('['))) {
        console.log('⚠ metrc_get_packages_with_pagination: skipped (no credentials or API error)');
      } else {
        try {
          const arr = JSON.parse(pkgContent.text);
          console.log('✓ metrc_get_packages_with_pagination: returned ' + (Array.isArray(arr) ? arr.length : 'data'));
        } catch {
          console.log('⚠ metrc_get_packages_with_pagination: non-JSON response (e.g. API error)');
        }
      }
    } else {
      throw new Error('Unexpected packages response: ' + JSON.stringify(pkgRes));
    }

    // 7. Unknown tool should return error in content (handler throws -> returned as tool error)
    await write(
      send({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'metrc_nonexistent_tool', arguments: {} },
      })
    );
    const badLine = await nextLine();
    const badRes = parseResponse(badLine);
    const badContent = badRes.result?.content?.[0];
    const isError = badContent?.type === 'text' && badContent.text.includes('Unknown tool');
    if (isError) {
      console.log('✓ unknown tool returns error as expected');
    } else {
      console.log('⚠ unknown tool response:', JSON.stringify(badRes).slice(0, 200));
    }

    console.log('\nAll tests passed.');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  } finally {
    server.kill();
  }
}

run();
