#!/usr/bin/env node
/**
 * METRC Sandbox Demo Seeder — Orchestrator
 *
 * Seeds METRC sandbox facilities with demo data for compelling demo workflows.
 * Runs seeders in dependency order: cultivator -> lab packages -> lab tests ->
 * transfers -> dispensary packages -> dispensary sales.
 *
 * Usage:
 *   node scripts/seed-demo.mjs                 # Seed both CO and MA
 *   node scripts/seed-demo.mjs --state CO      # Colorado only
 *   node scripts/seed-demo.mjs --state MA      # Massachusetts only
 *
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY (Colorado).
 * Massachusetts sandbox credentials are hardcoded.
 *
 * Known limitations (Feb 2026, confirmed by API probing):
 *   - Metrc has NO API to accept/receive incoming transfers. External incoming
 *     transfers create manifests but packages remain "pending receipt".
 *   - Only MA-8 (Research Facility) has BOTH CanGrowPlants + CanTestPackages,
 *     enabling the mini-cultivator → lab test pipeline. CO labs cannot create
 *     active packages programmatically.
 *   - No dispensary facility has CanGrowPlants or CanCreateOpeningBalancePackages.
 *     Dispensary sales cannot be seeded via the API.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createMetrcFetch, loadEnvFile, getStateConfig } from './lib/metrc-fetch.mjs';
import { seedCultivator } from './seeders/cultivator.mjs';
import { seedLab } from './seeders/lab.mjs';
import { seedTransfers } from './seeders/transfer.mjs';
import { seedDispensary } from './seeders/dispensary.mjs';
import { seedPackagesAtFacility } from './seeders/package-seeder.mjs';
import { seedActivity } from './seeders/activity.mjs';

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
    // CO-1 (Accelerator) deliberately excluded — crippled categories, no ForPlants location types.
    // CO-21/CO-24 (Retail) have full category support, ForPlants locations, and transfer types.
    // CO-25 (Retail Testing Lab) has CanTestPackages=true + CanTransferFromExternalFacilities=true.
    //
    // Confirmed by Metrc support (case #02372700) + API probing (Feb 2026):
    //   - Standalone packages require CanCreateOpeningBalancePackages (no CO Retail facility has this).
    //   - Transfers are template-only: POST /transfers/v2/templates/outgoing.
    //   - External incoming transfers (POST /transfers/v2/external/incoming) create manifests
    //     but packages stay in "pending receipt" — NO receive/accept API exists.
    //   - Lab tests require CanTestPackages=true (testing labs only).
    //   - CO lab tests BLOCKED: no way to get active packages at CO-25 (external incoming
    //     creates manifests, standalone fails, can't grow plants).
    //   - CO dispensary sales BLOCKED: no way to get active packages at CO-24.
    cultivators: [
      'SF-SBX-CO-21-8002',  // Retail Cultivation (primary — has most data)
      'SF-SBX-CO-7-8002',   // Medical Marijuana Cultivation
      'SF-SBX-CO-19-8002',  // OPC
      'SF-SBX-CO-20-8002',  // R&D Cultivation
    ],
    // CO-1 Accelerator deliberately excluded — crippled categories, no ForPlants location types
    lab: 'SF-SBX-CO-25-8002',
    manufacturer: 'SF-SBX-CO-22-8002',
    dispensary: 'SF-SBX-CO-24-8002',
  },
  MA: {
    // MA-4 (Cultivator): Standard cultivator with full grow pipeline.
    // MA-8 (Research Facility): BOTH CanGrowPlants + CanTestPackages — the ONLY facility
    //   where packages can be created AND tested via the API. Uses mini-cultivator pipeline
    //   to create local packages, then records lab tests on them.
    // MA-9 (Retailer): CanSellToConsumers but no CanGrowPlants or CanCreateOpeningBalancePackages.
    //   Dispensary sales BLOCKED: no way to get active packages.
    cultivators: [
      'SF-SBX-MA-4-3301',   // Marijuana Cultivator (primary)
      'SF-SBX-MA-1-3301',   // Craft Marijuana Cooperative
      'SF-SBX-MA-6-3301',   // Marijuana Microbusiness
      'SF-SBX-MA-12-3301',  // Medical Marijuana Cultivator
      'SF-SBX-MA-15-3301',  // Microbusiness Delivery
    ],
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
      return facilities.map((f) => {
        const ft = f.FacilityType || {};
        return {
          name: f.Name || f.FacilityName || '',
          license: f.License?.Number || f.LicenseNumber || f.License || '',
          type: classifyFacilityType(ft) || ft.Name || f.FacilityTypeName || '',
          canTestPackages: ft.CanTestPackages === true,
          canGrowPlants: ft.CanGrowPlants === true,
          canTransferFromExternal: ft.CanTransferFromExternalFacilities === true,
          canCreateOpeningBalancePackages: ft.CanCreateOpeningBalancePackages === true,
        };
      });
    }
  } catch (e) {
    console.error('  Failed to list facilities:', e.message?.slice(0, 80));
  }
  return [];
}

/**
 * Classify facility type from METRC FacilityType flags.
 * Mirrors classifyFacility() from formul8-metrc-platform/scripts/seed-sandbox.ts.
 */
function classifyFacilityType(ft) {
  if (!ft || typeof ft !== 'object') return '';
  // Check CanTestPackages first — research facilities can have both CanGrowPlants and CanTestPackages
  if (ft.CanTestPackages) return 'Testing Lab';
  if (ft.CanGrowPlants) return 'Cultivator';
  if (ft.CanInfuseProducts) return 'Manufacturer';
  if (ft.CanSellToConsumers) return 'Dispensary';
  return '';
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

  // --- Cultivators ---
  const cultivators = facilityMap.cultivators || (facilityMap.cultivator ? [facilityMap.cultivator] : []);
  for (let ci = 0; ci < cultivators.length; ci++) {
    const cultivatorLicense = cultivators[ci];
    const label = cultivators.length > 1 ? `cultivator_${ci}` : 'cultivator';
    console.log(`\n--- Cultivator ${ci + 1}/${cultivators.length}: ${cultivatorLicense} ---`);
    try {
      results.seeders[label] = await seedCultivator(api, cultivatorLicense, runId);
    } catch (e) {
      console.error(`  Cultivator seeder failed: ${e.message}`);
      results.seeders[label] = { error: e.message };
    }
  }

  // --- Seed Packages at Lab ---
  // The lab needs active packages before it can record test results.
  // Packages don't arrive automatically — Metrc has NO API to accept/receive transfers.
  // Use the package seeder to try: external incoming → standalone → mini-cultivator.
  if (facilityMap.lab) {
    const labFacility = facilities.find((f) => f.license === facilityMap.lab);
    console.log(`\n--- Seed Packages at Lab: ${facilityMap.lab} ---`);
    try {
      results.seeders.labPackages = await seedPackagesAtFacility(api, facilityMap.lab, runId, {
        canTransferFromExternal: labFacility?.canTransferFromExternal ?? false,
        canGrowPlants: labFacility?.canGrowPlants ?? false,
        shipperLicense: cultivators[0],
        targetCount: 4,
      });
    } catch (e) {
      console.error(`  Lab package seeder failed: ${e.message}`);
      results.seeders.labPackages = { error: e.message };
    }
  }

  // --- Lab ---
  // Only lab/testing facilities can call POST /labtests/v2/record.
  // Pass facility type info so the seeder can guard appropriately.
  if (facilityMap.lab) {
    const labFacility = facilities.find((f) => f.license === facilityMap.lab);
    console.log(`\n--- Lab: ${facilityMap.lab} ---`);
    try {
      results.seeders.lab = await seedLab(api, facilityMap.lab, runId, {
        facilityType: labFacility?.type || 'Testing Lab',
        canTestPackages: labFacility?.canTestPackages ?? true,
      });
    } catch (e) {
      console.error(`  Lab seeder failed: ${e.message}`);
      results.seeders.lab = { error: e.message };
    }
  }

  // NOTE: Lab-on-cultivator fallback removed (Feb 2026).
  // Metrc support confirmed (case #02372700) that only facilities with
  // CanTestPackages=true can call POST /labtests/v2/record. Running the lab
  // seeder on a cultivator will always fail with HTTP 401.
  if (cultivators[0] && !facilityMap.lab) {
    console.log('\n--- Lab (on cultivator): SKIPPED ---');
    console.log('  Cultivator facilities cannot record lab tests (CanTestPackages=false).');
    console.log('  Add a Testing Lab facility to FACILITY_MAP to enable lab seeding.');
    results.seeders.lab = { tested: 0, passed: 0, failed: 0, skipped: 0 };
  }

  // --- Transfers (each cultivator -> lab, each cultivator -> dispensary) ---
  // Create outgoing transfer templates for demo activity. These are template
  // records only — Metrc has no API to accept/receive them (confirmed case #02372700).
  for (let ci = 0; ci < cultivators.length; ci++) {
    const cultivatorLicense = cultivators[ci];
    if (facilityMap.lab) {
      console.log(`\n--- Transfers: ${cultivatorLicense} -> ${facilityMap.lab} (lab) ---`);
      try {
        results.seeders[`transfersToLab_${ci}`] = await seedTransfers(api, cultivatorLicense, facilityMap.lab, runId);
      } catch (e) {
        console.error(`  Transfer (to lab) failed: ${e.message}`);
        results.seeders[`transfersToLab_${ci}`] = { error: e.message };
      }
    }
    if (facilityMap.dispensary) {
      console.log(`\n--- Transfers: ${cultivatorLicense} -> ${facilityMap.dispensary} ---`);
      try {
        results.seeders[`transfers_${ci}`] = await seedTransfers(api, cultivatorLicense, facilityMap.dispensary, runId);
      } catch (e) {
        console.error(`  Transfer failed: ${e.message}`);
        results.seeders[`transfers_${ci}`] = { error: e.message };
      }
    }
  }

  // --- Seed Packages at Dispensary ---
  // The dispensary needs active packages before it can create sales.
  // Same multi-strategy approach as the lab.
  if (facilityMap.dispensary) {
    const dispFacility = facilities.find((f) => f.license === facilityMap.dispensary);
    console.log(`\n--- Seed Packages at Dispensary: ${facilityMap.dispensary} ---`);
    try {
      results.seeders.dispensaryPackages = await seedPackagesAtFacility(api, facilityMap.dispensary, runId, {
        canTransferFromExternal: dispFacility?.canTransferFromExternal ?? false,
        canGrowPlants: dispFacility?.canGrowPlants ?? false,
        shipperLicense: cultivators[0],
        targetCount: 6,
      });
    } catch (e) {
      console.error(`  Dispensary package seeder failed: ${e.message}`);
      results.seeders.dispensaryPackages = { error: e.message };
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

  // --- Activity Simulator ---
  // Run on all cultivators
  for (let ci = 0; ci < cultivators.length; ci++) {
    const cultivatorLicense = cultivators[ci];
    const facility = facilities.find((f) => f.license === cultivatorLicense);
    console.log(`\n--- Activity: ${cultivatorLicense} (cultivator ${ci}) ---`);
    try {
      results.seeders[`activity_cultivator_${ci}`] = await seedActivity(api, cultivatorLicense, runId, {
        facilityType: facility?.type || 'Cultivator',
        canGrowPlants: facility?.canGrowPlants ?? true,
        hasLabTests: false,
      });
    } catch (e) {
      console.error(`  Activity seeder failed: ${e.message}`);
      results.seeders[`activity_cultivator_${ci}`] = { error: e.message };
    }
  }
  // Run on lab and dispensary (non-cultivator facilities)
  for (const role of ['lab', 'dispensary']) {
    const facilityLicense = facilityMap[role];
    if (!facilityLicense) continue;
    const facility = facilities.find((f) => f.license === facilityLicense);
    console.log(`\n--- Activity: ${facilityLicense} (${role}) ---`);
    try {
      results.seeders[`activity_${role}`] = await seedActivity(api, facilityLicense, runId, {
        facilityType: facility?.type || role,
        canGrowPlants: facility?.canGrowPlants ?? false,
        hasLabTests: role === 'lab',
      });
    } catch (e) {
      console.error(`  Activity seeder failed: ${e.message}`);
      results.seeders[`activity_${role}`] = { error: e.message };
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

  // Print known limitations
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  KNOWN METRC SANDBOX LIMITATIONS (Feb 2026)');
  console.log('─'.repeat(60));
  console.log('  - No API to accept/receive incoming transfers.');
  console.log('    Packages created via external incoming stay in "pending receipt".');
  console.log('    Metrc has no receive/accept endpoint (probed 10+ variations, all 404).');
  console.log('  - Lab packages: Only MA-8 (Research, CanGrowPlants+CanTestPackages)');
  console.log('    can create AND test its own packages via mini-cultivator pipeline.');
  console.log('    CO labs (CO-25/CO-11) cannot create active packages programmatically.');
  console.log('  - Dispensary packages: No dispensary has CanGrowPlants or');
  console.log('    CanCreateOpeningBalancePackages. Sales cannot be seeded.');
  console.log('  - Transfer templates are created but remain in template state only.');
  console.log('='.repeat(60));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
