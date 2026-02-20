#!/usr/bin/env node
/**
 * METRC Sandbox Demo Seeder — Orchestrator
 *
 * Seeds METRC sandbox facilities with demo data for compelling demo workflows.
 * Runs seeders in dependency order: cultivator -> lab -> dispensary.
 *
 * Usage:
 *   node scripts/seed-demo.mjs                 # Seed both CO and MA
 *   node scripts/seed-demo.mjs --state CO      # Colorado only
 *   node scripts/seed-demo.mjs --state MA      # Massachusetts only
 *
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY (Colorado).
 * Massachusetts sandbox credentials are hardcoded.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createMetrcFetch, loadEnvFile, getStateConfig } from './lib/metrc-fetch.mjs';
import { seedCultivator } from './seeders/cultivator.mjs';
import { seedLab } from './seeders/lab.mjs';
import { seedTransfers } from './seeders/transfer.mjs';
import { seedDispensary } from './seeders/dispensary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load .env
loadEnvFile(join(root, '.env'));

// ---------------------------------------------------------------------------
// Facility configuration per state
// ---------------------------------------------------------------------------
// These are the standard sandbox facility license numbers.
// If the sandbox has been reset or has different licenses, the seeders
// will log errors and continue gracefully.
const FACILITY_MAP = {
  CO: {
    // CO-1/CO-3 (Accelerator) have crippled categories and no ForPlants location types.
    // CO-21/CO-24 (Retail) have full category support, ForPlants locations, and transfer types.
    // CO-25 (Retail Testing Lab) can record lab tests but needs packages at the lab.
    // Note: CO sandbox has broken standalone package creation and transfer endpoints
    // (server errors). Only harvest-based package flow on CO-21 works reliably.
    cultivator: 'SF-SBX-CO-21-8002',
    lab: 'SF-SBX-CO-25-8002',
    manufacturer: 'SF-SBX-CO-22-8002',
    dispensary: 'SF-SBX-CO-24-8002',
  },
  MA: {
    cultivator: 'SF-SBX-MA-4-3301',
    lab: 'SF-SBX-MA-8-3301',
    dispensary: 'SF-SBX-MA-9-3301',
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
// Discover facilities dynamically
// ---------------------------------------------------------------------------
async function discoverFacilities(api) {
  try {
    const resp = await api('/facilities/v2/');
    const facilities = resp?.Data || resp || [];
    if (Array.isArray(facilities)) {
      return facilities.map((f) => ({
        name: f.Name || f.FacilityName || '',
        license: f.License?.Number || f.LicenseNumber || f.License || '',
        type: f.FacilityType?.Name || f.FacilityTypeName || '',
      }));
    }
  } catch (e) {
    console.error('  Failed to list facilities:', e.message?.slice(0, 80));
  }
  return [];
}

// ---------------------------------------------------------------------------
// Run seeders for a single state
// ---------------------------------------------------------------------------
async function seedState(stateKey, config, runId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Seeding ${config.label} (${stateKey})`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Run ID:   ${runId}`);
  console.log('='.repeat(60));

  const api = createMetrcFetch(config);
  const results = { state: stateKey, facilities: [], seeders: {} };

  // Discover available facilities
  const facilities = await discoverFacilities(api);
  results.facilities = facilities;
  if (facilities.length > 0) {
    console.log(`\n  Found ${facilities.length} facilities:`);
    for (const f of facilities) {
      console.log(`    ${f.license} — ${f.name} (${f.type})`);
    }
  } else {
    console.log('\n  No facilities found. Sandbox may need setup.');
  }

  // Optional: run sandbox setup
  try {
    await api('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
    console.log('  Sandbox setup: OK');
  } catch (_) {
    // Sandbox setup is optional and may 404
  }

  const facilityMap = FACILITY_MAP[stateKey] || {};

  // --- Cultivator ---
  if (facilityMap.cultivator) {
    console.log(`\n--- Cultivator: ${facilityMap.cultivator} ---`);
    try {
      results.seeders.cultivator = await seedCultivator(api, facilityMap.cultivator, runId);
    } catch (e) {
      console.error(`  Cultivator seeder failed: ${e.message}`);
      results.seeders.cultivator = { error: e.message };
    }
  }

  // --- Lab ---
  if (facilityMap.lab) {
    console.log(`\n--- Lab: ${facilityMap.lab} ---`);
    try {
      results.seeders.lab = await seedLab(api, facilityMap.lab, runId);
    } catch (e) {
      console.error(`  Lab seeder failed: ${e.message}`);
      results.seeders.lab = { error: e.message };
    }
  }

  // --- Lab on cultivator packages (CO has no dedicated lab facility) ---
  if (facilityMap.cultivator && !facilityMap.lab) {
    console.log(`\n--- Lab (on cultivator): ${facilityMap.cultivator} ---`);
    try {
      results.seeders.lab = await seedLab(api, facilityMap.cultivator, runId);
    } catch (e) {
      console.error(`  Lab seeder failed: ${e.message}`);
      results.seeders.lab = { error: e.message };
    }
  }

  // --- Transfers (cultivator -> dispensary) ---
  if (facilityMap.cultivator && facilityMap.dispensary) {
    console.log(`\n--- Transfers: ${facilityMap.cultivator} -> ${facilityMap.dispensary} ---`);
    try {
      results.seeders.transfers = await seedTransfers(api, facilityMap.cultivator, facilityMap.dispensary, runId);
    } catch (e) {
      console.error(`  Transfer seeder failed: ${e.message}`);
      results.seeders.transfers = { error: e.message };
    }
  }

  // --- Dispensary ---
  if (facilityMap.dispensary) {
    console.log(`\n--- Dispensary: ${facilityMap.dispensary} ---`);
    try {
      results.seeders.dispensary = await seedDispensary(api, facilityMap.dispensary, runId);
    } catch (e) {
      console.error(`  Dispensary seeder failed: ${e.message}`);
      results.seeders.dispensary = { error: e.message };
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { stateFilter } = parseArgs();
  const stateConfig = getStateConfig();
  const runId = `d${Date.now().toString(36)}`;
  const startTime = Date.now();

  console.log('METRC Sandbox Demo Seeder');
  console.log(`  Run ID: ${runId}`);
  console.log(`  State:  ${stateFilter}`);
  console.log(`  Date:   ${new Date().toISOString().slice(0, 10)}`);

  const statesToSeed = stateFilter === 'ALL'
    ? Object.keys(stateConfig)
    : [stateFilter];

  // Validate credentials
  for (const stateKey of statesToSeed) {
    const cfg = stateConfig[stateKey];
    if (!cfg.vendorKey || !cfg.userKey) {
      console.error(`\nMissing credentials for ${cfg.label} (${stateKey}).`);
      if (stateKey === 'CO') {
        console.error('  Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env');
      }
      process.exit(1);
    }
  }

  const allResults = [];

  for (const stateKey of statesToSeed) {
    const cfg = stateConfig[stateKey];
    const result = await seedState(stateKey, cfg, runId);
    allResults.push(result);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Write run metadata
  const metadata = {
    runId,
    timestamp: new Date().toISOString(),
    statesSeeded: statesToSeed,
    elapsedSeconds: parseFloat(elapsed),
    results: allResults,
  };

  const metadataPath = join(__dirname, '.last-seed.json');
  try {
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  } catch (_) {
    // Non-fatal: metadata file write failure
  }

  // Print final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Run ID:   ${runId}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  States:   ${statesToSeed.join(', ')}`);

  for (const result of allResults) {
    console.log(`\n  ${result.state}:`);
    for (const [seeder, summary] of Object.entries(result.seeders)) {
      if (summary.error) {
        console.log(`    ${seeder}: FAILED (${summary.error.slice(0, 60)})`);
      } else {
        const counts = Object.entries(summary)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        console.log(`    ${seeder}: ${counts || 'no entities created'}`);
      }
    }
  }

  console.log(`\n  Metadata: ${metadataPath}`);
  console.log('='.repeat(60));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
