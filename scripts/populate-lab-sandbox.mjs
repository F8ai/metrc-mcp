#!/usr/bin/env node
/**
 * Populate METRC sandbox with lab test data (Massachusetts).
 *
 * Uses a facility that has BOTH CanGrowPlants AND CanTestPackages
 * (e.g. SF-SBX-MA-8-3401 Research Facility) so the entire lifecycle
 * runs on a single license — no inter-facility transfers needed.
 *
 * Flow: strains → plant batches → flowering → harvest → packages → lab test results
 *
 * Usage:
 *   METRC_API_URL=https://sandbox-api-ma.metrc.com \
 *   METRC_VENDOR_API_KEY=... METRC_USER_API_KEY=... \
 *   METRC_LICENSE=SF-SBX-MA-8-3401 \
 *   node scripts/populate-lab-sandbox.mjs
 */

import { metrcFetch, LICENSE, hasCredentials } from './lib/metrc-fetch.mjs';

const today = new Date().toISOString().slice(0, 10);
const TS = Date.now(); // timestamp for unique batch names
const log = (msg, data) =>
  data !== undefined
    ? console.log(msg, typeof data === 'object' ? JSON.stringify(data).slice(0, 250) : data)
    : console.log(msg);

const FACILITY = LICENSE;
const NUM_PACKAGES = 12;

// ── Lab test result profiles using MA "Raw Plant Material" test type names ──
const LAB_TEST_PROFILES = [
  {
    label: 'pass-clean',
    overallPassed: true,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 22.5 },
      { name: 'Total CBD (%) Raw Plant Material', value: 0.8 },
      { name: 'THC (%) Raw Plant Material', value: 2.1 },
      { name: 'THCA (%) Raw Plant Material', value: 22.3 },
      { name: 'CBD (%) Raw Plant Material', value: 0.1 },
      { name: 'CBDA (%) Raw Plant Material', value: 0.75 },
      { name: 'CBG (%) Raw Plant Material', value: 0.3 },
      { name: 'CBN (%) Raw Plant Material', value: 0.05 },
      { name: 'Total Cannabinoids (%) Raw Plant Material', value: 24.1 },
      { name: 'Total Terpenes (%) Raw Plant Material', value: 3.2 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 10.5 },
      { name: 'Water Activity (Aw) Raw Plant Material', value: 0.55 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 0 },
      { name: 'Cadmium (ppm) Raw Plant Material', value: 0 },
      { name: 'Lead (ppm) Raw Plant Material', value: 0 },
      { name: 'Mercury (ppm) Raw Plant Material', value: 0 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 500 },
      { name: 'Total Viable Aerobic Bacteria (CFU/g) Raw Plant Material', value: 1000 },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 0 },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
  {
    label: 'pass-highcbd',
    overallPassed: true,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 5.2 },
      { name: 'Total CBD (%) Raw Plant Material', value: 14.8 },
      { name: 'THC (%) Raw Plant Material', value: 0.5 },
      { name: 'THCA (%) Raw Plant Material', value: 5.1 },
      { name: 'CBD (%) Raw Plant Material', value: 1.2 },
      { name: 'CBDA (%) Raw Plant Material', value: 14.5 },
      { name: 'Total Cannabinoids (%) Raw Plant Material', value: 21.0 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 11.0 },
      { name: 'Water Activity (Aw) Raw Plant Material', value: 0.58 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 0 },
      { name: 'Cadmium (ppm) Raw Plant Material', value: 0 },
      { name: 'Lead (ppm) Raw Plant Material', value: 0 },
      { name: 'Mercury (ppm) Raw Plant Material', value: 0 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 200 },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 0 },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
  {
    label: 'fail-metals',
    overallPassed: false,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 18.3 },
      { name: 'Total CBD (%) Raw Plant Material', value: 0.4 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 12.1 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 2.5, passed: false },
      { name: 'Cadmium (ppm) Raw Plant Material', value: 1.8, passed: false },
      { name: 'Lead (ppm) Raw Plant Material', value: 3.2, passed: false },
      { name: 'Mercury (ppm) Raw Plant Material', value: 0.01 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 300 },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 0 },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
  {
    label: 'fail-micro',
    overallPassed: false,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 25.1 },
      { name: 'Total CBD (%) Raw Plant Material', value: 0.2 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 14.5 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 0 },
      { name: 'Lead (ppm) Raw Plant Material', value: 0 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 50000, passed: false },
      { name: 'Total Viable Aerobic Bacteria (CFU/g) Raw Plant Material', value: 100000, passed: false },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 150, passed: false },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
];

async function main() {
  if (!hasCredentials()) {
    console.error('Missing METRC credentials. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY.');
    process.exit(1);
  }
  log('Facility:', FACILITY);
  log('Date:', today, '| Timestamp:', TS);

  // ── Sandbox setup (optional, may 404) ──
  try {
    await metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
    log('Sandbox setup OK');
  } catch (_) {}

  // ── Step 1: Strains ──
  log('\n--- Step 1: Strains ---');
  let strains = (await metrcFetch('/strains/v2/active', { licenseNumber: FACILITY })).Data || [];
  const existingNames = new Set(strains.map((s) => s.Name));
  for (let i = 1; i <= 12; i++) {
    const name = `SBX Strain ${i}`;
    if (existingNames.has(name)) continue;
    try {
      await metrcFetch('/strains/v2/', { licenseNumber: FACILITY }, {
        method: 'POST',
        body: [{ Name: name, IndicaPercentage: 30 + ((i - 1) * 3) % 41, SativaPercentage: 70 - ((i - 1) * 3) % 41 }],
      });
      log('  Created strain:', name);
    } catch (e) {
      log('  Strain:', e.message?.slice(0, 80));
    }
  }
  strains = (await metrcFetch('/strains/v2/active', { licenseNumber: FACILITY })).Data || [];
  log('Strains:', strains.length);

  // ── Step 2: Location ──
  log('\n--- Step 2: Location ---');
  let locations = (await metrcFetch('/locations/v2/active', { licenseNumber: FACILITY })).Data || [];
  let plantLoc = locations.find((l) => l.ForPlants) || locations[0];
  if (!plantLoc) {
    const types = (await metrcFetch('/locations/v2/types', { licenseNumber: FACILITY })).Data || [];
    const plantType = types.find((t) => t.ForPlants) || types[0];
    if (plantType) {
      const locName = `Research Lab ${TS}`;
      try {
        await metrcFetch('/locations/v2/', { licenseNumber: FACILITY }, {
          method: 'POST', body: [{ Name: locName, LocationTypeName: plantType.Name }],
        });
      } catch (_) {}
      locations = (await metrcFetch('/locations/v2/active', { licenseNumber: FACILITY })).Data || [];
      plantLoc = locations.find((l) => l.ForPlants) || locations[0];
    }
  }
  const harvestLoc = locations.find((l) => l.ForHarvests) || plantLoc;
  log('Location:', plantLoc?.Name);

  // ── Step 3: Check if we already have enough packages with lab results ──
  let packages = (await metrcFetch('/packages/v2/active', { licenseNumber: FACILITY })).Data || [];
  const needLifecycle = packages.length < NUM_PACKAGES;

  if (!needLifecycle) {
    log('Already have', packages.length, 'packages. Checking lab test state...');
  } else if (!plantLoc || strains.length === 0) {
    log('No location or strains. Cannot create lifecycle.');
    process.exit(1);
  } else {
    // ── Step 4: Plantings ──
    log('\n--- Step 4: Plantings ---');
    const tagsResp = await metrcFetch('/tags/v2/plant/available', { licenseNumber: FACILITY });
    let plantTags = (tagsResp?.Data ?? tagsResp ?? [])
      .map((t) => (typeof t === 'string' ? t : t.Label ?? t))
      .filter(Boolean);
    log('Plant tags available:', plantTags.length);

    // Need at least NUM_PACKAGES tags for plantings + NUM_PACKAGES for growth phase
    const neededTags = NUM_PACKAGES * 2;
    if (plantTags.length < neededTags) {
      log(`Need ${neededTags} plant tags, only have ${plantTags.length}. Will create as many as possible.`);
    }

    const batchTypes = (await metrcFetch('/plantbatches/v2/types', { licenseNumber: FACILITY })).Data || [];
    const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';

    // Split tags: first half for plantings, second half for growth phase changes
    const plantingTags = plantTags.slice(0, NUM_PACKAGES);
    const growthTags = plantTags.slice(NUM_PACKAGES, NUM_PACKAGES * 2);

    let planted = 0;
    for (let i = 0; i < Math.min(NUM_PACKAGES, strains.length, plantingTags.length); i++) {
      const strain = strains[i % strains.length];
      const tag = plantingTags[i];
      const batchName = `Lab-${strain.Name.replace(/\s/g, '-')}-${TS}-${i}`;
      try {
        await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: FACILITY }, {
          method: 'POST',
          body: [{ Name: batchName, Type: seedType, Count: 1, Location: plantLoc.Name, ActualDate: today, PlantLabel: tag, Strain: strain.Name }],
        });
        planted++;
        log(`  Planted: ${strain.Name} [${tag}]`);
      } catch (e) {
        log(`  Planting ${strain.Name}:`, e.message?.slice(0, 120));
      }
    }
    log('Plants created:', planted);

    // ── Step 5: Batch Growth Phase → Flowering ──
    // MA v2 requires: Name, Count, StartingTag, GrowthPhase, GrowthDate, Location
    log('\n--- Step 5: Growth Phase → Flowering ---');
    const batches = (await metrcFetch('/plantbatches/v2/active', { licenseNumber: FACILITY })).Data || [];
    let growthTagIdx = 0;
    let promoted = 0;
    for (const batch of batches) {
      if (growthTagIdx >= growthTags.length) {
        log('  No more growth tags available.');
        break;
      }
      const tag = growthTags[growthTagIdx++];
      try {
        await metrcFetch('/plantbatches/v2/growthphase', { licenseNumber: FACILITY }, {
          method: 'POST',
          body: [{ Name: batch.Name, Count: 1, StartingTag: tag, GrowthPhase: 'Flowering', GrowthDate: today, Location: plantLoc.Name }],
        });
        promoted++;
      } catch (e) {
        log(`  ${batch.Name}:`, e.message?.slice(0, 100));
      }
    }
    log('Promoted to Flowering:', promoted);

    // ── Step 6: Harvest ──
    log('\n--- Step 6: Harvest ---');
    const flowering = (await metrcFetch('/plants/v2/flowering', { licenseNumber: FACILITY })).Data || [];
    if (flowering.length > 0 && harvestLoc) {
      const harvestName = `Lab-Harvest-${TS}`;
      try {
        const body = flowering.map((p) => ({
          HarvestName: harvestName,
          Plant: p.Label,
          Weight: 1,
          UnitOfWeight: 'Ounces',
          DryingLocation: harvestLoc.Name,
          ActualDate: today,
        }));
        await metrcFetch('/plants/v2/harvest', { licenseNumber: FACILITY }, { method: 'PUT', body });
        log('Harvested', flowering.length, 'plants →', harvestName);
      } catch (e) {
        log('Harvest:', e.message?.slice(0, 120));
      }
    } else {
      log('No flowering plants to harvest (', flowering.length, ')');
    }

    // ── Step 7: Ensure a WeightBased item ──
    log('\n--- Step 7: Items ---');
    let items = (await metrcFetch('/items/v2/active', { licenseNumber: FACILITY })).Data || [];
    let budsItem = items.find((i) => i.QuantityType === 'WeightBased' && i.UnitOfMeasureName === 'Ounces')
      || items.find((i) => i.QuantityType === 'WeightBased');
    if (!budsItem && strains.length > 0) {
      try {
        await metrcFetch('/items/v2/', { licenseNumber: FACILITY }, {
          method: 'POST',
          body: [{ Name: `Lab Buds ${TS}`, ItemCategory: 'Buds', UnitOfMeasure: 'Ounces', Strain: strains[0].Name }],
        });
      } catch (_) {}
      items = (await metrcFetch('/items/v2/active', { licenseNumber: FACILITY })).Data || [];
      budsItem = items.find((i) => i.QuantityType === 'WeightBased');
    }
    log('Using item:', budsItem?.Name ?? 'none', '| UoM:', budsItem?.UnitOfMeasureName ?? '?');

    // ── Step 8: Create packages from harvest ──
    log('\n--- Step 8: Packages ---');
    const harvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: FACILITY })).Data || [];
    const pkgTagsResp = await metrcFetch('/tags/v2/package/available', { licenseNumber: FACILITY });
    let pkgTags = (pkgTagsResp?.Data ?? pkgTagsResp ?? [])
      .map((t) => (typeof t === 'string' ? t : t.Label ?? t))
      .filter(Boolean)
      .slice(0, NUM_PACKAGES);

    if (harvests.length > 0 && budsItem && harvestLoc && pkgTags.length >= NUM_PACKAGES) {
      // Distribute evenly across harvests
      const harvest = harvests[0]; // use first active harvest
      try {
        const body = pkgTags.map((Tag) => ({
          HarvestId: harvest.Id,
          HarvestName: harvest.Name,
          Tag,
          Location: harvestLoc.Name,
          Item: budsItem.Name,
          Weight: 1,
          UnitOfWeight: budsItem.UnitOfMeasureName || 'Ounces',
          Ingredients: [{
            HarvestId: harvest.Id,
            HarvestName: harvest.Name,
            Weight: 1,
            UnitOfWeight: budsItem.UnitOfMeasureName || 'Ounces',
          }],
          IsProductionBatch: false,
          ProductRequiresRemediation: false,
          ActualDate: today,
        }));
        await metrcFetch('/harvests/v2/packages', { licenseNumber: FACILITY }, { method: 'POST', body });
        log(`Created ${pkgTags.length} packages from harvest: ${harvest.Name}`);
      } catch (e) {
        log('Package creation:', e.message?.slice(0, 150));
      }
    } else {
      log('Cannot create packages (harvests:', harvests.length,
        '| item:', budsItem?.Name ?? 'none', '| tags:', pkgTags.length, ')');
    }

    packages = (await metrcFetch('/packages/v2/active', { licenseNumber: FACILITY })).Data || [];
    log('Active packages:', packages.length);
  }

  if (packages.length === 0) {
    log('\nNo packages available. Cannot record lab tests.');
    process.exit(1);
  }

  // ── Step 9: Record lab test results ──
  log('\n--- Step 9: Lab Test Results ---');
  let testCount = 0;
  for (let i = 0; i < packages.length && i < NUM_PACKAGES; i++) {
    const pkg = packages[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) continue;

    const profile = LAB_TEST_PROFILES[i % LAB_TEST_PROFILES.length];
    const results = profile.results.map((r) => ({
      LabTestTypeName: r.name,
      Quantity: r.value,
      Passed: r.passed !== undefined ? r.passed : profile.overallPassed,
      Notes: '',
    }));

    try {
      await metrcFetch('/labtests/v2/record', { licenseNumber: FACILITY }, {
        method: 'POST',
        body: [{
          Label: label,
          ResultDate: today,
          Results: results,
          OverallPassed: profile.overallPassed,
        }],
      });
      testCount++;
      log(`  [${profile.label}] ${label}`);
    } catch (e) {
      log(`  ${label} failed:`, e.message?.slice(0, 150));
    }
  }

  // ── Summary ──
  log('\n=== Summary ===');
  log('Facility:', FACILITY);
  log('Strains:', strains.length);
  log('Active packages:', packages.length);
  log('Lab tests recorded:', testCount, '/', Math.min(packages.length, NUM_PACKAGES));
  if (testCount > 0) {
    log('Profiles: pass-clean, pass-highcbd, fail-metals, fail-micro (rotating)');
    log('Add this facility to your metrc-dashboard to view the data.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
