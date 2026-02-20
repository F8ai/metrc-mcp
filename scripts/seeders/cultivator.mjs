#!/usr/bin/env node
/**
 * Cultivator facility seeder.
 * Seeds strains, locations, plant batches, harvests, and packages.
 */

const today = new Date().toISOString().slice(0, 10);

const STRAIN_DEFS = [
  { name: 'Blue Dream',         indica: 40, sativa: 60 },
  { name: 'OG Kush',            indica: 75, sativa: 25 },
  { name: 'Sour Diesel',        indica: 30, sativa: 70 },
  { name: 'Girl Scout Cookies', indica: 60, sativa: 40 },
];

const log = (msg, data) => console.log(
  data !== undefined ? `[Cultivator] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}` : `[Cultivator] ${msg}`
);

/** Extract tag labels from a METRC tags response. */
function extractTags(resp) {
  return (resp?.Data ?? resp ?? []).map((t) => (typeof t === 'string' ? t : t.Label ?? t)).filter(Boolean);
}

/** Ensure strains exist. Creates only missing ones. */
async function ensureStrains(api, license) {
  const existing = new Set(((await api('/strains/v2/active', { licenseNumber: license })).Data || []).map((s) => s.Name));
  let created = 0;
  for (const def of STRAIN_DEFS) {
    if (existing.has(def.name)) continue;
    try {
      await api('/strains/v2/', { licenseNumber: license }, {
        method: 'POST', body: [{ Name: def.name, IndicaPercentage: def.indica, SativaPercentage: def.sativa }],
      });
      created++;
    } catch (e) { log(`Strain "${def.name}" skipped:`, e.message?.slice(0, 80)); }
  }
  const strains = (await api('/strains/v2/active', { licenseNumber: license })).Data || [];
  log(`Strains: ${strains.length} total (${created} new)`);
  return strains;
}

/** Ensure veg + flower locations exist. */
async function ensureLocations(api, license, runId) {
  const types = (await api('/locations/v2/types', { licenseNumber: license })).Data || [];
  const plantType = types.find((t) => t.ForPlants) || types.find((t) => t.ForPlantBatches) || types[0];
  if (!plantType) { log('No location types available'); return {}; }

  const existingNames = new Set(((await api('/locations/v2/active', { licenseNumber: license })).Data || []).map((l) => l.Name));
  let created = 0;
  for (const n of [`Veg Room ${runId}`, `Flower Room ${runId}`]) {
    if (existingNames.has(n)) continue;
    try {
      await api('/locations/v2/', { licenseNumber: license }, { method: 'POST', body: [{ Name: n, LocationTypeName: plantType.Name }] });
      created++;
    } catch (e) { log(`Location "${n}" skipped:`, e.message?.slice(0, 80)); }
  }

  const locs = (await api('/locations/v2/active', { licenseNumber: license })).Data || [];
  const vegLoc = locs.find((l) => l.Name === `Veg Room ${runId}`) || locs.find((l) => l.ForPlants) || locs[0];
  const flowerLoc = locs.find((l) => l.Name === `Flower Room ${runId}`) || vegLoc;
  const harvestLoc = locs.find((l) => l.ForHarvests) || flowerLoc;
  log(`Locations: ${locs.length} total (${created} new)`);
  return { vegLoc, flowerLoc, harvestLoc };
}

/** Create plant batches and promote half to flowering. */
async function createPlantBatches(api, license, strains, vegLoc, flowerLoc, runId) {
  if (!vegLoc || !strains.length) { log('Skipping plantings (no location or strains)'); return { planted: 0, promoted: 0 }; }

  const plantTags = extractTags(await api('/tags/v2/plant/available', { licenseNumber: license }));
  const batchTypes = (await api('/plantbatches/v2/types', { licenseNumber: license })).Data || [];
  const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';

  const COUNT = Math.min(4, strains.length, Math.floor(plantTags.length / 2));
  if (COUNT === 0) { log(`Only ${plantTags.length} tags, need 2+`); return { planted: 0, promoted: 0 }; }
  let planted = 0;

  for (let i = 0; i < COUNT; i++) {
    const batchName = `demo-${runId}-${strains[i].Name.replace(/\s/g, '-')}-${i}`;
    try {
      await api('/plantbatches/v2/plantings', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: batchName, Type: seedType, Count: 1, Location: vegLoc.Name, ActualDate: today, PlantLabel: plantTags[i], Strain: strains[i].Name }],
      });
      planted++;
    } catch (e) { log(`Planting skipped (${strains[i].Name}):`, e.message?.slice(0, 80)); }
  }

  // Promote first 2 batches to flowering
  const batches = ((await api('/plantbatches/v2/active', { licenseNumber: license })).Data || [])
    .filter((b) => b.Name.startsWith(`demo-${runId}`)).slice(0, 2);
  let promoted = 0;
  for (let i = 0; i < batches.length && (COUNT + i) < plantTags.length; i++) {
    try {
      await api('/plantbatches/v2/growthphase', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: batches[i].Name, Count: 1, StartingTag: plantTags[COUNT + i], GrowthPhase: 'Flowering', GrowthDate: today, Location: (flowerLoc || vegLoc).Name }],
      });
      promoted++;
    } catch (e) { log(`Growth phase skipped (${batches[i].Name}):`, e.message?.slice(0, 80)); }
  }
  log(`Plants: ${planted} planted, ${promoted} promoted to flowering`);
  return { planted, promoted };
}

/** Harvest flowering plants and create packages from harvest. */
async function harvestAndPackage(api, license, harvestLoc, runId) {
  if (!harvestLoc) return { harvested: 0, packaged: 0 };

  // Harvest
  const flowering = (await api('/plants/v2/flowering', { licenseNumber: license })).Data || [];
  let harvested = 0;
  if (flowering.length > 0) {
    try {
      await api('/plants/v2/harvest', { licenseNumber: license }, {
        method: 'PUT',
        body: flowering.slice(0, 4).map((p) => ({ HarvestName: `demo-harvest-${runId}`, Plant: p.Label, Weight: 2, UnitOfWeight: 'Ounces', DryingLocation: harvestLoc.Name, ActualDate: today })),
      });
      harvested = Math.min(4, flowering.length);
      log(`Harvested ${harvested} plants`);
    } catch (e) { log('Harvest skipped:', e.message?.slice(0, 80)); }
  }

  // Ensure a WeightBased item for packaging
  let items = (await api('/items/v2/active', { licenseNumber: license })).Data || [];
  let budsItem = items.find((i) => i.QuantityType === 'WeightBased');
  if (!budsItem) {
    const strains = (await api('/strains/v2/active', { licenseNumber: license })).Data || [];
    if (strains.length) {
      try { await api('/items/v2/', { licenseNumber: license }, { method: 'POST', body: [{ Name: `Demo Flower ${runId}`, ItemCategory: 'Buds', UnitOfMeasure: 'Ounces', Strain: strains[0].Name }] }); } catch (_) {}
      items = (await api('/items/v2/active', { licenseNumber: license })).Data || [];
      budsItem = items.find((i) => i.QuantityType === 'WeightBased');
    }
  }
  if (!budsItem) { log('No WeightBased item, skipping packaging'); return { harvested, packaged: 0 }; }

  // Create packages
  const harvests = (await api('/harvests/v2/active', { licenseNumber: license })).Data || [];
  const pkgTags = extractTags(await api('/tags/v2/package/available', { licenseNumber: license }));
  let packaged = 0;
  const PKG_TARGET = 4;

  if (harvests.length > 0 && pkgTags.length >= PKG_TARGET) {
    const h = harvests[0];
    const uom = budsItem.UnitOfMeasureName || 'Ounces';
    try {
      await api('/harvests/v2/packages', { licenseNumber: license }, {
        method: 'POST',
        body: pkgTags.slice(0, PKG_TARGET).map((Tag) => ({
          HarvestId: h.Id, HarvestName: h.Name, Tag, Location: harvestLoc.Name, Item: budsItem.Name,
          Weight: 0.5, UnitOfWeight: uom,
          Ingredients: [{ HarvestId: h.Id, HarvestName: h.Name, Weight: 0.5, UnitOfWeight: uom }],
          IsProductionBatch: false, ProductRequiresRemediation: false, ActualDate: today,
        })),
      });
      packaged = PKG_TARGET;
      log(`Created ${packaged} packages from harvest: ${h.Name}`);
    } catch (e) { log('Packaging skipped:', e.message?.slice(0, 80)); }
  } else if (pkgTags.length >= PKG_TARGET) {
    const uom = budsItem.UnitOfMeasureName || 'Ounces';
    for (let i = 0; i < PKG_TARGET; i++) {
      try {
        await api('/packages/v2/', { licenseNumber: license }, {
          method: 'POST',
          body: [{ Tag: pkgTags[i], Location: harvestLoc.Name, Item: budsItem.Name, Quantity: 1, UnitOfMeasure: uom, IsProductionBatch: false, ProductRequiresRemediation: false, ActualDate: today }],
        });
        packaged++;
      } catch (e) { log(`Standalone pkg ${i} skipped:`, e.message?.slice(0, 80)); }
    }
  }
  log(`Harvest/package: ${harvested} harvested, ${packaged} packaged`);
  return { harvested, packaged };
}

/** Main entry point. */
export async function seedCultivator(api, license, runId) {
  log(`Starting (license: ${license}, runId: ${runId})`);
  const strains = await ensureStrains(api, license);
  const { vegLoc, flowerLoc, harvestLoc } = await ensureLocations(api, license, runId);
  const { planted, promoted } = await createPlantBatches(api, license, strains, vegLoc, flowerLoc, runId);
  const { harvested, packaged } = await harvestAndPackage(api, license, harvestLoc, runId);
  const summary = { strainsTotal: strains.length, plantsPlanted: planted, plantsPromoted: promoted, plantsHarvested: harvested, packagesCreated: packaged };
  log('Done.', JSON.stringify(summary));
  return summary;
}
