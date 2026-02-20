#!/usr/bin/env node
/**
 * Transfer seeder.
 *
 * Transfers packages from one facility (e.g. cultivator) to another
 * (e.g. dispensary) using the METRC transfer API.
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

  // Pick a transfer type — prefer one containing "Transfer" or "Wholesale", else first
  const typeName = transferTypes.find((t) => /transfer/i.test(t))
    || transferTypes.find((t) => /wholesale/i.test(t))
    || transferTypes[0];
  log(`Using transfer type: ${typeName}`);

  // Select up to 4 packages to transfer
  const TARGET = Math.min(4, packages.length);
  const toTransfer = packages.slice(0, TARGET);

  const transferPackages = toTransfer.map((pkg) => {
    const label = pkg.Label ?? pkg.PackageLabel;
    return { PackageLabel: label, WholesalePrice: 100 };
  }).filter((p) => p.PackageLabel);

  if (transferPackages.length === 0) {
    log('No valid package labels found. Skipping transfers.');
    return { transferred: 0, skipped: 0 };
  }

  // Build the transfer payload
  const now = new Date();
  const departure = now.toISOString();
  const arrival = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // +2 hours

  const transferBody = [{
    ShipperLicenseNumber: fromLicense,
    TransporterLicenseNumber: fromLicense,
    TransferTypeName: typeName,
    EstimatedDepartureDateTime: departure,
    EstimatedArrivalDateTime: arrival,
    Destinations: [{
      RecipientLicenseNumber: toLicense,
      TransferTypeName: typeName,
      EstimatedArrivalDateTime: arrival,
      Packages: transferPackages,
    }],
  }];

  let transferred = 0;
  let skipped = 0;

  // Try shipper-side external outgoing endpoint first
  try {
    await api('/transfers/v2/external/outgoing', { licenseNumber: fromLicense }, {
      method: 'POST',
      body: transferBody,
    });
    transferred = transferPackages.length;
    log(`Created outgoing transfer: ${transferred} packages (${fromLicense} -> ${toLicense})`);
  } catch (e) {
    log('Outgoing transfer failed:', e.message?.slice(0, 100));

    // Fallback: try external incoming from receiver side
    try {
      const incomingBody = [{
        ShipperLicenseNumber: fromLicense,
        TransporterLicenseNumber: fromLicense,
        TransferTypeName: typeName,
        EstimatedDepartureDateTime: departure,
        EstimatedArrivalDateTime: arrival,
        Packages: transferPackages,
      }];

      await api('/transfers/v2/external/incoming', { licenseNumber: toLicense }, {
        method: 'POST',
        body: incomingBody,
      });
      transferred = transferPackages.length;
      log(`Created incoming transfer: ${transferred} packages (${fromLicense} -> ${toLicense})`);
    } catch (e2) {
      log('Incoming transfer also failed:', e2.message?.slice(0, 100));
      skipped = transferPackages.length;

      // Detect sandbox limitation vs real error
      const isServerError = [e.message, e2.message].some((m) => m?.includes('unexpected error') || m?.includes('HTTP 401'));
      if (isServerError) {
        log('Note: METRC sandbox has known limitations with transfer endpoints (401/500 errors).');
        log('Transfers may only work when both facilities have full API permissions.');
      }
    }
  }

  const summary = { transferred, skipped };
  log('Done.', JSON.stringify(summary));
  return summary;
}
