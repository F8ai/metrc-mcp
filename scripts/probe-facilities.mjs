#!/usr/bin/env node
/**
 * Probe all Colorado and Massachusetts METRC sandbox facilities to document
 * what each supports (endpoints, capabilities, entity counts, tags).
 *
 * Usage:
 *   node scripts/probe-facilities.mjs                  # probe both CO and MA
 *   node scripts/probe-facilities.mjs --state CO       # Colorado only
 *   node scripts/probe-facilities.mjs --state MA       # Massachusetts only
 *   node scripts/probe-facilities.mjs --state ALL      # both (default)
 *
 * Outputs:
 *   - scripts/facility-capabilities.json   (structured JSON)
 *   - Console summary table
 *
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY (Colorado).
 * Massachusetts credentials are hardcoded for the sandbox.
 */

import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Load .env (same approach as scripts/lib/metrc-fetch.mjs)
// ---------------------------------------------------------------------------
function loadEnvFile(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !match[1].startsWith('#')) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    });
  } catch (_) {
    // .env may not exist; that is acceptable for MA-only runs
  }
}

loadEnvFile(join(root, '.env'));

// ---------------------------------------------------------------------------
// State configuration
// ---------------------------------------------------------------------------
const STATE_CONFIG = {
  CO: {
    label: 'Colorado',
    baseUrl: 'https://sandbox-api-co.metrc.com',
    vendorKey: process.env.METRC_VENDOR_API_KEY || '',
    userKey: process.env.METRC_USER_API_KEY || '',
  },
  MA: {
    label: 'Massachusetts',
    baseUrl: 'https://sandbox-api-ma.metrc.com',
    vendorKey: '4csZ4tqRJBvNX7kkXiQbWj45O2c0IOdMhpoircz-ok3H3ZpT',
    userKey: 'EOyqdLe19nKlbzQYokyEahcTWt8scwnwABANSsT69J0D-0Gr',
  },
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  let stateFilter = 'ALL';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state' && args[i + 1]) {
      stateFilter = args[i + 1].toUpperCase();
      i++;
    }
  }
  if (!['CO', 'MA', 'ALL'].includes(stateFilter)) {
    console.error(`Invalid --state value: ${stateFilter}. Use CO, MA, or ALL.`);
    process.exit(1);
  }
  return { stateFilter };
}

// ---------------------------------------------------------------------------
// HTTP fetch with retry + exponential backoff
// ---------------------------------------------------------------------------
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;
const INTER_REQUEST_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a METRC API request with retry logic.
 *
 * @param {string} baseUrl - Sandbox API base URL
 * @param {string} vendorKey - Vendor API key
 * @param {string} userKey - User API key
 * @param {string} path - API path (e.g. /facilities/v2)
 * @param {Record<string, string>} params - Query parameters
 * @returns {Promise<{ok: boolean, status: number, data: any, error: string|null}>}
 */
async function metrcProbe(baseUrl, vendorKey, userKey, path, params = {}) {
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const creds = Buffer.from(`${vendorKey}:${userKey}`).toString('base64');
  const headers = { Authorization: `Basic ${creds}` };

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), { method: 'GET', headers });
      const text = await res.text();

      if (res.ok) {
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { ok: true, status: res.status, data, error: null };
      }

      // 401/403 — auth or permission issue, do not retry
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` };
      }

      // 404 — endpoint does not exist for this facility
      if (res.status === 404) {
        return { ok: false, status: res.status, data: null, error: `HTTP 404` };
      }

      lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
    } catch (err) {
      lastError = err.message;
    }

    // Exponential backoff before retry
    if (attempt < MAX_RETRIES - 1) {
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return { ok: false, status: 0, data: null, error: lastError };
}

// ---------------------------------------------------------------------------
// Extract entity count from METRC v2 paginated response
// ---------------------------------------------------------------------------
function extractCount(data) {
  if (data == null) return 0;
  if (typeof data === 'object' && data.Total != null) return data.Total;
  if (typeof data === 'object' && Array.isArray(data.Data)) return data.Data.length;
  if (Array.isArray(data)) return data.length;
  return 0;
}

// ---------------------------------------------------------------------------
// Probe a single facility
// ---------------------------------------------------------------------------
async function probeFacility(stateKey, config, facility) {
  const license = facility.License?.Number || facility.LicenseNumber || facility.License || '';
  const name = facility.Name || facility.FacilityName || '';
  const facilityType = facility.FacilityType?.Name || facility.FacilityTypeName || facility.License?.Type || '';

  const result = {
    name,
    license,
    facilityType,
    state: stateKey,
    capabilities: {
      canGrow: false,
      canHarvest: false,
      canPackage: false,
      canSell: false,
      canTransfer: false,
      canTest: false,
    },
    locationTypes: [],
    tagCounts: { plant: 0, package: 0 },
    existingData: {
      plants: 0,
      harvests: 0,
      packages: 0,
      sales: 0,
      transfersIncoming: 0,
      transfersOutgoing: 0,
      locations: 0,
    },
    errors: [],
  };

  const { baseUrl, vendorKey, userKey } = config;
  const probeParams = { licenseNumber: license, page: '1', pageSize: '1' };

  // Helper: probe an endpoint and record the result
  async function probeEndpoint(label, path, capKey, dataKey) {
    await sleep(INTER_REQUEST_DELAY_MS);
    const res = await metrcProbe(baseUrl, vendorKey, userKey, path, probeParams);
    if (res.ok) {
      if (capKey) result.capabilities[capKey] = true;
      if (dataKey) result.existingData[dataKey] = extractCount(res.data);
    } else {
      result.errors.push(`${label}: ${res.error}`);
    }
    return res;
  }

  // Plants
  await probeEndpoint('Plants', '/plants/v2/active', 'canGrow', 'plants');

  // Harvests
  await probeEndpoint('Harvests', '/harvests/v2/active', 'canHarvest', 'harvests');

  // Packages
  await probeEndpoint('Packages', '/packages/v2/active', 'canPackage', 'packages');

  // Sales
  await probeEndpoint('Sales', '/sales/v2/receipts/active', 'canSell', 'sales');

  // Transfers incoming
  await probeEndpoint('Transfers Incoming', '/transfers/v2/incoming', 'canTransfer', 'transfersIncoming');

  // Transfers outgoing
  await probeEndpoint('Transfers Outgoing', '/transfers/v2/outgoing', null, 'transfersOutgoing');

  // Lab Tests (general availability — uses /labtests/v2/states, no license needed)
  await sleep(INTER_REQUEST_DELAY_MS);
  const labRes = await metrcProbe(baseUrl, vendorKey, userKey, '/labtests/v2/states', {});
  if (labRes.ok) {
    result.capabilities.canTest = true;
  } else {
    // Fallback: try /labtests/v2/types with license
    await sleep(INTER_REQUEST_DELAY_MS);
    const labTypesRes = await metrcProbe(baseUrl, vendorKey, userKey, '/labtests/v2/types', { licenseNumber: license });
    if (labTypesRes.ok) {
      result.capabilities.canTest = true;
    } else {
      result.errors.push(`Lab Tests: ${labRes.error}`);
    }
  }

  // Locations
  await probeEndpoint('Locations', '/locations/v2/active', null, 'locations');

  // Location types (collect names)
  await sleep(INTER_REQUEST_DELAY_MS);
  const locTypesRes = await metrcProbe(baseUrl, vendorKey, userKey, '/locations/v2/types', { licenseNumber: license });
  if (locTypesRes.ok) {
    const types = locTypesRes.data?.Data || locTypesRes.data || [];
    if (Array.isArray(types)) {
      result.locationTypes = types.map((t) => t.Name).filter(Boolean);
    }
  } else {
    result.errors.push(`Location Types: ${locTypesRes.error}`);
  }

  // Plant tags
  await sleep(INTER_REQUEST_DELAY_MS);
  const plantTagRes = await metrcProbe(baseUrl, vendorKey, userKey, '/tags/v2/plant/available', { licenseNumber: license, page: '1', pageSize: '1' });
  if (plantTagRes.ok) {
    result.tagCounts.plant = extractCount(plantTagRes.data);
  } else {
    result.errors.push(`Plant Tags: ${plantTagRes.error}`);
  }

  // Package tags
  await sleep(INTER_REQUEST_DELAY_MS);
  const pkgTagRes = await metrcProbe(baseUrl, vendorKey, userKey, '/tags/v2/package/available', { licenseNumber: license, page: '1', pageSize: '1' });
  if (pkgTagRes.ok) {
    result.tagCounts.package = extractCount(pkgTagRes.data);
  } else {
    result.errors.push(`Package Tags: ${pkgTagRes.error}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Format console summary
// ---------------------------------------------------------------------------
function printSummary(results) {
  console.log('\n' + '='.repeat(120));
  console.log('METRC Sandbox Facility Capabilities Summary');
  console.log('='.repeat(120));

  // Table header
  const cols = [
    { key: 'state', label: 'State', width: 5 },
    { key: 'license', label: 'License', width: 22 },
    { key: 'name', label: 'Facility Name', width: 28 },
    { key: 'facilityType', label: 'Type', width: 16 },
    { key: 'canGrow', label: 'Grow', width: 5 },
    { key: 'canHarvest', label: 'Harv', width: 5 },
    { key: 'canPackage', label: 'Pkg', width: 5 },
    { key: 'canSell', label: 'Sell', width: 5 },
    { key: 'canTransfer', label: 'Xfer', width: 5 },
    { key: 'canTest', label: 'Test', width: 5 },
    { key: 'plantTags', label: 'PTags', width: 6 },
    { key: 'pkgTags', label: 'KTags', width: 6 },
  ];

  const header = cols.map((c) => c.label.padEnd(c.width)).join(' | ');
  const separator = cols.map((c) => '-'.repeat(c.width)).join('-+-');
  console.log(header);
  console.log(separator);

  for (const r of results) {
    const cap = (val) => (val ? 'Y' : '-');
    const row = {
      state: r.state,
      license: r.license,
      name: r.name,
      facilityType: r.facilityType,
      canGrow: cap(r.capabilities.canGrow),
      canHarvest: cap(r.capabilities.canHarvest),
      canPackage: cap(r.capabilities.canPackage),
      canSell: cap(r.capabilities.canSell),
      canTransfer: cap(r.capabilities.canTransfer),
      canTest: cap(r.capabilities.canTest),
      plantTags: String(r.tagCounts.plant),
      pkgTags: String(r.tagCounts.package),
    };
    const line = cols.map((c) => {
      const val = row[c.key] || '';
      return val.length > c.width ? val.slice(0, c.width - 1) + '.' : val.padEnd(c.width);
    }).join(' | ');
    console.log(line);
  }

  console.log(separator);

  // Existing data counts
  console.log('\nExisting Data Counts:');
  const dataCols = [
    { key: 'state', label: 'State', width: 5 },
    { key: 'license', label: 'License', width: 22 },
    { key: 'plants', label: 'Plants', width: 7 },
    { key: 'harvests', label: 'Harvests', width: 8 },
    { key: 'packages', label: 'Packages', width: 8 },
    { key: 'sales', label: 'Sales', width: 7 },
    { key: 'xferIn', label: 'XferIn', width: 7 },
    { key: 'xferOut', label: 'XferOut', width: 7 },
    { key: 'locations', label: 'Locs', width: 6 },
  ];
  const dHeader = dataCols.map((c) => c.label.padEnd(c.width)).join(' | ');
  const dSep = dataCols.map((c) => '-'.repeat(c.width)).join('-+-');
  console.log(dHeader);
  console.log(dSep);

  for (const r of results) {
    const dRow = {
      state: r.state,
      license: r.license,
      plants: String(r.existingData.plants),
      harvests: String(r.existingData.harvests),
      packages: String(r.existingData.packages),
      sales: String(r.existingData.sales),
      xferIn: String(r.existingData.transfersIncoming),
      xferOut: String(r.existingData.transfersOutgoing),
      locations: String(r.existingData.locations),
    };
    const dLine = dataCols.map((c) => {
      const val = dRow[c.key] || '';
      return val.length > c.width ? val.slice(0, c.width - 1) + '.' : val.padEnd(c.width);
    }).join(' | ');
    console.log(dLine);
  }

  console.log(dSep);

  // Location types per facility
  console.log('\nLocation Types:');
  for (const r of results) {
    if (r.locationTypes.length > 0) {
      console.log(`  ${r.state} ${r.license}: ${r.locationTypes.join(', ')}`);
    }
  }

  // Errors
  const withErrors = results.filter((r) => r.errors.length > 0);
  if (withErrors.length > 0) {
    console.log('\nErrors Encountered:');
    for (const r of withErrors) {
      console.log(`  ${r.state} ${r.license} (${r.name}):`);
      for (const err of r.errors) {
        console.log(`    - ${err}`);
      }
    }
  }

  console.log('\n' + '='.repeat(120));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { stateFilter } = parseArgs();

  const statesToProbe = stateFilter === 'ALL'
    ? Object.keys(STATE_CONFIG)
    : [stateFilter];

  // Validate credentials
  for (const stateKey of statesToProbe) {
    const config = STATE_CONFIG[stateKey];
    if (!config.vendorKey || !config.userKey) {
      console.error(`Missing credentials for ${config.label} (${stateKey}).`);
      if (stateKey === 'CO') {
        console.error('  Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env');
      }
      process.exit(1);
    }
  }

  const allResults = [];

  for (const stateKey of statesToProbe) {
    const config = STATE_CONFIG[stateKey];
    console.log(`\n--- Probing ${config.label} (${config.baseUrl}) ---`);

    // Step 1: List all facilities
    const facilitiesRes = await metrcProbe(config.baseUrl, config.vendorKey, config.userKey, '/facilities/v2/');
    if (!facilitiesRes.ok) {
      console.error(`  Failed to list facilities for ${stateKey}: ${facilitiesRes.error}`);
      continue;
    }

    const facilities = facilitiesRes.data?.Data || facilitiesRes.data || [];
    if (!Array.isArray(facilities) || facilities.length === 0) {
      console.log(`  No facilities found for ${stateKey}.`);
      continue;
    }

    console.log(`  Found ${facilities.length} facilities.`);

    // Step 2: Probe each facility
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      const license = facility.License?.Number || facility.LicenseNumber || facility.License || '';
      const name = facility.Name || facility.FacilityName || '';
      console.log(`  [${i + 1}/${facilities.length}] Probing: ${name} (${license})`);

      const result = await probeFacility(stateKey, config, facility);
      allResults.push(result);

      // Log capabilities inline
      const caps = result.capabilities;
      const capStr = Object.entries(caps)
        .filter(([, v]) => v)
        .map(([k]) => k.replace('can', ''))
        .join(', ');
      console.log(`    Capabilities: ${capStr || 'none detected'}`);
      console.log(`    Tags: plant=${result.tagCounts.plant}, package=${result.tagCounts.package}`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`);
      }
    }
  }

  if (allResults.length === 0) {
    console.error('\nNo facilities probed. Exiting.');
    process.exit(1);
  }

  // Step 3: Write JSON output
  const outputPath = join(__dirname, 'facility-capabilities.json');
  const output = {
    generatedAt: new Date().toISOString(),
    statesProbed: statesToProbe,
    totalFacilities: allResults.length,
    facilities: allResults,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`\nJSON written to: ${outputPath}`);

  // Step 4: Print summary table
  printSummary(allResults);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
