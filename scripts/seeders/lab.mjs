#!/usr/bin/env node
/**
 * Lab facility seeder.
 *
 * Records lab test results on existing active packages.
 * Creates 4 test profiles: pass-clean, pass-highcbd, fail-metals, fail-micro.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @returns {Promise<object>} Summary of recorded tests
 */

const today = new Date().toISOString().slice(0, 10);

/**
 * Lab test result profiles.
 *
 * Uses generic METRC lab test type names. The sandbox may require
 * state-specific names — if recording fails, the error is logged
 * and the seeder continues.
 */
const LAB_PROFILES = [
  {
    label: 'pass-clean',
    overallPassed: true,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 22.5 },
      { name: 'Total CBD (%) Raw Plant Material', value: 0.8 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 10.5 },
      { name: 'Water Activity (Aw) Raw Plant Material', value: 0.55 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 0 },
      { name: 'Lead (ppm) Raw Plant Material', value: 0 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 500 },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 0 },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
  {
    label: 'pass-highcbd',
    overallPassed: true,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 5.2 },
      { name: 'Total CBD (%) Raw Plant Material', value: 14.8 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 11.0 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 0 },
      { name: 'Lead (ppm) Raw Plant Material', value: 0 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 200 },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 0 },
    ],
  },
  {
    label: 'fail-metals',
    overallPassed: false,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 18.3 },
      { name: 'Arsenic (ppm) Raw Plant Material', value: 2.5, passed: false },
      { name: 'Cadmium (ppm) Raw Plant Material', value: 1.8, passed: false },
      { name: 'Lead (ppm) Raw Plant Material', value: 3.2, passed: false },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 300 },
    ],
  },
  {
    label: 'fail-micro',
    overallPassed: false,
    results: [
      { name: 'Total THC (%) Raw Plant Material', value: 25.1 },
      { name: 'Moisture Content (%) Raw Plant Material', value: 14.5 },
      { name: 'Total Yeast and Mold (CFU/g) Raw Plant Material', value: 50000, passed: false },
      { name: 'E.coli (CFU/g) Raw Plant Material', value: 150, passed: false },
      { name: 'Salmonella (CFU/g) Raw Plant Material', value: 1, passed: false },
    ],
  },
];

function log(prefix, msg, data) {
  const line = data !== undefined
    ? `[${prefix}] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[${prefix}] ${msg}`;
  console.log(line);
}

/**
 * Discover the correct lab test type names for a facility.
 * Falls back to the hardcoded profile names if the types endpoint fails.
 */
async function discoverLabTestTypes(api, license) {
  try {
    const resp = await api('/labtests/v2/types', { licenseNumber: license });
    const types = resp?.Data || resp || [];
    if (Array.isArray(types) && types.length > 0) {
      const names = types.map((t) => t.Name).filter(Boolean);
      log('Lab', `Discovered ${names.length} lab test types`);
      return names;
    }
  } catch (e) {
    log('Lab', 'Lab test types lookup failed:', e.message?.slice(0, 80));
  }
  return null;
}

/**
 * Main lab seeder entry point.
 */
export async function seedLab(api, license, runId) {
  log('Lab', `Starting seed (license: ${license}, runId: ${runId})`);

  // Get active packages to test
  const packages = (await api('/packages/v2/active', { licenseNumber: license })).Data || [];
  if (packages.length === 0) {
    log('Lab', 'No active packages found. Skipping lab tests.');
    return { tested: 0, passed: 0, failed: 0, skipped: 0 };
  }

  log('Lab', `Found ${packages.length} active packages`);

  // Discover available lab test type names (informational)
  await discoverLabTestTypes(api, license);

  let tested = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Apply profiles in rotation across packages (up to 4)
  const TARGET = Math.min(4, packages.length);
  for (let i = 0; i < TARGET; i++) {
    const pkg = packages[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) { skipped++; continue; }

    const profile = LAB_PROFILES[i % LAB_PROFILES.length];
    const results = profile.results.map((r) => ({
      LabTestTypeName: r.name,
      Quantity: r.value,
      Passed: r.passed !== undefined ? r.passed : profile.overallPassed,
      Notes: '',
    }));

    try {
      await api('/labtests/v2/record', { licenseNumber: license }, {
        method: 'POST',
        body: [{
          Label: label,
          ResultDate: today,
          Results: results,
          OverallPassed: profile.overallPassed,
        }],
      });
      tested++;
      if (profile.overallPassed) passed++;
      else failed++;
      log('Lab', `Recorded [${profile.label}] on ${label}`);
    } catch (e) {
      skipped++;
      log('Lab', `Test on ${label} skipped:`, e.message?.slice(0, 100));
    }
  }

  const summary = { tested, passed, failed, skipped };
  log('Lab', 'Done.', JSON.stringify(summary));
  return summary;
}
