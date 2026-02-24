#!/usr/bin/env node
/**
 * Cross-facility package seeder.
 *
 * Ensures packages exist at a target facility (lab, dispensary, etc.) so
 * downstream seeders (lab tests, sales) have something to work with.
 *
 * Tries multiple strategies in order:
 *   1. Check if facility already has active packages → return early
 *   2. External incoming transfer (requires CanTransferFromExternalFacilities=true)
 *   3. Standalone package creation (POST /packages/v2/)
 *   4. Mini cultivator pipeline (requires CanGrowPlants=true)
 *
 * Each strategy is tried independently. If one fails, the next is attempted.
 * The first strategy that produces packages wins.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Target facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} options - Facility capabilities and config
 * @param {boolean} [options.canTransferFromExternal] - CanTransferFromExternalFacilities flag
 * @param {boolean} [options.canGrowPlants] - CanGrowPlants flag
 * @param {string} [options.shipperLicense] - Source facility license (for external incoming)
 * @param {number} [options.targetCount] - How many packages to create (default: 4)
 * @returns {Promise<object>} Summary with { packagesFound, strategy, packageLabels }
 */

const today = new Date().toISOString().slice(0, 10);

function log(msg, data) {
  const line = data !== undefined
    ? `[PackageSeed] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[PackageSeed] ${msg}`;
  console.log(line);
}

/**
 * Safely extract array from Metrc API response.
 * Some endpoints return { Data: [...] }, others return raw arrays or
 * array-like objects with numeric keys. This normalizes all cases.
 */
function extractArray(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp?.Data && Array.isArray(resp.Data)) return resp.Data;
  if (resp && typeof resp === 'object') {
    const vals = Object.values(resp);
    if (vals.length > 0 && typeof vals[0] === 'object') return vals;
  }
  return [];
}

/**
 * Get active packages at a facility.
 */
async function getActivePackages(api, license) {
  try {
    const resp = await api('/packages/v2/active', { licenseNumber: license });
    return extractArray(resp);
  } catch (e) {
    log('Failed to get active packages:', e.message?.slice(0, 80));
    return [];
  }
}

/**
 * Discover transfer types that support external incoming shipments.
 */
async function getExternalIncomingTransferType(api, license) {
  try {
    const resp = await api('/transfers/v2/types', { licenseNumber: license });
    const types = extractArray(resp);
    if (types.length === 0) return null;

    // Prefer types explicitly flagged for external incoming
    const extIncoming = types.find((t) => t.ForExternalIncomingShipments === true);
    if (extIncoming) {
      log(`Transfer type for external incoming: "${extIncoming.Name}" (ForExternalIncomingShipments=true)`);
      return extIncoming.Name;
    }

    // Fall back to common names
    const fallbackNames = ['Affiliated Transfer', 'Unaffiliated Transfer'];
    for (const name of fallbackNames) {
      if (types.some((t) => t.Name === name)) {
        log(`Transfer type fallback: "${name}"`);
        return name;
      }
    }

    // Last resort: first available type
    if (types.length > 0) {
      const name = types[0].Name || types[0];
      log(`Transfer type (first available): "${name}"`);
      return typeof name === 'string' ? name : null;
    }
  } catch (e) {
    log('Transfer types discovery failed:', e.message?.slice(0, 80));
  }
  return null;
}

/**
 * Get available package tags at a facility.
 * NOTE: The tags endpoint returns a raw array-like object (numeric keys),
 * NOT the standard { Data: [...] } wrapper. Use Object.values() as fallback.
 */
async function getPackageTags(api, license, count) {
  try {
    const resp = await api('/tags/v2/package/available', { licenseNumber: license });
    const tagArr = extractArray(resp);
    const tags = tagArr.map((t) => (typeof t === 'string' ? t : t.Label ?? t)).filter(Boolean);
    log(`Available package tags: ${tags.length}`);
    return tags.slice(0, count);
  } catch (e) {
    log('Package tags lookup failed:', e.message?.slice(0, 80));
    return [];
  }
}

/**
 * Ensure at least one WeightBased item exists at the facility.
 * Creates one if needed.
 */
async function ensureItem(api, license, runId) {
  try {
    const items = extractArray(await api('/items/v2/active', { licenseNumber: license }));
    const wb = items.find((i) => i.QuantityType === 'WeightBased');
    if (wb) {
      log(`Using existing item: "${wb.Name}" (${wb.QuantityType})`);
      return wb;
    }

    // Need to create an item — discover categories first
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
    } catch (_) {}

    // Get a strain (optional)
    let strainName;
    try {
      const strains = extractArray(await api('/strains/v2/active', { licenseNumber: license }));
      if (strains.length > 0) strainName = strains[0].Name;
    } catch (_) {}

    const itemName = `Seed Flower ${runId}`;
    const body = [{ Name: itemName, ItemCategory: categoryName, UnitOfMeasure: 'Ounces' }];
    if (strainName) body[0].Strain = strainName;

    await api('/items/v2/', { licenseNumber: license }, { method: 'POST', body });
    log(`Created item: "${itemName}" (category: ${categoryName})`);

    // Re-fetch
    const updated = extractArray(await api('/items/v2/active', { licenseNumber: license }));
    return updated.find((i) => i.Name === itemName) || updated.find((i) => i.QuantityType === 'WeightBased') || updated[0];
  } catch (e) {
    log('Item setup failed:', e.message?.slice(0, 80));
    return null;
  }
}

/**
 * Get or create a location at the facility.
 */
async function ensureLocation(api, license, runId) {
  try {
    const locs = extractArray(await api('/locations/v2/active', { licenseNumber: license }));
    if (locs.length > 0) return locs[0];

    // Try to create one
    const types = extractArray(await api('/locations/v2/types', { licenseNumber: license }));
    if (types.length > 0) {
      const typeName = types[0].Name;
      const locName = `Seed Room ${runId}`;
      await api('/locations/v2/', { licenseNumber: license }, {
        method: 'POST',
        body: [{ Name: locName, LocationTypeName: typeName }],
      });
      const updated = extractArray(await api('/locations/v2/active', { licenseNumber: license }));
      return updated.find((l) => l.Name === locName) || updated[0];
    }
  } catch (e) {
    log('Location setup failed:', e.message?.slice(0, 80));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Strategy 1: External Incoming Transfer
// ---------------------------------------------------------------------------
/**
 * Create packages at a facility via external incoming transfer.
 * Requires CanTransferFromExternalFacilities=true on the receiving facility.
 *
 * The external incoming endpoint creates a transfer manifest that brings
 * packages into the Metrc system from an "external" (non-Metrc) source.
 * Package tags come from the receiving facility's available tag pool.
 *
 * IMPORTANT: The payload requires the Destinations[] wrapper format, NOT the
 * flat format. Field names confirmed via probing (Feb 2026):
 *   - ShipperFacilityLicenseNumber, ShipperFacilityName, ShipperName
 *   - ShipperAddress1, ShipperAddressCity, ShipperAddressState, ShipperAddressPostalCode
 *   - Destinations[].Transporters[] with driver details
 *   - Destinations[].Packages[].PackagedDate (required)
 *
 * NOTE: This creates a transfer manifest visible in incoming transfers, but
 * packages will NOT appear in active inventory — Metrc has no API to
 * accept/receive transfers (confirmed by probing 10+ endpoint variations).
 * The packages remain in "pending receipt" state.
 */
async function tryExternalIncoming(api, license, runId, options) {
  const { shipperLicense, targetCount } = options;
  log('Strategy 1: External incoming transfer');

  const transferType = await getExternalIncomingTransferType(api, license);
  if (!transferType) {
    log('No transfer types available — skipping external incoming');
    return [];
  }

  const tags = await getPackageTags(api, license, targetCount);
  if (tags.length === 0) {
    log('No package tags available — skipping external incoming');
    return [];
  }

  const item = await ensureItem(api, license, runId);
  if (!item) {
    log('No item available — skipping external incoming');
    return [];
  }

  const now = new Date();
  const departure = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const arrival = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

  const uom = item.UnitOfMeasureName || 'Ounces';
  const shipper = shipperLicense || 'EXTERNAL-SEED-SOURCE';
  const plateNum = `SEED-${runId.slice(-3).toUpperCase()}`;

  // Destinations[] wrapper format — confirmed working via probing (Feb 2026)
  const payload = [{
    ShipperFacilityLicenseNumber: shipper,
    ShipperFacilityName: 'Seed Source Facility',
    ShipperName: 'Seed Source Facility',
    ShipperAddress1: '123 Cannabis Way',
    ShipperAddress2: '',
    ShipperAddressCity: 'Denver',
    ShipperAddressState: 'Colorado',
    ShipperAddressPostalCode: '80202',
    TransferTypeName: transferType,
    Destinations: [{
      RecipientLicenseNumber: license,
      TransferTypeName: transferType,
      PlannedRoute: 'Direct Route',
      EstimatedDepartureDateTime: departure.toISOString(),
      EstimatedArrivalDateTime: arrival.toISOString(),
      Transporters: [{
        TransporterFacilityLicenseNumber: shipper,
        TransporterDirection: 'Outbound',
        EstimatedDepartureDateTime: departure.toISOString(),
        EstimatedArrivalDateTime: arrival.toISOString(),
        DriverName: 'Seed Driver',
        DriverLicenseNumber: 'DL-000000',
        DriverOccupationalLicenseNumber: '',
        VehicleMake: 'Ford',
        VehicleModel: 'Transit',
        VehicleLicensePlateNumber: plateNum,
      }],
      Packages: tags.map((tag) => ({
        PackageLabel: tag,
        ItemName: item.Name,
        Quantity: 1.0,
        UnitOfMeasureName: uom,
        PackagedDate: today,
        WholesalePrice: 100.00,
        GrossWeight: 28.0,
        GrossUnitOfWeightName: 'Grams',
      })),
    }],
  }];

  try {
    const resp = await api('/transfers/v2/external/incoming', { licenseNumber: license }, {
      method: 'POST',
      body: payload,
    });
    const transferId = resp?.Ids?.[0] || resp?.Id;
    log(`External incoming: manifest created (transfer ${transferId || 'unknown'}) with ${tags.length} packages via "${transferType}"`);
    log('NOTE: Packages are in "pending receipt" — no API exists to accept them');
    return tags;
  } catch (e) {
    log('External incoming failed:', e.message?.slice(0, 200));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Strategy 2: Standalone Package Creation
// ---------------------------------------------------------------------------
/**
 * Create packages directly via POST /packages/v2/.
 * May fail if CanCreateOpeningBalancePackages=false, but worth trying.
 */
async function tryStandalonePackages(api, license, runId, targetCount) {
  log('Strategy 2: Standalone package creation');

  const tags = await getPackageTags(api, license, targetCount);
  if (tags.length === 0) {
    log('No package tags available — skipping standalone creation');
    return [];
  }

  const item = await ensureItem(api, license, runId);
  if (!item) {
    log('No item available — skipping standalone creation');
    return [];
  }

  const loc = await ensureLocation(api, license, runId);
  if (!loc) {
    log('No location available — skipping standalone creation');
    return [];
  }

  const uom = item.UnitOfMeasureName || 'Ounces';
  const created = [];

  for (let i = 0; i < tags.length; i++) {
    try {
      await api('/packages/v2/', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          Tag: tags[i],
          Location: loc.Name,
          Item: item.Name,
          Quantity: 1,
          UnitOfMeasure: uom,
          IsProductionBatch: false,
          ProductRequiresRemediation: false,
          ActualDate: today,
        }],
      });
      created.push(tags[i]);
      log(`Created package ${i + 1}/${tags.length}: ${tags[i]}`);
    } catch (e) {
      log(`Package ${i + 1} failed:`, e.message?.slice(0, 100));
      // If first attempt fails, don't try more (likely a permissions issue)
      if (i === 0) {
        log('First package failed — facility likely lacks CanCreateOpeningBalancePackages');
        break;
      }
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Strategy 3: Mini Cultivator Pipeline (for facilities with CanGrowPlants)
// ---------------------------------------------------------------------------
/**
 * Run a minimal cultivator pipeline: strain → location → plant → harvest → package.
 * Only works if the facility has CanGrowPlants=true.
 */
async function tryMiniCultivator(api, license, runId, targetCount) {
  log('Strategy 3: Mini cultivator pipeline (CanGrowPlants)');

  // Import the cultivator seeder dynamically
  try {
    const { seedCultivator } = await import('./cultivator.mjs');
    const result = await seedCultivator(api, license, runId);
    if (result.packagesCreated > 0) {
      log(`Mini cultivator created ${result.packagesCreated} packages`);
      // Fetch the actual package labels
      const pkgs = await getActivePackages(api, license);
      return pkgs.slice(0, targetCount).map((p) => p.Label ?? p.PackageLabel).filter(Boolean);
    }
    log('Mini cultivator produced no packages');
  } catch (e) {
    log('Mini cultivator failed:', e.message?.slice(0, 100));
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Ensure packages exist at a facility using the best available strategy.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Target facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} options
 * @param {boolean} [options.canTransferFromExternal=false]
 * @param {boolean} [options.canGrowPlants=false]
 * @param {string} [options.shipperLicense] - Source facility for external incoming
 * @param {number} [options.targetCount=4] - Number of packages to create
 * @returns {Promise<{ packagesFound: number, strategy: string, packageLabels: string[] }>}
 */
export async function seedPackagesAtFacility(api, license, runId, options = {}) {
  const {
    canTransferFromExternal = false,
    canGrowPlants = false,
    shipperLicense,
    targetCount = 4,
  } = options;

  log(`Seeding packages at ${license} (ext=${canTransferFromExternal}, grow=${canGrowPlants}, target=${targetCount})`);

  // Check if packages already exist
  const existing = await getActivePackages(api, license);
  if (existing.length >= targetCount) {
    const labels = existing.slice(0, targetCount).map((p) => p.Label ?? p.PackageLabel).filter(Boolean);
    log(`Already has ${existing.length} active packages — skipping creation`);
    return { packagesFound: labels.length, strategy: 'existing', packageLabels: labels };
  }
  if (existing.length > 0) {
    log(`Has ${existing.length} packages (want ${targetCount}) — will try to create more`);
  }

  // Strategy 1: External incoming transfer
  if (canTransferFromExternal) {
    const labels = await tryExternalIncoming(api, license, runId, { shipperLicense, targetCount });
    if (labels.length > 0) {
      // Verify packages appeared
      const pkgs = await getActivePackages(api, license);
      if (pkgs.length > existing.length) {
        const allLabels = pkgs.map((p) => p.Label ?? p.PackageLabel).filter(Boolean);
        return { packagesFound: allLabels.length, strategy: 'external_incoming', packageLabels: allLabels.slice(0, targetCount) };
      }
      log('External incoming returned OK but packages not yet active (may be pending receipt)');
    }
  }

  // Strategy 2: Standalone package creation
  const standaloneLabels = await tryStandalonePackages(api, license, runId, targetCount);
  if (standaloneLabels.length > 0) {
    return { packagesFound: standaloneLabels.length, strategy: 'standalone', packageLabels: standaloneLabels };
  }

  // Strategy 3: Mini cultivator (if facility can grow)
  if (canGrowPlants) {
    const cultivatorLabels = await tryMiniCultivator(api, license, runId, targetCount);
    if (cultivatorLabels.length > 0) {
      return { packagesFound: cultivatorLabels.length, strategy: 'mini_cultivator', packageLabels: cultivatorLabels };
    }
  }

  // Nothing worked — return whatever exists
  const finalPkgs = await getActivePackages(api, license);
  const finalLabels = finalPkgs.map((p) => p.Label ?? p.PackageLabel).filter(Boolean);
  log(`All strategies exhausted. Packages available: ${finalLabels.length}`);
  return { packagesFound: finalLabels.length, strategy: 'none', packageLabels: finalLabels };
}
