#!/usr/bin/env node
/**
 * Transfer seeder.
 *
 * Creates outgoing transfer TEMPLATES from one facility (e.g. cultivator) to
 * another (e.g. dispensary) using the METRC transfer templates API.
 *
 * NOTE (confirmed by Metrc support, case #02372700, Feb 2026):
 *   Transfers are template-only via the API. The correct endpoint is
 *   POST /transfers/v2/templates/outgoing. The endpoint
 *   POST /transfers/v2/external/outgoing does NOT exist — it returns 404.
 *   Templates must include Name, TransporterFacilityLicenseNumber,
 *   Destinations[].Transporters[] (driver info), and PlannedRoute.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} fromLicense - Shipper facility license number
 * @param {string} toLicense - Receiver facility license number
 * @param {string} runId - Unique run identifier
 * @returns {Promise<object>} Summary of transfers created
 */

const today = new Date().toISOString().slice(0, 10);

function log(msg, data) {
  const line = data !== undefined
    ? `[Transfer] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[Transfer] ${msg}`;
  console.log(line);
}

/**
 * Discover available transfer type names for a facility.
 */
async function discoverTransferTypes(api, license) {
  try {
    const resp = await api('/transfers/v2/types', { licenseNumber: license });
    const types = resp?.Data || resp || [];
    if (Array.isArray(types)) {
      const names = types.map((t) => (typeof t === 'string' ? t : t.Name ?? t)).filter(Boolean);
      log(`Discovered ${names.length} transfer types: ${names.join(', ')}`);
      return names;
    }
  } catch (e) {
    log('Transfer types lookup failed:', e.message?.slice(0, 80));
  }
  return [];
}

/**
 * Main transfer seeder entry point.
 *
 * Creates outgoing transfer templates (not direct transfers) because the
 * METRC API only supports template-based transfers.
 */
export async function seedTransfers(api, fromLicense, toLicense, runId) {
  log(`Starting (from: ${fromLicense}, to: ${toLicense}, runId: ${runId})`);

  // Get active packages on the source facility
  const packages = (await api('/packages/v2/active', { licenseNumber: fromLicense })).Data || [];
  if (packages.length === 0) {
    log('No active packages on source facility. Skipping transfers.');
    return { transferred: 0, skipped: 0 };
  }
  log(`Found ${packages.length} active packages on source facility`);

  // Discover transfer types
  const transferTypes = await discoverTransferTypes(api, fromLicense);
  if (transferTypes.length === 0) {
    log('No transfer types available. Skipping transfers.');
    return { transferred: 0, skipped: 0 };
  }

  // Pick a transfer type — prefer simple types that don't have extra validation requirements
  const typeName = transferTypes.find((t) => t === 'Affiliated Transfer')
    || transferTypes.find((t) => t === 'Unaffiliated Transfer')
    || transferTypes.find((t) => t === 'Affiliated')
    || transferTypes.find((t) => t === 'Unaffiliated')
    || transferTypes.find((t) => /affiliated/i.test(t) && !/patient/i.test(t))
    || transferTypes.find((t) => /testing/i.test(t))
    || transferTypes.find((t) => /transfer/i.test(t) && !/patient/i.test(t))
    || transferTypes[0];
  log(`Using transfer type: ${typeName}`);

  // Select up to 4 packages to transfer
  const TARGET = Math.min(4, packages.length);
  const toTransfer = packages.slice(0, TARGET);

  const transferPackages = toTransfer.map((pkg) => {
    const label = pkg.Label ?? pkg.PackageLabel;
    return {
      PackageLabel: label,
      WholesalePrice: /unaffiliated/i.test(typeName) ? 100 : undefined,
      GrossWeight: 50,
      GrossUnitOfWeightName: 'Grams',
    };
  }).filter((p) => p.PackageLabel);

  if (transferPackages.length === 0) {
    log('No valid package labels found. Skipping transfers.');
    return { transferred: 0, skipped: 0 };
  }

  // Build the transfer template payload
  // Templates require: Name, TransporterFacilityLicenseNumber,
  // Destinations[].Transporters[] with driver info, PlannedRoute
  const now = new Date();
  const departure = now.toISOString().slice(0, 10) + 'T08:00:00.000';
  const arrival = now.toISOString().slice(0, 10) + 'T14:00:00.000';

  const templateName = `Seed-${runId}-${Date.now().toString(36).slice(-4)}`;

  const templateBody = [{
    Name: templateName,
    TransporterFacilityLicenseNumber: fromLicense,
    Destinations: [{
      RecipientLicenseNumber: toLicense,
      TransferTypeName: typeName,
      PlannedRoute: 'Route A - Direct',
      EstimatedDepartureDateTime: departure,
      EstimatedArrivalDateTime: arrival,
      Transporters: [{
        TransporterFacilityLicenseNumber: fromLicense,
        TransporterDirection: 'Outbound',
        EstimatedDepartureDateTime: departure,
        EstimatedArrivalDateTime: arrival,
        DriverName: 'Seed Driver',
        DriverLicenseNumber: 'DL-000000',
        VehicleMake: 'Ford',
        VehicleModel: 'Transit',
        VehicleLicensePlateNumber: 'SEED-001',
      }],
      Packages: transferPackages,
    }],
  }];

  let transferred = 0;
  let skipped = 0;

  // Use the template endpoint — the only working transfer creation path
  try {
    await api('/transfers/v2/templates/outgoing', { licenseNumber: fromLicense }, {
      method: 'POST',
      body: templateBody,
    });
    transferred = transferPackages.length;
    log(`Created outgoing transfer template "${templateName}": ${transferred} packages (${fromLicense} -> ${toLicense})`);
  } catch (e) {
    log('Transfer template creation failed:', e.message?.slice(0, 100));
    skipped = transferPackages.length;

    // Provide actionable guidance
    if (e.message?.includes('401') || e.message?.includes('403')) {
      log('Note: This facility may not have transfer permissions. Check FacilityType.CanTransferFromExternalFacilities.');
    }
  }

  const summary = { transferred, skipped };
  log('Done.', JSON.stringify(summary));
  return summary;
}
