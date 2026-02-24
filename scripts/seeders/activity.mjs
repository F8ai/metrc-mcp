#!/usr/bin/env node
/**
 * Activity simulator seeder.
 *
 * Runs as the final pipeline phase after all base data (strains, plants,
 * harvests, packages, transfers, lab tests) has been seeded. Creates realistic
 * post-seeding operations on existing entities — adjustments, location moves,
 * waste records, finished harvests/packages, and remediations — so the sandbox
 * looks like a live facility with ongoing activity.
 *
 * Operations (in execution order):
 *   1. Package adjustments (3-5)    — quantity corrections with varied reasons
 *   2. Package location changes (2-3) — move packages between locations
 *   3. Harvest waste recording (1-2)  — trim/stem waste on active harvests
 *   4. Harvest finish (1)             — complete the oldest harvest
 *   5. Package finish (1-2)           — deplete near-empty packages
 *   6. Package remediation (1)        — remediate failed-test packages (MA-8 only)
 *
 * Each operation is independent — if one fails, the rest still run.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} options
 * @param {string} [options.facilityType] - Facility type (e.g. 'Cultivator', 'Testing Lab')
 * @param {boolean} [options.canGrowPlants] - Whether facility can grow plants (enables harvest ops)
 * @param {boolean} [options.hasLabTests] - Whether facility has lab test packages (enables remediation)
 * @returns {Promise<object>} Summary counts for each operation
 */

const today = new Date().toISOString().slice(0, 10);

function log(msg, data) {
  const line = data !== undefined
    ? `[Activity] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[Activity] ${msg}`;
  console.log(line);
}

/**
 * Safely extract array from Metrc API response.
 * Some endpoints return { Data: [...] }, others return raw arrays or
 * array-like objects with numeric keys.
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

// ---------------------------------------------------------------------------
// 1. Package Adjustments
// ---------------------------------------------------------------------------

// Fallback reasons if API discovery fails. Only "Drying" and "Waste" are
// confirmed to work across all package types in the sandbox.
const FALLBACK_ADJUSTMENT_REASONS = ['Drying', 'Waste'];

const ADJUSTMENT_NOTES = [
  'Post-cure moisture loss - expected 8-12% reduction',
  'Unusable trim and shake removed during QC inspection',
  'Weight decrease during extended curing process',
  'Physical count reconciliation - minor variance corrected',
  'Adjustment after scale recalibration - NIST traceable',
];

/**
 * Discover valid adjustment reasons from the API.
 * Falls back to known-good reasons if the endpoint isn't available.
 */
async function discoverAdjustmentReasons(api, license) {
  try {
    const resp = await api('/packages/v2/adjust/reasons', { licenseNumber: license });
    const reasons = extractArray(resp);
    if (reasons.length > 0) {
      const names = reasons.map((r) => r.Name ?? r).filter((r) => typeof r === 'string');
      if (names.length > 0) {
        log(`Discovered ${names.length} adjustment reasons: ${names.slice(0, 5).join(', ')}`);
        return names;
      }
    }
  } catch (_) {
    // Endpoint may not be exposed; fall back silently
  }
  log(`Using fallback adjustment reasons: ${FALLBACK_ADJUSTMENT_REASONS.join(', ')}`);
  return FALLBACK_ADJUSTMENT_REASONS;
}

async function adjustPackages(api, license, packages, reasons) {
  const eligible = packages.filter((p) => (p.Quantity ?? 0) > 0);
  const count = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), eligible.length);
  if (count === 0) {
    log('Adjustments: no eligible packages (all zero quantity)');
    return 0;
  }

  let adjusted = 0;
  for (let i = 0; i < count; i++) {
    const pkg = eligible[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) continue;

    const reason = reasons[i % reasons.length];
    const note = ADJUSTMENT_NOTES[i % ADJUSTMENT_NOTES.length];
    const reductionPct = 0.05 + Math.random() * 0.10; // 5-15%
    const adjustQty = Math.max(0.01, +(pkg.Quantity * reductionPct).toFixed(2));
    const uom = pkg.UnitOfMeasureName || pkg.UnitOfMeasure || 'Ounces';

    try {
      await api('/packages/v2/adjust', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          Label: label,
          Quantity: -adjustQty,
          UnitOfMeasure: uom,
          AdjustmentReason: reason,
          AdjustmentDate: today,
          ReasonNote: note,
        }],
      });
      adjusted++;
      log(`Adjusted ${label}: -${adjustQty} ${uom} (${reason})`);
    } catch (e) {
      log(`Adjustment on ${label} failed:`, e.message?.slice(0, 100));
    }
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// 2. Package Location Changes
// ---------------------------------------------------------------------------

async function movePackages(api, license, packages) {
  let locations;
  try {
    locations = extractArray(await api('/locations/v2/active', { licenseNumber: license }));
  } catch (e) {
    log('Location fetch failed:', e.message?.slice(0, 80));
    return 0;
  }

  if (locations.length < 2) {
    log('Location changes: need 2+ locations, skipping');
    return 0;
  }

  const count = Math.min(3, packages.length);
  let moved = 0;

  for (let i = 0; i < count; i++) {
    const pkg = packages[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) continue;

    // Pick a location different from the package's current one
    const currentLocId = pkg.LocationId;
    const target = locations.find((l) => l.Id !== currentLocId) || locations[0];

    try {
      await api('/packages/v2/location', { licenseNumber: license }, {
        method: 'PUT',
        body: [{
          Label: label,
          Location: target.Name,
          MoveDate: today,
        }],
      });
      moved++;
      log(`Moved ${label} -> ${target.Name}`);
    } catch (e) {
      log(`Move ${label} failed:`, e.message?.slice(0, 100));
    }
  }

  return moved;
}

// ---------------------------------------------------------------------------
// 3. Harvest Waste Recording
// ---------------------------------------------------------------------------

const WASTE_NOTES = [
  'Stem and fan leaf trim waste',
  'Non-usable plant material removed during processing',
];

async function recordHarvestWaste(api, license) {
  let harvests;
  try {
    harvests = extractArray(await api('/harvests/v2/active', { licenseNumber: license }));
  } catch (e) {
    log('Active harvests fetch failed:', e.message?.slice(0, 80));
    return 0;
  }

  if (harvests.length === 0) {
    log('Harvest waste: no active harvests, skipping');
    return 0;
  }

  // Discover waste methods (no license param — matches populate-simulated-year.mjs)
  let wasteMethods;
  try {
    const wm = await api('/wastemethods/v2/', {});
    wasteMethods = wm?.Data ?? (Array.isArray(wm) ? wm : []);
  } catch (e) {
    log('Waste methods fetch failed:', e.message?.slice(0, 80));
    return 0;
  }

  if (wasteMethods.length === 0) {
    log('Harvest waste: no waste methods available, skipping');
    return 0;
  }

  // Discover valid waste types from the API (not the same as waste methods)
  let wasteTypes = [];
  try {
    const wtResp = await api('/harvests/v2/waste/types', { licenseNumber: license });
    wasteTypes = extractArray(wtResp).map((t) => t.Name).filter(Boolean);
  } catch (_) {}

  if (wasteTypes.length === 0) {
    wasteTypes = ['Plant Material']; // confirmed default for MA/CO
  }
  log(`Waste types: ${wasteTypes.join(', ')}`);

  const count = Math.min(2, harvests.length);
  let recorded = 0;

  for (let i = 0; i < count; i++) {
    const h = harvests[i];
    const wasteType = wasteTypes[i % wasteTypes.length];
    const harvestId = h.Id;
    const harvestName = h.Name || h.HarvestName;
    const uow = h.UnitOfWeightName || 'Ounces';

    if (!harvestId) {
      log(`Harvest waste: missing harvest Id, skipping`);
      continue;
    }

    const wasteWeight = +(0.5 + Math.random() * 1.5).toFixed(2); // 0.5 - 2.0

    try {
      await api('/harvests/v2/waste', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          Id: harvestId,
          WasteType: wasteType,
          UnitOfWeight: uow,
          WasteWeight: wasteWeight,
          ActualDate: today,
          ReasonNote: WASTE_NOTES[i % WASTE_NOTES.length],
        }],
      });
      recorded++;
      log(`Harvest waste on "${harvestName}": ${wasteWeight} ${uow} (${wasteType})`);
    } catch (e) {
      log(`Harvest waste on "${harvestName}" failed:`, e.message?.slice(0, 100));
    }
  }

  return recorded;
}

// ---------------------------------------------------------------------------
// 4. Harvest Finish
// ---------------------------------------------------------------------------

async function finishHarvest(api, license) {
  let harvests;
  try {
    harvests = extractArray(await api('/harvests/v2/active', { licenseNumber: license }));
  } catch (e) {
    log('Active harvests fetch failed:', e.message?.slice(0, 80));
    return 0;
  }

  if (harvests.length < 2) {
    log(`Harvest finish: need 2+ active harvests (have ${harvests.length}), skipping`);
    return 0;
  }

  // Finish the oldest harvest (first in the list, typically sorted by creation)
  const oldest = harvests[harvests.length - 1];

  try {
    await api('/harvests/v2/finish', { licenseNumber: license }, {
      method: 'PUT',
      body: [{
        Id: oldest.Id,
        ActualDate: today,
      }],
    });
    log(`Finished harvest: "${oldest.Name}" (ID: ${oldest.Id})`);
    return 1;
  } catch (e) {
    log(`Harvest finish failed:`, e.message?.slice(0, 100));
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 5. Package Finish
// ---------------------------------------------------------------------------

async function finishPackages(api, license, reasons) {
  // Re-fetch active packages to get current quantities (may have changed from adjustments)
  let freshPkgs;
  try {
    freshPkgs = extractArray(await api('/packages/v2/active', { licenseNumber: license }));
  } catch (e) {
    log('Package finish: failed to re-fetch packages:', e.message?.slice(0, 80));
    return 0;
  }

  if (freshPkgs.length < 4) {
    log(`Package finish: need 4+ active packages (have ${freshPkgs.length}), skipping`);
    return 0;
  }

  // Sort by quantity ascending, finish the smallest 1-2
  const sorted = freshPkgs
    .filter((p) => (p.Label ?? p.PackageLabel))
    .sort((a, b) => (a.Quantity ?? 0) - (b.Quantity ?? 0));

  const count = Math.min(2, sorted.length);
  let finished = 0;

  for (let i = 0; i < count; i++) {
    const pkg = sorted[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    const qty = pkg.Quantity ?? 0;
    const uom = pkg.UnitOfMeasureName || pkg.UnitOfMeasure || 'Ounces';

    // Metrc requires quantity=0 before finishing. Adjust to zero first if needed.
    if (qty !== 0) {
      const reason = (reasons && reasons.find((r) => r === 'Entry Error')) || (reasons && reasons[0]) || 'Waste';
      const adjQty = -qty; // negative qty → positive adjustment back to 0; positive qty → negative to 0
      try {
        await api('/packages/v2/adjust', { licenseNumber: license }, {
          method: 'POST',
          body: [{
            Label: label,
            Quantity: adjQty,
            UnitOfMeasure: uom,
            AdjustmentReason: reason,
            AdjustmentDate: today,
            ReasonNote: 'Depleted - adjusting to zero before finish',
          }],
        });
        log(`Zeroed ${label}: ${adjQty > 0 ? '+' : ''}${adjQty} ${uom} (${reason})`);
      } catch (e) {
        log(`Zero-adjust ${label} failed, skipping finish:`, e.message?.slice(0, 100));
        continue;
      }
    }

    try {
      await api('/packages/v2/finish', { licenseNumber: license }, {
        method: 'PUT',
        body: [{
          Label: label,
          ActualDate: today,
        }],
      });
      finished++;
      log(`Finished package: ${label}`);
    } catch (e) {
      log(`Package finish ${label} failed:`, e.message?.slice(0, 100));
    }
  }

  return finished;
}

// ---------------------------------------------------------------------------
// 6. Package Remediation (MA-8 / failed lab tests only)
// ---------------------------------------------------------------------------

async function remediatePackages(api, license, packages) {
  // Look for packages that require remediation (from failed lab tests)
  const remedCandidates = packages.filter((p) => p.ProductRequiresRemediation === true);

  if (remedCandidates.length === 0) {
    log('Remediation: no packages require remediation, skipping');
    return 0;
  }

  const pkg = remedCandidates[0];
  const label = pkg.Label ?? pkg.PackageLabel;
  if (!label) return 0;

  try {
    await api('/packages/v2/remediate', { licenseNumber: license }, {
      method: 'POST',
      body: [{
        Label: label,
        RemediationMethodName: 'Remediation',
        RemediationDate: today,
      }],
    });
    log(`Remediated package: ${label}`);
    return 1;
  } catch (e) {
    log(`Remediation on ${label} failed:`, e.message?.slice(0, 100));
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Run the activity simulator on a single facility.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} options
 * @param {string} [options.facilityType] - Facility type name
 * @param {boolean} [options.canGrowPlants=false] - Enables harvest operations
 * @param {boolean} [options.hasLabTests=false] - Enables remediation
 * @returns {Promise<object>} Summary of operations performed
 */
export async function seedActivity(api, license, runId, options = {}) {
  const { facilityType = '', canGrowPlants = false, hasLabTests = false } = options;
  log(`Starting (license: ${license}, type: ${facilityType}, canGrow: ${canGrowPlants}, hasLab: ${hasLabTests})`);

  const summary = {
    adjustments: 0,
    locationChanges: 0,
    harvestWaste: 0,
    harvestsFinished: 0,
    packagesFinished: 0,
    remediations: 0,
  };

  // Fetch active packages once — reused across multiple operations
  let packages;
  try {
    packages = extractArray(await api('/packages/v2/active', { licenseNumber: license }));
  } catch (e) {
    log('Failed to fetch active packages:', e.message?.slice(0, 80));
    packages = [];
  }

  if (packages.length === 0) {
    log('No active packages — skipping all activity operations');
    log('Done.', JSON.stringify(summary));
    return summary;
  }

  log(`Found ${packages.length} active packages`);

  // Discover adjustment reasons once — reused by adjustments and package finish
  const adjReasons = await discoverAdjustmentReasons(api, license);

  // 1. Package Adjustments
  try {
    summary.adjustments = await adjustPackages(api, license, packages, adjReasons);
  } catch (e) {
    log('Adjustments block failed:', e.message?.slice(0, 100));
  }

  // 2. Package Location Changes
  try {
    summary.locationChanges = await movePackages(api, license, packages);
  } catch (e) {
    log('Location changes block failed:', e.message?.slice(0, 100));
  }

  // 3. Harvest Waste (cultivator facilities only)
  if (canGrowPlants) {
    try {
      summary.harvestWaste = await recordHarvestWaste(api, license);
    } catch (e) {
      log('Harvest waste block failed:', e.message?.slice(0, 100));
    }
  }

  // 4. Harvest Finish (cultivator facilities only)
  if (canGrowPlants) {
    try {
      summary.harvestsFinished = await finishHarvest(api, license);
    } catch (e) {
      log('Harvest finish block failed:', e.message?.slice(0, 100));
    }
  }

  // 5. Package Finish
  try {
    summary.packagesFinished = await finishPackages(api, license, adjReasons);
  } catch (e) {
    log('Package finish block failed:', e.message?.slice(0, 100));
  }

  // 6. Remediation (lab facilities with failed tests only)
  if (hasLabTests) {
    try {
      summary.remediations = await remediatePackages(api, license, packages);
    } catch (e) {
      log('Remediation block failed:', e.message?.slice(0, 100));
    }
  }

  log('Done.', JSON.stringify(summary));
  return summary;
}
