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
  const allPackages = (await api('/packages/v2/active', { licenseNumber: fromLicense })).Data || [];
  if (allPackages.length === 0) {
    log('No active packages on source facility. Skipping transfers.');
    return { transferred: 0, skipped: 0 };
  }
  log(`Found ${allPackages.length} active packages on source facility`);

  // Filter out packages marked as NotSubmitted (MA regulation — packages need
  // submission/approval before transfer). Also skip packages already in transit.
  let packages = allPackages.filter((pkg) => {
    if (pkg.SubmittedDate === null && pkg.SubmittedDateTime === null) return false;
    if (pkg.IsInTransit === true) return false;
    return true;
  });

  if (packages.length === 0) {
    // Fall back to all packages if the filter was too aggressive (CO doesn't have SubmittedDate)
    if (allPackages.length > 0 && allPackages[0].SubmittedDate === undefined) {
      log('No SubmittedDate field — using all packages (likely CO sandbox)');
      packages = allPackages;
    } else {
      log(`All ${allPackages.length} packages are NotSubmitted or in transit. Skipping transfers.`);
      return { transferred: 0, skipped: 0 };
    }
  } else {
    log(`${packages.length} packages eligible for transfer (${allPackages.length - packages.length} filtered out)`);
  }

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
    const errMsg = e.message || '';

    // MA-specific: packages in "NotSubmitted" state can't be transferred.
    // The NotSubmitted flag isn't exposed in GET responses, so we can only
    // detect it from the transfer creation error. Try with older packages
    // (which may have been auto-submitted over time).
    if (errMsg.includes('NotSubmitted')) {
      log('Packages are NotSubmitted (MA regulation). Trying older packages...');
      const olderPackages = packages.slice(TARGET).slice(0, TARGET);
      if (olderPackages.length > 0) {
        const retryPkgs = olderPackages.map((pkg) => ({
          PackageLabel: pkg.Label ?? pkg.PackageLabel,
          WholesalePrice: /unaffiliated/i.test(typeName) ? 100 : undefined,
          GrossWeight: 50,
          GrossUnitOfWeightName: 'Grams',
        })).filter((p) => p.PackageLabel);

        const retryName = `Seed-${runId}-${Date.now().toString(36).slice(-4)}`;
        const retryBody = JSON.parse(JSON.stringify(templateBody));
        retryBody[0].Name = retryName;
        retryBody[0].Destinations[0].Packages = retryPkgs;

        try {
          await api('/transfers/v2/templates/outgoing', { licenseNumber: fromLicense }, {
            method: 'POST',
            body: retryBody,
          });
          transferred = retryPkgs.length;
          log(`Created outgoing transfer template "${retryName}": ${transferred} packages (retry with older pkgs)`);
        } catch (e2) {
          log('Retry also failed:', e2.message?.slice(0, 100));
          log('Note: MA sandbox packages may all be NotSubmitted. This is a state-specific regulation.');
          skipped = transferPackages.length;
        }
      } else {
        log('No older packages to try. All packages may be NotSubmitted.');
        skipped = transferPackages.length;
      }
    } else {
      log('Transfer template creation failed:', errMsg.slice(0, 100));
      skipped = transferPackages.length;

      if (errMsg.includes('401') || errMsg.includes('403')) {
        log('Note: This facility may not have transfer permissions.');
      }
    }
  }

  const summary = { transferred, skipped };
  log('Done.', JSON.stringify(summary));
  return summary;
}
