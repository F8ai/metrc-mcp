#!/usr/bin/env node
/**
 * Cultivator facility seeder.
 * Seeds strains, locations, plant batches (2-tag pattern), harvests, and packages.
 *
 * Uses the proven lifecycle from populate-sandbox.mjs:
 *   1. POST /plantbatches/v2/plantings       (PlantLabel = tag 1)
 *   2. POST /plantbatches/v2/growthphase      (StartingTag = tag 2, GrowthPhase: Vegetative)
 *   3. PUT  /plants/v2/growthphase            (by Id, GrowthPhase: Flowering)
 *   4. PUT  /plants/v2/harvest                (by Label)
 *   5. POST /harvests/v2/packages             (from harvest weight)
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

/** Ensure veg + flower locations exist. Prefers ForPlants locations. */
async function ensureLocations(api, license, runId) {
  const types = (await api('/locations/v2/types', { licenseNumber: license })).Data || [];
  log(`Location types: ${types.map((t) => `${t.Name} (ForPlants:${t.ForPlants})`).join(', ') || 'none'}`);

  const plantType = types.find((t) => t.ForPlants) || types.find((t) => t.ForPlantBatches) || types[0];
  const hasForPlantsType = types.some((t) => t.ForPlants);
  if (!plantType) { log('No location types available'); return {}; }

  // Only create new locations if we found a ForPlants-capable type
  if (hasForPlantsType) {
    const existingNames = new Set(((await api('/locations/v2/active', { licenseNumber: license })).Data || []).map((l) => l.Name));
    let created = 0;
    for (const n of [`Veg Room ${runId}`, `Flower Room ${runId}`]) {
      if (existingNames.has(n)) continue;
      try {
        await api('/locations/v2/', { licenseNumber: license }, { method: 'POST', body: [{ Name: n, LocationTypeName: plantType.Name }] });
        created++;
      } catch (e) { log(`Location "${n}" skipped:`, e.message?.slice(0, 80)); }
    }
    if (created) log(`Created ${created} new locations with type: ${plantType.Name}`);
  } else {
    log(`No ForPlants location type found, will use existing plant-capable locations`);
  }

  const locs = (await api('/locations/v2/active', { licenseNumber: license })).Data || [];

  // Prefer ForPlants locations over newly created ones (which may have wrong type)
  const forPlantsLoc = locs.find((l) => l.ForPlants);
  const newVegLoc = locs.find((l) => l.Name === `Veg Room ${runId}`);
  const newFlowerLoc = locs.find((l) => l.Name === `Flower Room ${runId}`);

  // Use ForPlants locations first, fall back to new ones, then any
  const vegLoc = (hasForPlantsType && newVegLoc) ? newVegLoc : forPlantsLoc || newVegLoc || locs[0];
  const flowerLoc = (hasForPlantsType && newFlowerLoc) ? newFlowerLoc : forPlantsLoc || newFlowerLoc || vegLoc;
  const harvestLoc = locs.find((l) => l.ForHarvests) || flowerLoc;

  log(`Locations: ${locs.length} total | veg=${vegLoc?.Name} (ForPlants:${vegLoc?.ForPlants}) | flower=${flowerLoc?.Name} | harvest=${harvestLoc?.Name}`);
  return { vegLoc, flowerLoc, harvestLoc };
}

/**
 * Create plant batches using the 2-tag-per-plant pattern:
 *   Tag 1 → PlantLabel in plantings
 *   Tag 2 → StartingTag in growthphase (Vegetative)
 * Then promote half to Flowering via PUT /plants/v2/growthphase (by Id).
 */
async function createPlantBatches(api, license, strains, vegLoc, flowerLoc, runId) {
  if (!vegLoc || !strains.length) { log('Skipping plantings (no location or strains)'); return { planted: 0, vegetative: 0, flowering: 0 }; }

  const plantTags = extractTags(await api('/tags/v2/plant/available', { licenseNumber: license }));
  const batchTypes = (await api('/plantbatches/v2/types', { licenseNumber: license })).Data || [];
  const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';

  // 2 tags per plant: 1 for planting + 1 for vegetative growth phase
  const TAGS_PER_PLANT = 2;
  const COUNT = Math.min(4, strains.length, Math.floor(plantTags.length / TAGS_PER_PLANT));
  if (COUNT === 0) { log(`Only ${plantTags.length} tags, need ${TAGS_PER_PLANT}+ per plant`); return { planted: 0, vegetative: 0, flowering: 0 }; }

  let planted = 0;
  let vegetative = 0;
  let tagIndex = 0;

  for (let i = 0; i < COUNT; i++) {
    const plantTag = plantTags[tagIndex];
    const growthTag = plantTags[tagIndex + 1];
    tagIndex += TAGS_PER_PLANT;

    const batchName = `demo-${runId}-${strains[i].Name.replace(/\s/g, '-')}-${i}`;
    try {
      // Step 1: Create planting with PlantLabel (tag 1)
      await api('/plantbatches/v2/plantings', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: batchName, Type: seedType, Count: 1, Location: vegLoc.Name, ActualDate: today, PlantLabel: plantTag, Strain: strains[i].Name }],
      });
      planted++;

      // Step 2: Convert batch to tracked Vegetative plant (tag 2)
      await api('/plantbatches/v2/growthphase', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: batchName, Count: 1, StartingTag: growthTag, GrowthPhase: 'Vegetative', GrowthDate: today, NewLocation: vegLoc.Name }],
      });
      vegetative++;
      log(`Plant ${i}: ${batchName} -> Vegetative`);
    } catch (e) { log(`Plant ${i} (${strains[i].Name}) skipped:`, e.message?.slice(0, 80)); }
  }

  // Step 3: Promote half of vegetative plants to Flowering (by Id)
  let flowering = 0;
  try {
    const vegPlants = (await api('/plants/v2/vegetative', { licenseNumber: license })).Data || [];
    const toFlower = vegPlants.slice(0, Math.ceil(vegPlants.length / 2));
    if (toFlower.length > 0) {
      await api('/plants/v2/growthphase', { licenseNumber: license }, {
        method: 'PUT',
        body: toFlower.map((p) => ({
          Id: p.Id,
          GrowthPhase: 'Flowering',
          GrowthDate: today,
          NewLocation: (flowerLoc || vegLoc).Name,
        })),
      });
      flowering = toFlower.length;
      log(`Promoted ${flowering} plants to Flowering`);
    }
  } catch (e) { log('Flowering promotion skipped:', e.message?.slice(0, 80)); }

  log(`Plants: ${planted} planted, ${vegetative} vegetative, ${flowering} flowering`);
  return { planted, vegetative, flowering };
}

/** Harvest flowering plants and create packages from harvest. */
async function harvestAndPackage(api, license, harvestLoc, runId) {
  if (!harvestLoc) return { harvested: 0, packaged: 0 };

  // Harvest flowering plants (v2 uses Plant = Label, DryingLocation = name string)
  const flowering = (await api('/plants/v2/flowering', { licenseNumber: license })).Data || [];
  let harvested = 0;
  if (flowering.length > 0) {
    try {
      await api('/plants/v2/harvest', { licenseNumber: license }, {
        method: 'PUT',
        body: flowering.slice(0, 4).map((p) => ({
          HarvestName: `demo-harvest-${runId}`,
          Plant: p.Label,
          Weight: 4,
          UnitOfWeight: 'Ounces',
          DryingLocation: harvestLoc.Name,
          ActualDate: today,
        })),
      });
      harvested = Math.min(4, flowering.length);
      log(`Harvested ${harvested} plants (4 oz each)`);
    } catch (e) { log('Harvest skipped:', e.message?.slice(0, 80)); }
  }

  // Ensure a WeightBased item for packaging
  let items = (await api('/items/v2/active', { licenseNumber: license })).Data || [];
  let budsItem = items.find((i) => i.QuantityType === 'WeightBased');
  if (!budsItem) {
    // Discover item categories dynamically
    let categoryName = 'Buds';
    try {
      const cats = await api('/items/v1/categories', {});
      const catList = Array.isArray(cats) ? cats : (cats.Data || []);
      const buds = catList.find((c) => c.Name === 'Buds');
      if (buds) categoryName = buds.Name;
      else {
        const weightBased = catList.find((c) => c.QuantityType === 'WeightBased');
        if (weightBased) categoryName = weightBased.Name;
        else if (catList.length > 0) categoryName = catList[0].Name;
      }
      log(`Using item category: ${categoryName}`);
    } catch (e) {
      log(`Category lookup failed, using default: ${categoryName}`);
    }

    const strains = (await api('/strains/v2/active', { licenseNumber: license })).Data || [];
    if (strains.length) {
      try {
        await api('/items/v2/', { licenseNumber: license }, {
          method: 'POST', body: [{ Name: `Demo Flower ${runId}`, ItemCategory: categoryName, UnitOfMeasure: 'Ounces', Strain: strains[0].Name }],
        });
        log(`Created item: Demo Flower ${runId} (category: ${categoryName})`);
      } catch (e) { log('Item creation failed:', e.message?.slice(0, 80)); }
      items = (await api('/items/v2/active', { licenseNumber: license })).Data || [];
      budsItem = items.find((i) => i.QuantityType === 'WeightBased');
    }
  }
  if (!budsItem) { log('No WeightBased item, skipping packaging'); return { harvested, packaged: 0 }; }

  // Create packages from harvest
  const harvests = (await api('/harvests/v2/active', { licenseNumber: license })).Data || [];
  const pkgTags = extractTags(await api('/tags/v2/package/available', { licenseNumber: license }));
  let packaged = 0;
  const PKG_TARGET = 8;

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
    } catch (e) { log('Harvest packaging skipped:', e.message?.slice(0, 80)); }
  }

  // Fallback: create standalone packages if harvest packaging didn't produce enough
  if (packaged < PKG_TARGET && pkgTags.length >= PKG_TARGET) {
    const uom = budsItem.UnitOfMeasureName || 'Ounces';
    const remaining = PKG_TARGET - packaged;
    const startIdx = packaged; // skip tags already used above
    for (let i = 0; i < remaining && (startIdx + i) < pkgTags.length; i++) {
      try {
        await api('/packages/v2/', { licenseNumber: license }, {
          method: 'POST',
          body: [{ Tag: pkgTags[startIdx + i], Location: harvestLoc.Name, Item: budsItem.Name, Quantity: 1, UnitOfMeasure: uom, IsProductionBatch: false, ProductRequiresRemediation: false, ActualDate: today }],
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
  const { planted, vegetative, flowering } = await createPlantBatches(api, license, strains, vegLoc, flowerLoc, runId);
  const { harvested, packaged } = await harvestAndPackage(api, license, harvestLoc, runId);
  const summary = { strainsTotal: strains.length, plantsPlanted: planted, plantsVegetative: vegetative, plantsFlowering: flowering, plantsHarvested: harvested, packagesCreated: packaged };
  log('Done.', JSON.stringify(summary));
  return summary;
}
