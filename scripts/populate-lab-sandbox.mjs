#!/usr/bin/env node
/**
 * Populate METRC sandbox for a Lab Testing facility (MA).
 *
 * Full realistic workflow:
 *   Phase 1 — Cultivator: plant batches → vegetative → flowering → harvest → packages
 *   Phase 2 — Transfer: cultivator sends packages to lab via testing transfer
 *   Phase 3 — Lab: record lab test results (pass/fail profiles)
 *
 * Usage:
 *   METRC_API_URL=https://sandbox-api-ma.metrc.com \
 *   METRC_VENDOR_API_KEY=... METRC_USER_API_KEY=... \
 *   METRC_LICENSE=SF-SBX-MA-2-3401 \
 *   node scripts/populate-lab-sandbox.mjs
 */

import { metrcFetch, LICENSE, hasCredentials } from './lib/metrc-fetch.mjs';

const now = new Date();
const today = now.toISOString().slice(0, 10);
// Unique run suffix to avoid batch name collisions from prior runs
const RUN_ID = Math.random().toString(36).slice(2, 7);
const log = (msg, data) =>
  data !== undefined
    ? console.log(msg, typeof data === 'object' ? JSON.stringify(data).slice(0, 250) : data)
    : console.log(msg);

const LAB_LICENSE = LICENSE;
const SOURCE_LICENSE = process.env.METRC_SOURCE_LICENSE ||
  LAB_LICENSE.replace(/-\d+-(\d+)$/, '-4-$1');

const NUM_PACKAGES = 12;

// Lab test result profiles (MA Raw Plant Material test type IDs)
const LAB_TEST_PROFILES = [
  {
    label: 'pass-clean',
    overallPassed: true,
    results: [
      { typeId: 1259, value: 22.5 }, // Total THC (%)
      { typeId: 1210, value: 0.8 },  // Total CBD (%)
      { typeId: 1119, value: 2.1 },  // THC (%)
      { typeId: 1131, value: 22.3 }, // THCA (%)
      { typeId: 342, value: 0.1 },   // CBD (%)
      { typeId: 355, value: 0.75 },  // CBDA (%)
      { typeId: 368, value: 0.3 },   // CBG (%)
      { typeId: 393, value: 0.05 },  // CBN (%)
      { typeId: 1198, value: 24.1 }, // Total Cannabinoids (%)
      { typeId: 1247, value: 3.2 },  // Total Terpenes (%)
      { typeId: 864, value: 10.5 },  // Moisture Content (%)
      { typeId: 1346, value: 0.55 }, // Water Activity (Aw)
      { typeId: 186, value: 0 },     // Arsenic (ppm)
      { typeId: 301, value: 0 },     // Cadmium (ppm)
      { typeId: 773, value: 0 },     // Lead (ppm)
      { typeId: 802, value: 0 },     // Mercury (ppm)
      { typeId: 1307, value: 500 },  // Total Yeast and Mold (CFU/g)
      { typeId: 1286, value: 1000 }, // Total Viable Aerobic Bacteria (CFU/g)
      { typeId: 515, value: 0 },     // E.coli (CFU/g)
      { typeId: 1024, value: 0 },    // Salmonella (CFU/g)
    ],
  },
  {
    label: 'pass-highcbd',
    overallPassed: true,
    results: [
      { typeId: 1259, value: 5.2 },
      { typeId: 1210, value: 14.8 },
      { typeId: 1119, value: 0.5 },
      { typeId: 1131, value: 5.1 },
      { typeId: 342, value: 1.2 },
      { typeId: 355, value: 14.5 },
      { typeId: 1198, value: 21.0 },
      { typeId: 864, value: 11.0 },
      { typeId: 1346, value: 0.58 },
      { typeId: 186, value: 0 },
      { typeId: 301, value: 0 },
      { typeId: 773, value: 0 },
      { typeId: 802, value: 0 },
    ],
  },
  {
    label: 'fail-metals',
    overallPassed: false,
    results: [
      { typeId: 1259, value: 18.3 },
      { typeId: 1210, value: 0.4 },
      { typeId: 864, value: 12.1 },
      { typeId: 186, value: 2.5, passed: false },
      { typeId: 301, value: 1.8, passed: false },
      { typeId: 773, value: 3.2, passed: false },
      { typeId: 802, value: 0.01 },
    ],
  },
  {
    label: 'fail-micro',
    overallPassed: false,
    results: [
      { typeId: 1259, value: 25.1 },
      { typeId: 1210, value: 0.2 },
      { typeId: 864, value: 14.5 },
      { typeId: 1307, value: 50000, passed: false },
      { typeId: 1286, value: 100000, passed: false },
      { typeId: 515, value: 150, passed: false },
      { typeId: 1024, value: 0 },
    ],
  },
];

async function main() {
  if (!hasCredentials()) {
    console.error('Missing METRC credentials. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY.');
    process.exit(1);
  }
  log('Lab license:', LAB_LICENSE);
  log('Cultivator license:', SOURCE_LICENSE);
  log('Date:', today, '| Run ID:', RUN_ID);

  // ──────────────────────────────────────────────────────────
  // Phase 1: Full cultivator lifecycle → packages from harvest
  // ──────────────────────────────────────────────────────────
  log('\n═══ Phase 1: Cultivator lifecycle ═══');

  // 1a) Strains
  let srcStrains = (await metrcFetch('/strains/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  const existingNames = new Set(srcStrains.map((s) => s.Name));
  for (let i = 1; i <= 12; i++) {
    const name = `SBX Strain ${i}`;
    if (existingNames.has(name)) continue;
    try {
      await metrcFetch('/strains/v2/', { licenseNumber: SOURCE_LICENSE }, {
        method: 'POST',
        body: [{ Name: name, IndicaPercentage: 30 + ((i - 1) * 3) % 41, SativaPercentage: 70 - ((i - 1) * 3) % 41 }],
      });
      log('  Created strain:', name);
    } catch (e) {
      log('  Strain failed:', e.message?.slice(0, 80));
    }
  }
  srcStrains = (await metrcFetch('/strains/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  log('Strains:', srcStrains.length);

  // 1b) Locations — ensure a plant-capable location
  const srcLocations = (await metrcFetch('/locations/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  let plantLocation = srcLocations.find((l) => l.ForPlants) || srcLocations[0];
  const plantLocationName = plantLocation?.Name;
  log('Plant location:', plantLocationName);

  if (!plantLocationName) {
    // Create one
    const types = (await metrcFetch('/locations/v2/types', { licenseNumber: SOURCE_LICENSE })).Data || [];
    const plantType = types.find((t) => t.ForPlants) || types[0];
    if (plantType) {
      const locName = `Grow Room ${RUN_ID}`;
      try {
        await metrcFetch('/locations/v2/', { licenseNumber: SOURCE_LICENSE }, {
          method: 'POST',
          body: [{ Name: locName, LocationTypeName: plantType.Name }],
        });
        log('  Created location:', locName);
      } catch (e) {
        log('  Location create failed:', e.message?.slice(0, 80));
      }
    }
  }
  // Refresh
  const allLocs = (await metrcFetch('/locations/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  plantLocation = allLocs.find((l) => l.ForPlants) || allLocs[0];
  const harvestLocation = allLocs.find((l) => l.ForHarvests) || plantLocation;
  log('Using location:', plantLocation?.Name, '| Harvest loc:', harvestLocation?.Name);

  // 1c) Check if we already have packages (skip lifecycle if so)
  let srcPackages = (await metrcFetch('/packages/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  if (srcPackages.length >= NUM_PACKAGES) {
    log('Cultivator already has', srcPackages.length, 'packages. Skipping lifecycle.');
  } else {
    // 1d) Plant tags
    const tagsResp = await metrcFetch('/tags/v2/plant/available', { licenseNumber: SOURCE_LICENSE });
    let plantTags = (tagsResp?.Data ?? tagsResp ?? [])
      .map((t) => (typeof t === 'string' ? t : t.Label ?? t))
      .filter(Boolean)
      .slice(0, 24);
    log('Plant tags:', plantTags.length);

    if (plantTags.length === 0) {
      log('No plant tags available! Cannot create plantings.');
    } else {
      // 1e) Plant batch types
      const batchTypes = (await metrcFetch('/plantbatches/v2/types', { licenseNumber: SOURCE_LICENSE })).Data || [];
      const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';
      log('Batch type:', seedType);

      // 1f) Create plantings (2 plants per strain, unique batch names with RUN_ID)
      let tagIdx = 0;
      let plantingsCreated = 0;
      for (let i = 0; i < Math.min(12, srcStrains.length) && tagIdx + 2 <= plantTags.length; i++) {
        const strain = srcStrains[i];
        const batchName = `Lab-${strain.Name.replace(/\s/g, '-')}-${today}-${RUN_ID}`;
        const labels = plantTags.slice(tagIdx, tagIdx + 2);
        tagIdx += 2;
        try {
          const body = labels.map((label) => ({
            Name: batchName,
            Type: seedType,
            Count: 1,
            Location: plantLocation.Name,
            ActualDate: today,
            PlantLabel: label,
            Strain: strain.Name,
          }));
          await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: SOURCE_LICENSE }, { method: 'POST', body });
          plantingsCreated += labels.length;
          log(`  Planted ${labels.length}x ${strain.Name}`);
        } catch (e) {
          log(`  Planting ${strain.Name}:`, e.message?.slice(0, 120));
        }
      }
      log('Plants created:', plantingsCreated);

      // 1g) Vegetative → Flowering
      const vegetative = (await metrcFetch('/plants/v2/vegetative', { licenseNumber: SOURCE_LICENSE })).Data || [];
      if (vegetative.length > 0) {
        try {
          const body = vegetative.map((p) => ({ Id: p.Id, GrowthPhase: 'Flowering', ActualDate: today }));
          await metrcFetch('/plants/v2/growthphase', { licenseNumber: SOURCE_LICENSE }, { method: 'PUT', body });
          log('Moved to flowering:', vegetative.length);
        } catch (e) {
          log('Growth phase change:', e.message?.slice(0, 120));
        }
      } else {
        log('No vegetative plants to move.');
      }

      // 1h) Harvest flowering plants
      const flowering = (await metrcFetch('/plants/v2/flowering', { licenseNumber: SOURCE_LICENSE })).Data || [];
      if (flowering.length > 0 && harvestLocation) {
        const harvestName = `Lab-Harvest-${today}-${RUN_ID}`;
        try {
          const body = flowering.map((p) => ({
            HarvestName: harvestName,
            Plant: p.Label,
            Weight: 1,
            UnitOfWeight: 'Ounces',
            DryingLocation: harvestLocation.Name,
            ActualDate: today,
          }));
          await metrcFetch('/plants/v2/harvest', { licenseNumber: SOURCE_LICENSE }, { method: 'PUT', body });
          log('Harvested:', flowering.length, 'plants →', harvestName);
        } catch (e) {
          log('Harvest failed:', e.message?.slice(0, 120));
        }
      } else {
        log('No flowering plants to harvest.');
      }

      // 1i) Ensure a WeightBased item exists for packaging
      let items = (await metrcFetch('/items/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
      let budsItem = items.find((i) => i.QuantityType === 'WeightBased');
      if (!budsItem && srcStrains.length > 0) {
        let categoryName = 'Buds';
        try {
          const cats = await metrcFetch('/items/v1/categories', {});
          const catList = Array.isArray(cats) ? cats : (cats.Data || []);
          const wb = catList.find((c) => c.Name === 'Buds') || catList.find((c) => c.QuantityType === 'WeightBased');
          if (wb) categoryName = wb.Name;
        } catch (_) {}
        try {
          await metrcFetch('/items/v2/', { licenseNumber: SOURCE_LICENSE }, {
            method: 'POST',
            body: [{ Name: `Lab Flower ${RUN_ID}`, ItemCategory: categoryName, UnitOfMeasure: 'Ounces', Strain: srcStrains[0].Name }],
          });
          items = (await metrcFetch('/items/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
          budsItem = items.find((i) => i.QuantityType === 'WeightBased');
        } catch (e) {
          log('Create item:', e.message?.slice(0, 80));
        }
      }
      log('Items:', items.length, '| Using:', budsItem?.Name ?? 'none');

      // 1j) Create packages from harvests
      const harvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
      log('Active harvests:', harvests.length);

      const pkgTagsResp = await metrcFetch('/tags/v2/package/available', { licenseNumber: SOURCE_LICENSE });
      let pkgTags = (pkgTagsResp?.Data ?? pkgTagsResp ?? [])
        .map((t) => (typeof t === 'string' ? t : t.Label ?? t))
        .filter(Boolean);
      log('Package tags:', pkgTags.length);

      if (harvests.length > 0 && budsItem && pkgTags.length >= 2) {
        for (const harvest of harvests.slice(0, 6)) {
          const tags = pkgTags.splice(0, 2);
          if (tags.length === 0) break;
          try {
            const body = tags.map((Tag) => ({
              HarvestId: harvest.Id,
              HarvestName: harvest.Name,
              Tag,
              Location: harvestLocation.Name,
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
            await metrcFetch('/harvests/v2/packages', { licenseNumber: SOURCE_LICENSE }, { method: 'POST', body });
            log(`  Packaged harvest: ${harvest.Name} (${tags.length} packages)`);
          } catch (e) {
            log(`  Harvest packaging failed:`, e.message?.slice(0, 150));
            pkgTags.unshift(...tags);
          }
        }
      } else {
        log('Cannot create harvest packages (harvests:', harvests.length,
          '| item:', budsItem?.Name ?? 'none', '| tags:', pkgTags.length, ')');
      }

      srcPackages = (await metrcFetch('/packages/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
      log('Cultivator packages after lifecycle:', srcPackages.length);
    }
  }

  if (srcPackages.length === 0) {
    log('\nNo packages available on cultivator. The MA sandbox may need manual intervention.');
    log('Try running against a different cultivator license or checking sandbox status.');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────
  // Phase 2: Transfer packages from cultivator to lab
  // ──────────────────────────────────────────────────────────
  log('\n═══ Phase 2: Transfer to lab ═══');

  // 2a) Get transfer types
  let transferTypes = [];
  try {
    const resp = await metrcFetch('/transfers/v2/types', { licenseNumber: SOURCE_LICENSE });
    transferTypes = resp?.Data ?? resp ?? [];
    log('Transfer types:', transferTypes.map((t) => t.Name || t).join(', '));
  } catch (e) {
    log('Transfer types:', e.message?.slice(0, 80));
  }

  const testingType = transferTypes.find((t) => /test/i.test(t.Name || ''));
  const transferTypeName = testingType?.Name || transferTypes[0]?.Name || 'Transfer';
  log('Using transfer type:', transferTypeName);

  // 2b) Create the transfer
  const toTransfer = srcPackages.slice(0, NUM_PACKAGES);
  const transferBody = [{
    RecipientLicenseNumber: LAB_LICENSE,
    TransferTypeName: transferTypeName,
    PlannedRoute: 'Cultivator to Lab for Testing',
    EstimatedDepartureDateTime: `${today}T08:00:00.000`,
    EstimatedArrivalDateTime: `${today}T10:00:00.000`,
    Transporters: [{
      TransporterFacilityLicenseNumber: SOURCE_LICENSE,
      DriverName: 'SBX Driver',
      DriverOccupationalLicenseNumber: '',
      DriverVehicleLicenseNumber: '',
      VehicleMake: 'Van',
      VehicleModel: 'Transit',
      VehicleLicensePlateNumber: 'SBX-LAB-01',
      IsLayover: false,
      EstimatedDepartureDateTime: `${today}T08:00:00.000`,
      EstimatedArrivalDateTime: `${today}T10:00:00.000`,
    }],
    Packages: toTransfer.map((pkg) => ({
      PackageLabel: pkg.Label ?? pkg.PackageLabel,
      WholesalePrice: null,
      GrossWeight: pkg.Quantity ?? 1,
      GrossUnitOfWeight: pkg.UnitOfMeasureName || 'Ounces',
    })),
  }];

  // Try multiple transfer endpoints (METRC v2 API varies by state)
  const transferEndpoints = [
    '/transfers/v2/external/incoming',
    '/transfers/v2/templates/outgoing',
    '/transfers/v2/external/outgoing',
  ];
  let transferSuccess = false;
  for (const endpoint of transferEndpoints) {
    try {
      await metrcFetch(endpoint, { licenseNumber: SOURCE_LICENSE }, { method: 'POST', body: transferBody });
      log('Transfer sent via', endpoint);
      transferSuccess = true;
      break;
    } catch (e) {
      log(`  ${endpoint}:`, e.message?.slice(0, 100));
    }
  }

  if (!transferSuccess) {
    log('All transfer endpoints failed. Will try recording lab results directly against package labels.');
  }

  // 2c) Check lab packages
  await new Promise((r) => setTimeout(r, 2000));
  let labPackages = (await metrcFetch('/packages/v2/active', { licenseNumber: LAB_LICENSE })).Data || [];
  log('Lab active packages:', labPackages.length);

  if (labPackages.length === 0) {
    try {
      const incoming = await metrcFetch('/transfers/v2/incoming', { licenseNumber: LAB_LICENSE });
      const transfers = incoming?.Data ?? incoming ?? [];
      log('Lab incoming transfers:', transfers.length);
    } catch (_) {}
  }

  // ──────────────────────────────────────────────────────────
  // Phase 3: Record lab test results
  // ──────────────────────────────────────────────────────────
  log('\n═══ Phase 3: Lab test results ═══');

  // Use lab packages if available, otherwise try against cultivator package labels
  const testTargets = labPackages.length > 0 ? labPackages : srcPackages;
  log('Recording results on', testTargets.length, 'packages');

  let testCount = 0;
  for (let i = 0; i < testTargets.length && i < NUM_PACKAGES; i++) {
    const pkg = testTargets[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) continue;

    const profile = LAB_TEST_PROFILES[i % LAB_TEST_PROFILES.length];
    const results = profile.results.map((r) => ({
      LabTestTypeId: r.typeId,
      Quantity: r.value,
      Passed: r.passed !== undefined ? r.passed : profile.overallPassed,
      Notes: '',
    }));

    try {
      await metrcFetch('/labtests/v2/results', { licenseNumber: LAB_LICENSE }, {
        method: 'POST',
        body: [{
          Label: label,
          ResultDate: today,
          Results: results,
          OverallPassed: profile.overallPassed,
        }],
      });
      testCount++;
      log(`  ${profile.label}: ${label}`);
    } catch (e) {
      log(`  ${label} failed:`, e.message?.slice(0, 150));
    }
  }

  // ──────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────
  const finalLabPkgs = (await metrcFetch('/packages/v2/active', { licenseNumber: LAB_LICENSE })).Data || [];
  const finalSrcPkgs = (await metrcFetch('/packages/v2/active', { licenseNumber: SOURCE_LICENSE })).Data || [];
  log('\n═══ Summary ═══');
  log('Cultivator:', SOURCE_LICENSE, '| Packages:', finalSrcPkgs.length);
  log('Lab:', LAB_LICENSE, '| Packages:', finalLabPkgs.length);
  log('Lab test results recorded:', testCount, '/', NUM_PACKAGES);
  if (testCount > 0) {
    log('Profiles: pass-clean, pass-highcbd, fail-metals, fail-micro');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
