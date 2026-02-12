#!/usr/bin/env node
/**
 * Simulate the full METRC seed-to-sale lifecycle in one year of simulated time.
 *
 * Lifecycle: Sandbox setup → Strains → Locations → [per cycle: Seed → Vegetative → Flowering
 * → Harvest] → Items → Packages from harvests → Harvest waste → Finish harvests → Lab (types)
 * → Finish packages (sell) → optional Adjust. All dates backdated so data spans ~12 months.
 *
 * Run: node scripts/populate-simulated-year.mjs
 * Requires .env: METRC_VENDOR_API_KEY, METRC_USER_API_KEY. Optional: METRC_LICENSE.
 */

import { metrcFetch, LICENSE, hasCredentials } from './lib/metrc-fetch.mjs';

const today = new Date();
function addWeeks(d, weeks) {
  const out = new Date(d);
  out.setDate(out.getDate() + weeks * 7);
  return out;
}
function addDays(d, days) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
function toDate(d) {
  return d.toISOString().slice(0, 10);
}

const log = (msg, ...rest) =>
  console.log(rest.length ? [msg, ...rest].join(' ') : msg);

const WEEKS_AGO_START = 52;
const CYCLE_WEEKS = 4;
const VEG_WEEKS = 10;
const FLOWER_WEEKS = 8;
const PLANTS_PER_CYCLE = 2;
const NUM_CYCLES = 12;

async function main() {
  if (!hasCredentials()) {
    console.error('Missing METRC credentials. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in .env or in MCP config .cursor/mcp.json (env).');
    process.exit(1);
  }
  const license = LICENSE;

  log('=== Full lifecycle (simulated time) ===');
  log('License:', license);

  // --- 1. Setup ---
  try {
    await metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
    log('Sandbox setup OK');
  } catch (e) {
    log('Sandbox setup:', e.message);
  }

  let strains = (await metrcFetch('/strains/v2/active', { licenseNumber: license })).Data || [];
  if (strains.length === 0) {
    try {
      await metrcFetch('/strains/v2/', { licenseNumber: license }, { method: 'POST', body: [{ Name: 'SBX Strain 1' }] });
      strains = (await metrcFetch('/strains/v2/active', { licenseNumber: license })).Data || [];
    } catch (e) {
      log('Create strain:', e.message);
    }
  }
  log('Strains:', strains.length);

  const types = (await metrcFetch('/locations/v2/types', { licenseNumber: license })).Data || [];
  const plantType = types.find((t) => t.ForPlants === true);
  let plantLocationId = null;
  if (plantType) {
    try {
      const created = await metrcFetch(
        '/locations/v2/',
        { licenseNumber: license },
        { method: 'POST', body: [{ Name: 'Grow Room Sim', LocationTypeId: plantType.Id }] }
      );
      plantLocationId = Array.isArray(created) ? created[0]?.Id : created?.Id ?? plantType.Id;
    } catch (e) {
      const locs = (await metrcFetch('/locations/v2/active', { licenseNumber: license })).Data || [];
      plantLocationId = locs.find((l) => l.Name && l.Name.includes('Grow'))?.Id ?? locs[0]?.Id;
    }
  }
  const allLocs = (await metrcFetch('/locations/v2/active', { licenseNumber: license })).Data || [];
  const harvestLocationId = allLocs.find((l) => l.ForHarvests || l.Name?.includes('Processing'))?.Id ?? allLocs[0]?.Id;
  log('Locations: plant', plantLocationId, '| harvest/drying', harvestLocationId);

  if (!plantLocationId || !harvestLocationId) {
    console.error('Need plant-capable and harvest locations. Run populate-sandbox first or create in METRC.');
    process.exit(1);
  }

  const tagsResp = await metrcFetch('/tags/v2/plant/available', { licenseNumber: license });
  let plantLabels = (tagsResp?.Data ?? tagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
  if (!Array.isArray(plantLabels)) plantLabels = [];
  const batchTypes = (await metrcFetch('/plantbatches/v2/types', { licenseNumber: license })).Data || [];
  const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';
  const cyclesToRun = Math.min(NUM_CYCLES, Math.floor(plantLabels.length / PLANTS_PER_CYCLE));
  let tagIndex = 0;

  // --- 2. Grow (seed → vegetative → flowering → harvest) over simulated cycles ---
  log('--- Grow: planting → vegetative → flowering → harvest ---');
  for (let c = 0; c < cyclesToRun; c++) {
    const cycleStart = addWeeks(today, -WEEKS_AGO_START + c * CYCLE_WEEKS);
    const plantingDate = toDate(cycleStart);
    const floweringDate = toDate(addWeeks(cycleStart, VEG_WEEKS));
    const harvestDate = toDate(addWeeks(cycleStart, VEG_WEEKS + FLOWER_WEEKS));

    const strain = strains[c % strains.length];
    const batchName = `SimYear-${strain.Name.replace(/\s/g, '-')}-${plantingDate}`;
    const cycleLabels = plantLabels.slice(tagIndex, tagIndex + PLANTS_PER_CYCLE);
    tagIndex += PLANTS_PER_CYCLE;
    if (cycleLabels.length < PLANTS_PER_CYCLE) break;

    try {
      const body = cycleLabels.map((label) => ({
        PlantBatchName: batchName,
        Type: seedType,
        Count: 1,
        LocationId: plantLocationId,
        ActualDate: plantingDate,
        PlantLabel: label,
        Strain: strain.Name,
      }));
      await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: license }, { method: 'POST', body });
      log('  [', plantingDate, '] Seed → plants:', batchName);
    } catch (e) {
      log('  Plantings failed:', e.message);
      continue;
    }

    const vegetative = (await metrcFetch('/plants/v2/vegetative', { licenseNumber: license })).Data || [];
    const byLabel = vegetative.filter((p) => cycleLabels.includes(p.Label));
    if (byLabel.length > 0) {
      try {
        await metrcFetch('/plants/v2/growthphase', { licenseNumber: license }, {
          method: 'PUT',
          body: byLabel.map((p) => ({ Id: p.Id, GrowthPhase: 'Flowering', ActualDate: floweringDate })),
        });
        log('  [', floweringDate, '] Vegetative → Flowering:', byLabel.length, 'plants');
      } catch (e) {
        log('  Growth phase:', e.message);
      }
    }

    const flowering = (await metrcFetch('/plants/v2/flowering', { licenseNumber: license })).Data || [];
    const toHarvest = flowering.filter((p) => cycleLabels.includes(p.Label));
    if (toHarvest.length > 0 && harvestLocationId) {
      try {
        const harvestName = `Harvest-Sim-${harvestDate}-${c + 1}`;
        await metrcFetch('/plants/v2/harvest', { licenseNumber: license }, {
          method: 'PUT',
          body: toHarvest.map((p) => ({
            HarvestName: harvestName,
            HarvestDate: harvestDate,
            Id: p.Id,
            Label: p.Label ?? undefined,
            Weight: 1,
            UnitOfMeasure: 'Ounces',
            ActualDate: harvestDate,
            DryingLocationId: harvestLocationId,
          })),
        });
        log('  [', harvestDate, '] Harvest:', harvestName);
      } catch (e) {
        log('  Harvest:', e.message);
      }
    }
  }

  // --- 3. Items (product catalog) ---
  let items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
  if (items.length === 0 && strains.length > 0) {
    try {
      await metrcFetch('/items/v2/', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: 'Flower - Usable', ItemCategory: 'Usable Marijuana', UnitOfMeasure: 'Ounces', StrainId: strains[0].Id }],
      });
      items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
      log('Item created: Flower - Usable');
    } catch (e) {
      log('Create item:', e.message);
    }
  }
  const itemId = items[0]?.Id;

  // --- 4. Packages from harvests (process harvest → packaged product) ---
  log('--- Process: harvests → packages ---');
  const harvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: license })).Data || [];
  const pkgTagsResp = await metrcFetch('/tags/v2/package/available', { licenseNumber: license });
  let pkgTags = (pkgTagsResp?.Data ?? pkgTagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
  if (!Array.isArray(pkgTags)) pkgTags = [];

  for (const harvest of harvests) {
    if (pkgTags.length < 1 || !itemId) break;
    const tag = pkgTags.shift();
    const packageDate = harvest.HarvestDate || harvest.ActualDate || toDate(today);
    try {
      await metrcFetch('/harvests/v2/packages', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          HarvestId: harvest.Id,
          HarvestName: harvest.Name,
          Tag: tag,
          LocationId: harvestLocationId,
          ItemId: itemId,
          Quantity: 1,
          UnitOfMeasure: 'Ounces',
          IsProductionBatch: false,
          ProductRequiresRemediation: false,
          ActualDate: packageDate,
        }],
      });
      log('  Package from', harvest.Name);
    } catch (e) {
      log('  Harvest package:', e.message);
      pkgTags.unshift(tag);
    }
  }

  // --- 5. Harvest waste (record waste on one harvest before finishing) ---
  log('--- Harvest waste ---');
  let wasteMethodId = null;
  try {
    const wm = await metrcFetch('/wastemethods/v2/', {});
    const list = wm?.Data ?? (Array.isArray(wm) ? wm : []);
    wasteMethodId = list[0]?.Id ?? list[0];
  } catch (_) {}
  if (wasteMethodId && harvests.length > 0) {
    try {
      const h = harvests[0];
      await metrcFetch('/harvests/v2/waste', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          HarvestId: h.Id,
          HarvestName: h.Name,
          WasteMethodId: wasteMethodId,
          WasteAmount: 0.1,
          WasteUnitOfMeasure: 'Ounces',
          WasteDate: toDate(today),
          ReasonNote: 'Simulated trim waste',
        }],
      });
      log('  Recorded harvest waste 0.1 oz on', h.Name);
    } catch (e) {
      log('  Waste:', e.message);
    }
  }

  // --- 6. Finish harvests (harvest processing complete) ---
  log('--- Finish harvests ---');
  const activeHarvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: license })).Data || [];
  for (const h of activeHarvests) {
    const finishDate = toDate(addDays(new Date(h.HarvestDate || h.ActualDate || today), 14));
    try {
      await metrcFetch('/harvests/v2/finish', { licenseNumber: license }, {
        method: 'PUT',
        body: [{ Id: h.Id, ActualDate: finishDate }],
      });
      log('  Finished harvest', h.Name, finishDate);
    } catch (e) {
      log('  Finish harvest:', e.message);
    }
  }

  // --- 7. Lab (test types; submission is facility/lab-specific) ---
  log('--- Lab ---');
  try {
    const labTypes = (await metrcFetch('/labtests/v2/types', { licenseNumber: license })).Data || [];
    log('  Lab test types:', labTypes.length);
  } catch (e) {
    log('  Lab types:', e.message);
  }

  // --- 8. Sell: finish packages (ready for sale) ---
  log('--- Sell: finish packages (ready for sale) ---');
  let packages = (await metrcFetch('/packages/v2/active', { licenseNumber: license })).Data || [];
  const pkgLabels = (packages || []).map((p) => p.Label ?? p.PackageLabel).filter(Boolean);
  const finishDate = toDate(today);
  for (const label of pkgLabels) {
    try {
      await metrcFetch('/packages/v2/finish', { licenseNumber: license }, {
        method: 'PUT',
        body: [{ Label: label, ActualDate: finishDate }],
      });
    } catch (e) {
      log('  Finish package', label, e.message);
    }
  }
  if (pkgLabels.length > 0) log('  Finished', pkgLabels.length, 'packages', finishDate);

  // --- 9. Optional: adjust one package (e.g. sample) ---
  log('--- Optional: adjust ---');
  packages = (await metrcFetch('/packages/v2/active', { licenseNumber: license })).Data || [];
  if (packages.length > 0) {
    const pkg = packages[0];
    const label = pkg.Label ?? pkg.PackageLabel;
    try {
      await metrcFetch('/packages/v2/adjust', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          Label: label,
          Quantity: 0.9,
          UnitOfMeasure: 'Ounces',
          AdjustmentReason: 'Sample',
          AdjustmentDate: toDate(today),
          ReasonNote: 'Simulated sample adjustment',
        }],
      });
      log('  Adjusted 1 package to 0.9 oz (sample)');
    } catch (e) {
      log('  Adjust:', e.message);
    }
  }

  const finalHarvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: license })).Data || [];
  const finalPackages = (await metrcFetch('/packages/v2/active', { licenseNumber: license })).Data || [];
  log('=== Done. Harvests:', finalHarvests.length, '| Packages:', finalPackages.length, '| Lifecycle simulated ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
