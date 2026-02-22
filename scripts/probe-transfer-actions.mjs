#!/usr/bin/env node
/**
 * Probe Massachusetts METRC sandbox for transfer acceptance/rejection endpoints.
 *
 * This script:
 * 1. Lists facilities to identify dispensary/retailer (most likely to have incoming transfers)
 * 2. Probes GET transfer endpoints to find existing transfers
 * 3. Probes PUT/POST endpoints for accept/reject capabilities
 * 4. Documents discovered payload schemas
 *
 * Usage:
 *   node scripts/probe-transfer-actions.mjs
 */

import { createMetrcFetch, getStateConfig } from './lib/metrc-fetch.mjs';

const { MA } = getStateConfig();
const maFetch = createMetrcFetch(MA);

const LICENSES = {
  cultivator: 'SF-SBX-MA-4-3301',
  lab: 'SF-SBX-MA-8-3301',
  dispensary: 'SF-SBX-MA-9-3301',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Safe probe — returns { ok, status, data, error } without throwing.
 */
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
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (text.slice(0, 500) || `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

function logResult(label, result) {
  const icon = result.ok ? '\u2705' : (result.status === 404 ? '\u26D4' : '\u274C');
  console.log(`  ${icon} ${label}: HTTP ${result.status}`);
  if (result.error) {
    console.log(`     Error: ${typeof result.error === 'string' ? result.error.slice(0, 200) : JSON.stringify(result.error).slice(0, 200)}`);
  }
  if (result.ok && result.data) {
    const summary = typeof result.data === 'string'
      ? result.data.slice(0, 200)
      : JSON.stringify(result.data).slice(0, 500);
    console.log(`     Data: ${summary}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('METRC Transfer Actions Probe — Massachusetts Sandbox');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // Phase 1: Verify connectivity and list facilities
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 1: Verify MA Sandbox Connectivity ---');
  const facilitiesRes = await safeProbe('/facilities/v2/');
  logResult('GET /facilities/v2/', facilitiesRes);

  if (facilitiesRes.ok) {
    const facilities = facilitiesRes.data?.Data || facilitiesRes.data || [];
    console.log(`  Found ${Array.isArray(facilities) ? facilities.length : 0} facilities`);
    if (Array.isArray(facilities)) {
      for (const f of facilities) {
        const license = f.License?.Number || f.LicenseNumber || '';
        const name = f.Name || f.FacilityName || '';
        const type = f.FacilityType?.Name || f.FacilityTypeName || '';
        console.log(`    - ${license}: ${name} (${type})`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Probe GET transfer endpoints on all facility types
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Probe Transfer GET Endpoints ---');

  for (const [label, license] of Object.entries(LICENSES)) {
    console.log(`\n  [${label.toUpperCase()} — ${license}]`);

    const endpoints = [
      '/transfers/v2/incoming',
      '/transfers/v2/outgoing',
      '/transfers/v2/rejected',
      '/transfers/v2/hub',
      '/transfers/v2/types',
      '/transfers/v2/delivery/packages/states',
    ];

    for (const ep of endpoints) {
      const res = await safeProbe(ep, { licenseNumber: license, page: 1, pageSize: 5 });
      logResult(`GET ${ep}`, res);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Discover transfer details (need transfer IDs for accept/reject)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: Find Incoming Transfers with Details ---');

  // Dispensary is most likely to have incoming transfers
  const dispensaryIncoming = await safeProbe('/transfers/v2/incoming', {
    licenseNumber: LICENSES.dispensary, page: 1, pageSize: 10,
  });

  let transferIds = [];
  if (dispensaryIncoming.ok) {
    const transfers = dispensaryIncoming.data?.Data || dispensaryIncoming.data || [];
    if (Array.isArray(transfers) && transfers.length > 0) {
      console.log(`  Found ${transfers.length} incoming transfers for dispensary`);
      for (const t of transfers.slice(0, 3)) {
        console.log(`    Transfer ID: ${t.Id}, Manifest: ${t.ManifestNumber}, State: ${t.ShipmentTransactionType}`);
        console.log(`      From: ${t.ShipperFacilityName} (${t.ShipperFacilityLicenseNumber})`);
        console.log(`      CreatedDate: ${t.CreatedDateTime}, ReceivedDate: ${t.ReceivedDateTime}`);
        console.log(`      Keys: ${Object.keys(t).join(', ')}`);
        transferIds.push(t.Id);
      }
    } else {
      console.log('  No incoming transfers found for dispensary');
    }
  }

  // Also check cultivator incoming
  const cultivatorIncoming = await safeProbe('/transfers/v2/incoming', {
    licenseNumber: LICENSES.cultivator, page: 1, pageSize: 10,
  });
  if (cultivatorIncoming.ok) {
    const transfers = cultivatorIncoming.data?.Data || cultivatorIncoming.data || [];
    if (Array.isArray(transfers) && transfers.length > 0) {
      console.log(`  Found ${transfers.length} incoming transfers for cultivator`);
      for (const t of transfers.slice(0, 3)) {
        console.log(`    Transfer ID: ${t.Id}, Manifest: ${t.ManifestNumber}`);
        transferIds.push(t.Id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 4: Probe transfer detail / delivery endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Probe Transfer Detail Endpoints ---');

  if (transferIds.length > 0) {
    const tid = transferIds[0];
    const detailEndpoints = [
      `/transfers/v2/${tid}`,
      `/transfers/v2/${tid}/deliveries`,
      `/transfers/v2/deliveries/${tid}/packages`,
      `/transfers/v2/deliveries/${tid}/packages/wholesale`,
    ];

    for (const ep of detailEndpoints) {
      const res = await safeProbe(ep, { licenseNumber: LICENSES.dispensary });
      logResult(`GET ${ep}`, res);
    }
  } else {
    console.log('  No transfer IDs available — skipping detail probes');
  }

  // -------------------------------------------------------------------------
  // Phase 5: Probe PUT/POST endpoints for accept/reject
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Probe Transfer Action Endpoints (PUT/POST) ---');
  console.log('  (Using empty payloads to discover endpoint existence via error messages)');

  // Candidate endpoints based on Metrc API patterns
  const writeEndpoints = [
    // Accept/reject patterns
    { method: 'PUT', path: '/transfers/v2/external/incoming', body: [] },
    { method: 'POST', path: '/transfers/v2/external/incoming', body: [] },
    { method: 'PUT', path: '/transfers/v2/incoming', body: [] },
    { method: 'POST', path: '/transfers/v2/incoming', body: [] },

    // With explicit accept/reject paths
    { method: 'PUT', path: '/transfers/v2/external/incoming/accept', body: [] },
    { method: 'PUT', path: '/transfers/v2/external/incoming/reject', body: [] },
    { method: 'POST', path: '/transfers/v2/external/incoming/accept', body: [] },
    { method: 'POST', path: '/transfers/v2/external/incoming/reject', body: [] },

    // Delivery-level accept/reject
    { method: 'PUT', path: '/transfers/v2/incoming/accept', body: [] },
    { method: 'PUT', path: '/transfers/v2/incoming/reject', body: [] },
    { method: 'POST', path: '/transfers/v2/deliveries/accept', body: [] },
    { method: 'POST', path: '/transfers/v2/deliveries/reject', body: [] },

    // Outgoing transfer endpoints (for comparison)
    { method: 'POST', path: '/transfers/v2/external/outgoing', body: [] },

    // Template-based patterns
    { method: 'PUT', path: '/transfers/v2/templates/incoming', body: [] },
    { method: 'PUT', path: '/transfers/v2/templates/outgoing', body: [] },
  ];

  for (const { method, path, body } of writeEndpoints) {
    const res = await safeProbe(path, { licenseNumber: LICENSES.dispensary }, { method, body });
    logResult(`${method} ${path}`, res);
  }

  // -------------------------------------------------------------------------
  // Phase 6: If we found a transfer, try with real payload variations
  // -------------------------------------------------------------------------
  if (transferIds.length > 0) {
    console.log('\n--- Phase 6: Probe Accept/Reject with Transfer Data ---');
    const tid = transferIds[0];

    const payloadVariations = [
      // Variation 1: Simple ID-based acceptance
      {
        label: 'PUT incoming with [{TransferId}]',
        method: 'PUT',
        path: '/transfers/v2/external/incoming',
        body: [{ TransferId: tid }],
      },
      // Variation 2: ID + Action
      {
        label: 'PUT incoming with [{TransferId, Action: "Accept"}]',
        method: 'PUT',
        path: '/transfers/v2/external/incoming',
        body: [{ TransferId: tid, Action: 'Accept' }],
      },
      // Variation 3: Rejection with reason
      {
        label: 'PUT incoming with [{TransferId, Action: "Reject", Reason: "test"}]',
        method: 'PUT',
        path: '/transfers/v2/external/incoming',
        body: [{ TransferId: tid, Action: 'Reject', Reason: 'test probe' }],
      },
      // Variation 4: ManifestNumber-based
      {
        label: 'PUT incoming with [{ManifestNumber}]',
        method: 'PUT',
        path: '/transfers/v2/external/incoming',
        body: [{ ManifestNumber: tid }],
      },
    ];

    for (const { label, method, path, body } of payloadVariations) {
      const res = await safeProbe(path, { licenseNumber: LICENSES.dispensary }, { method, body });
      logResult(label, res);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 7: Check for rejected transfers (confirms reject capability exists)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 7: Rejected Transfers Endpoint ---');
  for (const [label, license] of Object.entries(LICENSES)) {
    const res = await safeProbe('/transfers/v2/rejected', { licenseNumber: license, page: 1, pageSize: 5 });
    logResult(`GET /transfers/v2/rejected [${label}]`, res);
    if (res.ok) {
      const data = res.data?.Data || res.data || [];
      console.log(`    Total: ${res.data?.Total || (Array.isArray(data) ? data.length : 0)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Probe complete.');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
