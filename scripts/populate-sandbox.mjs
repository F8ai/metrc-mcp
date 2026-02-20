#!/usr/bin/env node
/**
 * Populate METRC sandbox with a full lifecycle: 12 strains, seed → harvest → packages → sale.
 * Run from repo root: node scripts/populate-sandbox.mjs
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY.
 *
 * Defaults to CO-21 (Retail Cultivation) which has full ForPlants location types and item
 * categories. Override with METRC_LICENSE env var. Avoid CO-1 (Accelerator Cultivation)
 * which has crippled categories and no ForPlants location type.
 */

import { metrcFetch, LICENSE, hasCredentials } from './lib/metrc-fetch.mjs';

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const RUN_ID = Math.random().toString(36).slice(2, 6); // unique suffix per run
const log = (msg, data) => (data !== undefined ? console.log(msg, typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data) : console.log(msg));

async function main() {
  if (!hasCredentials()) {
    console.error('Missing METRC credentials. Add to .env in repo root:');
    console.error('  METRC_VENDOR_API_KEY=...');
    console.error('  METRC_USER_API_KEY=...');
    process.exit(1);
  }
  const license = LICENSE;
  log('License:', license);

  // 1) Sandbox setup
  try {
    await metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
    log('Sandbox setup OK');
  } catch (e) {
    log('Sandbox setup (optional):', e.message);
  }

  // 2) Strains: ensure 12
  let strains = (await metrcFetch('/strains/v2/active', { licenseNumber: license })).Data || [];
  const strainNames = new Set((strains || []).map((s) => s.Name));
  const targetStrainNames = [
    'SBX Strain 1',
    'SBX Strain 2',
    'SBX Strain 3',
    'SBX Strain 4',
    'SBX Strain 5',
    'SBX Strain 6',
    'SBX Strain 7',
    'SBX Strain 8',
    'SBX Strain 9',
    'SBX Strain 10',
    'SBX Strain 11',
    'SBX Strain 12',
  ];
  for (let idx = 0; idx < targetStrainNames.length; idx++) {
    const name = targetStrainNames[idx];
    if (strainNames.has(name)) continue;
    const indica = 30 + (idx * 3) % 41; // vary between 30-70
    try {
      await metrcFetch('/strains/v2/', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: name, IndicaPercentage: indica, SativaPercentage: 100 - indica }],
      });
      strainNames.add(name);
      log('Created strain:', name);
    } catch (e) {
      log('Create strain failed:', e.message);
    }
  }
  strains = (await metrcFetch('/strains/v2/active', { licenseNumber: license })).Data || [];
  log('Strains count:', strains.length);

  // 3) Location types and plant-capable location
  const types = (await metrcFetch('/locations/v2/types', { licenseNumber: license })).Data || [];
  log('Location types:', types.map((t) => `${t.Name} (ForPlants:${t.ForPlants})`).join(', '));
  const plantType = types.find((t) => t.ForPlants === true) || types.find((t) => t.ForPlantBatches === true) || types[0];
  let plantLocationName = null;
  let plantLocationId = null;
  if (plantType) {
    const locName = `Grow Room 1-${today}`;
    try {
      const created = await metrcFetch(
        '/locations/v2/',
        { licenseNumber: license },
        { method: 'POST', body: [{ Name: locName, LocationTypeName: plantType.Name }] }
      );
      plantLocationId = created?.Ids?.[0] ?? null;
      plantLocationName = locName;
      log('Created plant location:', locName, '(Id:', plantLocationId, ')');
    } catch (e) {
      log('Create plant location:', e.message);
    }
  } else {
    log('No location types available; skipping location creation.');
  }

  // 4) Locations for harvest/drying and packages (use names for v2 API)
  const locations = (await metrcFetch('/locations/v2/active', { licenseNumber: license })).Data || [];
  const harvestLocation = locations.find((l) => l.ForHarvests) || locations[0] || null;
  const harvestLocationName = harvestLocation?.Name ?? null;
  const harvestLocationId = harvestLocation?.Id ?? null;
  // If we didn't create a plant location, try to find an existing plant-capable one
  if (!plantLocationName) {
    const existingPlantLoc = locations.find((l) => l.ForPlants);
    if (existingPlantLoc) {
      plantLocationName = existingPlantLoc.Name;
      plantLocationId = existingPlantLoc.Id;
      log('Using existing plant location:', plantLocationName);
    }
  }
  log('Harvest/drying location:', harvestLocationName);

  // 5) Plant tags and plantings (if we have a plant location)
  let plantLabels = [];
  if (plantLocationName && strains.length >= 1) {
    const tagsResp = await metrcFetch('/tags/v2/plant/available', { licenseNumber: license });
    plantLabels = (tagsResp?.Data ?? tagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
    if (!Array.isArray(plantLabels)) plantLabels = [];
    log('Plant tags available:', plantLabels.length);

    if (plantLabels.length === 0) {
      log('No plant tags available; skipping plantings.');
    } else {
      const batchTypes = (await metrcFetch('/plantbatches/v2/types', { licenseNumber: license })).Data || [];
      const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';

      // Each plant needs: 1 unique batch name, 1 planting tag, 1 growthphase tag = 2 tags per plant
      // METRC v2 allows only ONE planting per batch name
      let tagIndex = 0;
      const TAGS_PER_PLANT = 2;
      const plantsToCreate = Math.min(12, strains.length, Math.floor(plantLabels.length / TAGS_PER_PLANT));
      for (let i = 0; i < plantsToCreate; i++) {
        const strain = strains[i % strains.length];
        const plantTag = plantLabels[tagIndex];
        const growthTag = plantLabels[tagIndex + 1];
        tagIndex += TAGS_PER_PLANT;
        const batchName = `Lifecycle-${strain.Name.replace(/\s/g, '-')}-${today}-${RUN_ID}-${i}`;

        try {
          // Step 1: Create planting (one plant per batch)
          await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: license }, {
            method: 'POST',
            body: [{
              Name: batchName,
              Type: seedType,
              Count: 1,
              Location: plantLocationName,
              ActualDate: today,
              PlantLabel: plantTag,
              Strain: strain.Name,
            }],
          });

          // Step 2: Convert batch to tracked vegetative plant
          await metrcFetch('/plantbatches/v2/growthphase', { licenseNumber: license }, {
            method: 'POST',
            body: [{
              Name: batchName,
              Count: 1,
              StartingTag: growthTag,
              GrowthPhase: 'Vegetative',
              GrowthDate: today,
              NewLocation: plantLocationName,
            }],
          });
          log('Plant created:', batchName, '→ vegetative');
        } catch (e) {
          log(`Plant failed for ${strain.Name}:`, e.message);
        }
      }
    }
  } else {
    log('No plant location or strains; skipping plantings.');
  }

  // 6) Vegetative → Flowering (always try, not just when we created a plant location)
  try {
    const vegetative = (await metrcFetch('/plants/v2/vegetative', { licenseNumber: license })).Data || [];
    const ids = vegetative.map((p) => p.Id).filter(Boolean);
    if (ids.length > 0) {
      const changeBody = ids.map((Id) => ({ Id, GrowthPhase: 'Flowering', GrowthDate: today, NewLocation: plantLocationName || harvestLocationName }));
      await metrcFetch('/plants/v2/growthphase', { licenseNumber: license }, { method: 'PUT', body: changeBody });
      log('Moved to flowering:', ids.length, 'plants');
    } else {
      log('No vegetative plants to move to flowering.');
    }
  } catch (e) {
    log('Growth phase change:', e.message);
  }

  // 7) Harvest flowering plants (v2 uses Plant, DryingLocation, UnitOfWeight)
  let harvests = [];
  try {
    const flowering = (await metrcFetch('/plants/v2/flowering', { licenseNumber: license })).Data || [];
    if (flowering.length > 0 && harvestLocationName != null) {
      const harvestName = `Harvest-${today}-1`;
      log('Harvesting', flowering.length, 'flowering plants...');
      const body = flowering.map((p) => ({
        HarvestName: harvestName,
        Plant: p.Label,
        Weight: 1,
        UnitOfWeight: 'Ounces',
        DryingLocation: harvestLocationName,
        ActualDate: today,
      }));
      await metrcFetch('/plants/v2/harvest', { licenseNumber: license }, { method: 'PUT', body });
      log('Harvest created:', harvestName);
    } else {
      log('No flowering plants to harvest or no drying location.');
    }
  } catch (e) {
    log('Harvest create:', e.message);
  }

  harvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: license })).Data || [];

  // 8) Items: ensure we have a WeightBased item for packaging (Buds category)
  let items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
  // Prefer a WeightBased item (Buds) for harvest packages; CountBased items (Immature Plants) won't work
  let budsItem = items.find((i) => i.QuantityType === 'WeightBased') || null;
  if (!budsItem && strains.length > 0) {
    // Discover item categories dynamically (v1 returns flat list, v2 may be paginated)
    let categoryName = 'Buds';
    try {
      const cats = await metrcFetch('/items/v1/categories', {});
      const catList = Array.isArray(cats) ? cats : (cats.Data || []);
      const buds = catList.find((c) => c.Name === 'Buds');
      if (buds) categoryName = buds.Name;
      else {
        const weightBased = catList.find((c) => c.QuantityType === 'WeightBased');
        if (weightBased) categoryName = weightBased.Name;
        else if (catList.length > 0) categoryName = catList[0].Name;
      }
      log('Using item category:', categoryName);
    } catch (e) {
      log('Category lookup failed, using default:', categoryName);
    }
    // v2 API uses Strain (name string) instead of StrainId
    // Find a SBX strain first for the item, fallback to any strain
    const sbxStrain = strains.find((s) => s.Name.startsWith('SBX'));
    const strainName = sbxStrain?.Name || strains[0].Name;
    try {
      await metrcFetch(
        '/items/v2/',
        { licenseNumber: license },
        {
          method: 'POST',
          body: [
            {
              Name: `Flower - Buds - ${today}`,
              ItemCategory: categoryName,
              UnitOfMeasure: 'Ounces',
              Strain: strainName,
              UnitThcPercent: 20.0,
            },
          ],
        }
      );
      log('Created item: Flower - Buds');
    } catch (e) {
      log('Create item:', e.message);
    }
    items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
    budsItem = items.find((i) => i.QuantityType === 'WeightBased') || items[0] || null;
  }
  log('Items count:', items.length, '| Using item:', budsItem?.Name ?? 'none');

  // 9) Package tags
  const pkgTagsResp = await metrcFetch('/tags/v2/package/available', { licenseNumber: license });
  let pkgTags = (pkgTagsResp?.Data ?? pkgTagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
  if (!Array.isArray(pkgTags)) pkgTags = [];
  log('Package tags available:', pkgTags.length);

  // 10) Create packages from harvests (or create standalone packages if no harvests)
  // v2 API uses name-based fields: Item, Location, UnitOfWeight/UnitOfMeasure
  const itemName = budsItem?.Name ?? null;
  const itemUom = budsItem?.UnitOfMeasureName ?? 'Ounces';
  if (harvests.length > 0 && itemName != null && harvestLocationName != null && pkgTags.length > 0) {
    for (const harvest of harvests.slice(0, 5)) {
      const used = pkgTags.splice(0, 2);
      if (used.length === 0) break;
      try {
        const packages = used.map((Tag) => ({
          HarvestId: harvest.Id,
          HarvestName: harvest.Name,
          Tag,
          Location: harvestLocationName,
          Item: itemName,
          Weight: 1,
          UnitOfWeight: itemUom,
          Ingredients: [{
            HarvestId: harvest.Id,
            HarvestName: harvest.Name,
            Weight: 1,
            UnitOfWeight: itemUom,
          }],
          IsProductionBatch: false,
          ProductRequiresRemediation: false,
          ActualDate: today,
        }));
        await metrcFetch('/harvests/v2/packages', { licenseNumber: license }, { method: 'POST', body: packages });
        log('Harvest packages created for harvest:', harvest.Name);
      } catch (e) {
        log('Harvest packages failed:', e.message);
        pkgTags.unshift(...used);
      }
    }
  } else if (itemName != null && harvestLocationName != null && pkgTags.length >= 12) {
    // No harvests: create 12 standalone packages (one per strain) so we have "sale" inventory
    for (let i = 0; i < Math.min(12, strains.length, pkgTags.length); i++) {
      const tag = pkgTags[i];
      try {
        await metrcFetch(
          '/packages/v2/',
          { licenseNumber: license },
          {
            method: 'POST',
            body: [
              {
                Tag: tag,
                Location: harvestLocationName,
                Item: itemName,
                Quantity: 1,
                UnitOfMeasure: itemUom,
                IsProductionBatch: false,
                ProductRequiresRemediation: false,
                ActualDate: today,
              },
            ],
          }
        );
        log('Created package for strain', strains[i]?.Name ?? i);
      } catch (e) {
        log('Create package failed:', e.message);
      }
    }
  } else {
    log('Skipping package creation (items:', itemName, '| location:', harvestLocationName, '| tags:', pkgTags.length, ')');
  }

  // 11) Finish packages (get active, finish first N)
  const packages = (await metrcFetch('/packages/v2/active', { licenseNumber: license })).Data || [];
  let finished = 0;
  for (const pkg of packages.slice(0, 20)) {
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) continue;
    try {
      await metrcFetch(
        '/packages/v2/finish',
        { licenseNumber: license },
        { method: 'PUT', body: [{ Label: label, ActualDate: today }] }
      );
      finished++;
    } catch (e) {
      // may already be finished
    }
  }
  log('Finished packages:', finished);

  log('Done. Strains:', strains.length, '| Harvests:', harvests.length, '| Packages:', packages.length, '| Finished:', finished);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
