#!/usr/bin/env node
/**
 * Transfer Actions Probe v3 — Create a licensed transfer and test accept/reject.
 *
 * Now that MA sandbox has packages, we can:
 * 1. Create a licensed transfer (cultivator → retailer)
 * 2. Verify it appears in retailer's incoming list
 * 3. Try accept/reject endpoints
 */

import { createMetrcFetch, getStateConfig } from './lib/metrc-fetch.mjs';

const { MA } = getStateConfig();
const maFetch = createMetrcFetch(MA);

const CULTIVATOR = 'SF-SBX-MA-4-3301';
const RETAILER = 'SF-SBX-MA-9-3301';

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
    console.log(`     Error: ${errStr.slice(0, 400)}`);
  }
  if (result.ok && result.data) {
    const summary = typeof result.data === 'string'
      ? result.data.slice(0, 400)
      : JSON.stringify(result.data).slice(0, 600);
    console.log(`     Data: ${summary}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('METRC Transfer Actions Probe v3 — Licensed Transfer Flow');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // Phase 1: Get cultivator packages
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 1: Cultivator Packages ---');
  const pkgRes = await safeProbe('/packages/v2/active', { licenseNumber: CULTIVATOR, page: 1, pageSize: 10 });
  if (!pkgRes.ok || !pkgRes.data?.Data?.length) {
    console.log('  No packages available. Run seed-demo.mjs --state MA first.');
    return;
  }
  const packages = pkgRes.data.Data;
  console.log(`  Found ${pkgRes.data.Total} active packages`);
  for (const p of packages.slice(0, 4)) {
    console.log(`    - ${p.Label}: ${p.ItemName} (qty: ${p.Quantity} ${p.UnitOfMeasureName})`);
  }

  const testPkg = packages[0];
  console.log(`\n  Test package: ${testPkg.Label}`);

  // -------------------------------------------------------------------------
  // Phase 2: Probe ALL write transfer endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Discover Transfer Write Endpoints ---');

  const now = new Date();
  const departure = now.toISOString();
  const arrival = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  // Standard licensed transfer payload
  const licensedPayload = [{
    ShipperLicenseNumber: CULTIVATOR,
    TransporterLicenseNumber: CULTIVATOR,
    TransferTypeName: 'Affiliated Transfer',
    EstimatedDepartureDateTime: departure,
    EstimatedArrivalDateTime: arrival,
    Destinations: [{
      RecipientLicenseNumber: RETAILER,
      TransferTypeName: 'Affiliated Transfer',
      EstimatedArrivalDateTime: arrival,
      Packages: [{
        PackageLabel: testPkg.Label,
        WholesalePrice: 100,
      }],
    }],
  }];

  // Try various transfer creation endpoints
  const createEndpoints = [
    { method: 'POST', path: '/transfers/v2/licensed', label: 'licensed (standard)' },
    { method: 'POST', path: '/transfers/v1/external/outgoing', label: 'v1 external outgoing' },
    { method: 'POST', path: '/transfers/v2/external/outgoing', label: 'v2 external outgoing' },
    { method: 'POST', path: '/transfers/v2/templates', label: 'templates' },
  ];

  let transferCreated = false;

  for (const { method, path, label } of createEndpoints) {
    const res = await safeProbe(path, { licenseNumber: CULTIVATOR }, { method, body: licensedPayload });
    logResult(`${method} ${path} [${label}]`, res);
    if (res.ok) {
      transferCreated = true;
      console.log(`  >>> Transfer created via ${path}!`);
      break;
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Check retailer incoming
  // -------------------------------------------------------------------------
  if (transferCreated) {
    console.log('\n--- Phase 3: Check Retailer Incoming Transfers ---');
    await sleep(2000); // Wait for propagation

    const incomingRes = await safeProbe('/transfers/v2/incoming', { licenseNumber: RETAILER, page: 1, pageSize: 10 });
    logResult('GET /transfers/v2/incoming [retailer]', incomingRes);

    if (incomingRes.ok && incomingRes.data?.Data?.length > 0) {
      const transfers = incomingRes.data.Data;
      console.log(`  Found ${transfers.length} incoming transfers`);
      for (const t of transfers) {
        console.log(`    Transfer ID: ${t.Id}`);
        console.log(`    Manifest: ${t.ManifestNumber}`);
        console.log(`    Keys: ${Object.keys(t).join(', ')}`);
        console.log(`    Full: ${JSON.stringify(t).slice(0, 500)}`);

        // Try to get delivery details
        const deliveriesRes = await safeProbe(`/transfers/v2/${t.Id}/deliveries`, { licenseNumber: RETAILER });
        logResult(`GET /transfers/v2/${t.Id}/deliveries`, deliveriesRes);

        if (deliveriesRes.ok) {
          const deliveries = deliveriesRes.data?.Data || deliveriesRes.data || [];
          if (Array.isArray(deliveries)) {
            for (const d of deliveries) {
              console.log(`      Delivery ID: ${d.Id}, Keys: ${Object.keys(d).join(', ')}`);

              // Get packages in delivery
              const dpRes = await safeProbe(`/transfers/v2/deliveries/${d.Id}/packages`, { licenseNumber: RETAILER });
              logResult(`GET /transfers/v2/deliveries/${d.Id}/packages`, dpRes);
            }
          }
        }
      }

      // -------------------------------------------------------------------------
      // Phase 4: Try accept/reject on the transfer
      // -------------------------------------------------------------------------
      console.log('\n--- Phase 4: Try Accept/Reject Endpoints ---');
      const transfer = transfers[0];

      // Try delivery-level acceptance with various payload shapes
      const acceptVariations = [
        {
          label: 'PUT external/incoming [{TransferId}]',
          method: 'PUT', path: '/transfers/v2/external/incoming',
          body: [{ TransferId: transfer.Id }],
        },
        {
          label: 'PUT external/incoming [{Id}]',
          method: 'PUT', path: '/transfers/v2/external/incoming',
          body: [{ Id: transfer.Id }],
        },
        {
          label: 'PUT external/incoming [{ManifestNumber}]',
          method: 'PUT', path: '/transfers/v2/external/incoming',
          body: [{ ManifestNumber: transfer.ManifestNumber }],
        },
      ];

      for (const { label, method, path, body } of acceptVariations) {
        const res = await safeProbe(path, { licenseNumber: RETAILER }, { method, body });
        logResult(label, res);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5: Also check outgoing on cultivator (to confirm transfer appeared)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Check Cultivator Outgoing Transfers ---');
  const outRes = await safeProbe('/transfers/v2/outgoing', { licenseNumber: CULTIVATOR, page: 1, pageSize: 10 });
  logResult('GET /transfers/v2/outgoing [cultivator]', outRes);
  if (outRes.ok) {
    const outTransfers = outRes.data?.Data || [];
    console.log(`  Total outgoing: ${outRes.data?.Total || 0}`);
    for (const t of outTransfers.slice(0, 3)) {
      console.log(`    ID: ${t.Id}, Manifest: ${t.ManifestNumber}`);
      console.log(`    Keys: ${Object.keys(t).join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 6: Exhaustive v1 endpoint probing
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 6: V1 Transfer Endpoints ---');
  const v1Endpoints = [
    { method: 'GET', path: '/transfers/v1/incoming' },
    { method: 'GET', path: '/transfers/v1/outgoing' },
    { method: 'GET', path: '/transfers/v1/rejected' },
    { method: 'GET', path: '/transfers/v1/types' },
    { method: 'POST', path: '/transfers/v1/external/outgoing' },
    { method: 'POST', path: '/transfers/v1/external/incoming' },
    { method: 'PUT', path: '/transfers/v1/external/incoming' },
  ];

  for (const { method, path } of v1Endpoints) {
    const body = method !== 'GET' ? [] : undefined;
    const res = await safeProbe(path, { licenseNumber: CULTIVATOR }, method !== 'GET' ? { method, body } : {});
    logResult(`${method} ${path}`, res);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Probe v3 complete.');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
