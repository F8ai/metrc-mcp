#!/usr/bin/env node
/**
 * Transfer Actions Probe v2 — Deep endpoint discovery + seed transfer flow.
 *
 * Phase 1: Check package/tag availability across MA facilities
 * Phase 2: Probe delivery-level accept/reject endpoints
 * Phase 3: Probe PUT external/incoming with different license types
 * Phase 4: Get full transfer type details for payload construction
 */

import { createMetrcFetch, getStateConfig } from './lib/metrc-fetch.mjs';

const { MA } = getStateConfig();
const maFetch = createMetrcFetch(MA);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeProbe(path, params = {}, options = {}) {
  const url = new URL(path, MA.baseUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const creds = Buffer.from(`${MA.vendorKey}:${MA.userKey}`).toString('base64');
  const init = {
    method: options.method || 'GET',
    headers: { Authorization: `Basic ${creds}` },
  };
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  try {
    await sleep(300);
    const res = await fetch(url.toString(), init);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (text.slice(0, 800) || `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

function logResult(label, result) {
  const icon = result.ok ? '\u2705' : (result.status === 404 ? '\u26D4' : '\u274C');
  console.log(`  ${icon} ${label}: HTTP ${result.status}`);
  if (result.error) {
    const errStr = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
    console.log(`     Error: ${errStr.slice(0, 300)}`);
  }
  if (result.ok && result.data) {
    const summary = typeof result.data === 'string'
      ? result.data.slice(0, 300)
      : JSON.stringify(result.data).slice(0, 500);
    console.log(`     Data: ${summary}`);
  }
}

// All MA facility licenses
const LICENSES = {
  'craft-coop': 'SF-SBX-MA-1-3301',
  'test-lab': 'SF-SBX-MA-2-3301',
  'courier': 'SF-SBX-MA-3-3301',
  'cultivator': 'SF-SBX-MA-4-3301',
  'delivery-op': 'SF-SBX-MA-5-3301',
  'microbusiness': 'SF-SBX-MA-6-3301',
  'manufacturer': 'SF-SBX-MA-7-3301',
  'research': 'SF-SBX-MA-8-3301',
  'retailer': 'SF-SBX-MA-9-3301',
  'transporter': 'SF-SBX-MA-10-3301',
};

async function main() {
  console.log('='.repeat(80));
  console.log('METRC Transfer Actions Probe v2 — Massachusetts Sandbox');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // Phase 1: Check package + tag availability for seeding a transfer
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 1: Package + Tag Availability ---');

  for (const [label, license] of Object.entries(LICENSES)) {
    if (!['cultivator', 'manufacturer', 'microbusiness', 'retailer', 'craft-coop'].includes(label)) continue;

    console.log(`\n  [${label.toUpperCase()} — ${license}]`);

    const pkgRes = await safeProbe('/packages/v2/active', { licenseNumber: license, page: 1, pageSize: 3 });
    const total = pkgRes.ok ? (pkgRes.data?.Total || 0) : 'error';
    console.log(`    Active Packages: ${total}`);

    if (pkgRes.ok && pkgRes.data?.Data?.length > 0) {
      for (const p of pkgRes.data.Data.slice(0, 2)) {
        console.log(`      - ${p.Label}: ${p.ItemName} (qty: ${p.Quantity} ${p.UnitOfMeasureName})`);
      }
    }

    const tagRes = await safeProbe('/tags/v2/package/available', { licenseNumber: license, page: 1, pageSize: 1 });
    const tagCount = tagRes.ok ? (tagRes.data?.Total || 0) : 'error';
    console.log(`    Available Package Tags: ${tagCount}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Get full transfer type details for ALL facilities
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Transfer Types per Facility ---');

  for (const [label, license] of Object.entries(LICENSES)) {
    if (!['cultivator', 'manufacturer', 'retailer', 'microbusiness', 'craft-coop'].includes(label)) continue;

    const typesRes = await safeProbe('/transfers/v2/types', { licenseNumber: license });
    if (typesRes.ok) {
      const types = typesRes.data?.Data || typesRes.data || [];
      console.log(`\n  [${label.toUpperCase()} — ${license}] — ${Array.isArray(types) ? types.length : '?'} types`);
      if (Array.isArray(types)) {
        for (const t of types) {
          const flags = [];
          if (t.ForLicensedShipments) flags.push('Licensed');
          if (t.ForExternalIncomingShipments) flags.push('ExtIncoming');
          if (t.ForExternalOutgoingShipments) flags.push('ExtOutgoing');
          if (t.BypassApproval) flags.push('BypassApproval');
          console.log(`    - "${t.Name}" (${t.TransactionType}) [${flags.join(', ')}]`);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Try PUT external/incoming on ALL facility types
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: PUT external/incoming on Each Facility Type ---');

  for (const [label, license] of Object.entries(LICENSES)) {
    const res = await safeProbe('/transfers/v2/external/incoming', { licenseNumber: license }, { method: 'PUT', body: [] });
    const icon = res.status === 401 ? '🔒' : (res.status === 404 ? '\u26D4' : res.ok ? '\u2705' : '\u274C');
    console.log(`  ${icon} PUT external/incoming [${label}]: HTTP ${res.status}`);
    if (res.error) {
      const errStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
      console.log(`     ${errStr.slice(0, 200)}`);
    }
    if (res.ok) {
      console.log(`     Data: ${JSON.stringify(res.data).slice(0, 200)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 4: Probe delivery-level action endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Delivery-Level Action Endpoints ---');

  // These might be the real accept/reject paths
  const deliveryEndpoints = [
    { method: 'PUT', path: '/transfers/v2/deliveries/packages' },
    { method: 'POST', path: '/transfers/v2/deliveries/packages' },
    { method: 'PUT', path: '/transfers/v2/deliveries/packages/accept' },
    { method: 'PUT', path: '/transfers/v2/deliveries/packages/reject' },
    { method: 'POST', path: '/transfers/v2/deliveries/packages/accept' },
    { method: 'POST', path: '/transfers/v2/deliveries/packages/reject' },
    { method: 'PUT', path: '/transfers/v2/deliveries/package' },
    { method: 'PUT', path: '/transfers/v2/deliveries/package/accept' },
    { method: 'PUT', path: '/transfers/v2/deliveries/package/reject' },
    // Partial acceptance patterns
    { method: 'PUT', path: '/transfers/v2/deliveries/packages/states' },
    { method: 'POST', path: '/transfers/v2/deliveries/packages/states' },
    // External incoming specific
    { method: 'PUT', path: '/transfers/v2/external/incoming/packages' },
  ];

  for (const { method, path } of deliveryEndpoints) {
    const res = await safeProbe(path, { licenseNumber: LICENSES.retailer }, { method, body: [] });
    logResult(`${method} ${path}`, res);
  }

  // -------------------------------------------------------------------------
  // Phase 5: Try creating an outgoing transfer (cultivator → retailer)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Attempt Outgoing Transfer Creation ---');

  // First check if cultivator has any packages
  const cultivatorPkgs = await safeProbe('/packages/v2/active', { licenseNumber: LICENSES.cultivator, page: 1, pageSize: 5 });

  if (cultivatorPkgs.ok && cultivatorPkgs.data?.Data?.length > 0) {
    const pkg = cultivatorPkgs.data.Data[0];
    console.log(`  Using package: ${pkg.Label} (${pkg.ItemName}, qty: ${pkg.Quantity})`);

    // Try creating a licensed (internal) transfer first since external outgoing was 404
    const transferPayload = [{
      ShipperLicenseNumber: LICENSES.cultivator,
      ShipperName: 'Sandbox Marijuana Cultivator',
      ShipperMainPhoneNumber: '555-555-5555',
      ShipperAddress1: '123 Test St',
      ShipperAddress2: '',
      ShipperAddressCity: 'Boston',
      ShipperAddressState: 'MA',
      ShipperAddressPostalCode: '02101',
      TransporterFacilityLicenseNumber: '',
      DriverOccupationalLicenseNumber: '',
      DriverName: '',
      DriverLicenseNumber: '',
      PhoneNumberForQuestions: '555-555-5555',
      VehicleMake: '',
      VehicleModel: '',
      VehicleLicensePlateNumber: '',
      Destinations: [{
        RecipientLicenseNumber: LICENSES.retailer,
        TransferTypeName: 'Affiliated Transfer',
        PlannedRoute: 'Direct delivery',
        EstimatedDepartureDateTime: new Date().toISOString(),
        EstimatedArrivalDateTime: new Date(Date.now() + 86400000).toISOString(),
        Transporters: [],
        Packages: [{
          PackageLabel: pkg.Label,
          WholesalePrice: 100.00,
          GrossWeight: null,
          GrossUnitOfWeightId: null,
        }],
      }],
    }];

    // Try POST /transfers/v2/licensed (standard transfer between licensed facilities)
    const licensedRes = await safeProbe('/transfers/v2/licensed', { licenseNumber: LICENSES.cultivator }, { method: 'POST', body: transferPayload });
    logResult('POST /transfers/v2/licensed', licensedRes);

    // Also try the external outgoing on cultivator (not dispensary)
    const extOutRes = await safeProbe('/transfers/v2/external/outgoing', { licenseNumber: LICENSES.cultivator }, { method: 'POST', body: transferPayload });
    logResult('POST /transfers/v2/external/outgoing [cultivator]', extOutRes);
  } else {
    console.log('  No active packages on cultivator — cannot create test transfer');
    console.log('  Run: node scripts/seed-demo.mjs --state MA to seed demo data first');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Probe v2 complete.');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
