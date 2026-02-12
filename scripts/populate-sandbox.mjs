#!/usr/bin/env node
/**
 * Populate METRC sandbox with a full lifecycle: 12 strains, seed → harvest → packages → sale.
 * Run from repo root: node scripts/populate-sandbox.mjs
 * Requires .env with METRC_VENDOR_API_KEY and METRC_USER_API_KEY.
 *
 * Sandbox limits: Colorado may only offer location types that don't allow plants (ForPlants: false).
 * If so, plantings are skipped and the script creates strains + items only; you can still create
 * packages via metrc_create_package (not from harvest) if the sandbox allows.
 */

import { metrcFetch, LICENSE, hasCredentials } from './lib/metrc-fetch.mjs';

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
  for (const name of targetStrainNames) {
    if (strainNames.has(name)) continue;
    try {
      await metrcFetch('/strains/v2/', { licenseNumber: license }, { method: 'POST', body: [{ Name: name }] });
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
  const plantType = types.find((t) => t.ForPlants === true);
  let plantLocationId = null;
  if (plantType) {
    try {
      const created = await metrcFetch(
        '/locations/v2/',
        { licenseNumber: license },
        { method: 'POST', body: [{ Name: 'Grow Room 1', LocationTypeId: plantType.Id }] }
      );
      plantLocationId = Array.isArray(created) ? created[0]?.Id : created?.Id ?? plantType.Id;
      log('Created plant location:', plantLocationId);
    } catch (e) {
      log('Create plant location:', e.message);
    }
  } else {
    log('No location type with ForPlants: true; skipping plantings.');
  }

  // 4) Locations for harvest/drying and packages
  const locations = (await metrcFetch('/locations/v2/active', { licenseNumber: license })).Data || [];
  const harvestLocationId = locations[0]?.Id ?? null;
  log('Harvest/drying location Id:', harvestLocationId);

  // 5) Plant tags and plantings (if we have a plant location)
  let plantLabels = [];
  if (plantLocationId && strains.length >= 1) {
    const tagsResp = await metrcFetch('/tags/v2/plant/available', { licenseNumber: license });
    plantLabels = (tagsResp?.Data ?? tagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
    if (Array.isArray(plantLabels)) plantLabels = plantLabels.slice(0, 24);
    else plantLabels = [];
    log('Plant tags available:', plantLabels.length);

    const batchTypes = (await metrcFetch('/plantbatches/v2/types', { licenseNumber: license })).Data || [];
    const seedType = (batchTypes.find((t) => t.Name === 'Seed') || batchTypes[0])?.Name || 'Seed';

    let tagIndex = 0;
    for (let i = 0; i < Math.min(12, strains.length) && tagIndex + 2 <= plantLabels.length; i++) {
      const strain = strains[i];
      const batchName = `Lifecycle-${strain.Name.replace(/\s/g, '-')}-${today}`;
      const labels = plantLabels.slice(tagIndex, tagIndex + 2);
      tagIndex += 2;
      try {
        const body = labels.map((label) => ({
          PlantBatchName: batchName,
          Type: seedType,
          Count: 1,
          LocationId: plantLocationId,
          ActualDate: today,
          PlantLabel: label,
          Strain: strain.Name,
        }));
        await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: license }, { method: 'POST', body });
        log('Plantings created:', batchName);
      } catch (e) {
        log('Plantings failed for', strain.Name, e.message);
      }
    }
  }

  // 6) Vegetative → Flowering
  if (plantLocationId) {
    try {
      const vegetative = (await metrcFetch('/plants/v2/vegetative', { licenseNumber: license })).Data || [];
      const ids = vegetative.map((p) => p.Id).filter(Boolean);
      if (ids.length > 0) {
        const changeBody = ids.map((Id) => ({ Id, GrowthPhase: 'Flowering', ActualDate: today }));
        await metrcFetch('/plants/v2/growthphase', { licenseNumber: license }, { method: 'PUT', body: changeBody });
        log('Moved to flowering:', ids.length, 'plants');
      }
    } catch (e) {
      log('Growth phase change:', e.message);
    }
  }

  // 7) Harvest flowering plants
  let harvests = [];
  try {
    const flowering = (await metrcFetch('/plants/v2/flowering', { licenseNumber: license })).Data || [];
    if (flowering.length > 0 && harvestLocationId != null) {
      const harvestName = `Harvest-${today}-1`;
      const body = flowering.map((p, i) => ({
        HarvestName: harvestName,
        HarvestDate: today,
        Id: p.Id,
        Label: p.Label ?? undefined,
        Weight: 1,
        UnitOfMeasure: 'Ounces',
        ActualDate: today,
        DryingLocationId: harvestLocationId,
      }));
      await metrcFetch('/plants/v2/harvest', { licenseNumber: license }, { method: 'PUT', body });
      log('Harvest created:', harvestName);
    }
  } catch (e) {
    log('Harvest create:', e.message);
  }

  harvests = (await metrcFetch('/harvests/v2/active', { licenseNumber: license })).Data || [];

  // 8) Items: ensure we have at least one for packaging
  let items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
  if (items.length === 0 && strains.length > 0) {
    const strainId = strains[0].Id;
    try {
      await metrcFetch(
        '/items/v2/',
        { licenseNumber: license },
        {
          method: 'POST',
          body: [
            {
              Name: 'Flower - Usable',
              ItemCategory: 'Usable Marijuana',
              UnitOfMeasure: 'Ounces',
              StrainId: strainId,
            },
          ],
        }
      );
      log('Created item: Flower - Usable');
    } catch (e) {
      log('Create item:', e.message);
    }
    items = (await metrcFetch('/items/v2/active', { licenseNumber: license })).Data || [];
  }

  // 9) Package tags
  const pkgTagsResp = await metrcFetch('/tags/v2/package/available', { licenseNumber: license });
  let pkgTags = (pkgTagsResp?.Data ?? pkgTagsResp ?? [])?.map((t) => (typeof t === 'string' ? t : t.Label ?? t))?.filter(Boolean) ?? [];
  if (!Array.isArray(pkgTags)) pkgTags = [];
  log('Package tags available:', pkgTags.length);

  // 10) Create packages from harvests (or create standalone packages if no harvests)
  const itemId = items[0]?.Id;
  if (harvests.length > 0 && itemId != null && harvestLocationId != null && pkgTags.length > 0) {
    for (const harvest of harvests.slice(0, 5)) {
      const used = pkgTags.splice(0, 2);
      if (used.length === 0) break;
      try {
        const packages = used.map((Tag) => ({
          HarvestId: harvest.Id,
          HarvestName: harvest.Name,
          Tag,
          LocationId: harvestLocationId,
          ItemId: itemId,
          Quantity: 1,
          UnitOfMeasure: 'Ounces',
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
  } else if (itemId != null && harvestLocationId != null && pkgTags.length >= 12) {
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
                LocationId: harvestLocationId,
                ItemId: itemId,
                Quantity: 1,
                UnitOfMeasure: 'Ounces',
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
