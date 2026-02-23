#!/usr/bin/env node
/**
 * Lab facility seeder.
 *
 * Records lab test results on existing active packages.
 * Creates 4 test profiles: pass-clean, pass-highcbd, fail-metals, fail-micro.
 *
 * Dynamically discovers lab test type names from the METRC API and maps
 * generic analyte categories to state-specific names. Falls back to
 * hardcoded MA-style names if discovery returns nothing useful.
 *
 * NOTE (confirmed by Metrc support, case #02372700, Feb 2026):
 *   Only facilities with CanTestPackages=true (lab/testing facility types) can
 *   call POST /labtests/v2/record. Non-lab facilities get HTTP 401.
 *   Packages must also be physically present at the lab facility.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} [options] - Optional configuration
 * @param {string} [options.facilityType] - Facility type (e.g. 'Testing Lab', 'Cultivator')
 * @param {boolean} [options.canTestPackages] - Whether facility has CanTestPackages permission
 * @returns {Promise<object>} Summary of recorded tests
 */

const today = new Date().toISOString().slice(0, 10);

/**
 * Generic analyte definitions used to build test profiles.
 * Each has keywords used to match against discovered lab test type names.
 */
const ANALYTE_DEFS = {
  thc:      { keywords: ['total thc'],                   defaultName: 'Total THC (%) Raw Plant Material' },
  cbd:      { keywords: ['total cbd'],                   defaultName: 'Total CBD (%) Raw Plant Material' },
  moisture: { keywords: ['moisture content'],             defaultName: 'Moisture Content (%) Raw Plant Material' },
  water:    { keywords: ['water activity'],               defaultName: 'Water Activity (Aw) Raw Plant Material' },
  arsenic:  { keywords: ['arsenic'],                      defaultName: 'Arsenic (ppm) Raw Plant Material' },
  lead:     { keywords: ['lead'],                         defaultName: 'Lead (ppm) Raw Plant Material' },
  cadmium:  { keywords: ['cadmium'],                      defaultName: 'Cadmium (ppm) Raw Plant Material' },
  yeast:    { keywords: ['total yeast and mold', 'yeast'],defaultName: 'Total Yeast and Mold (CFU/g) Raw Plant Material' },
  ecoli:    { keywords: ['e.coli', 'e coli'],             defaultName: 'E.coli (CFU/g) Raw Plant Material' },
  salm:     { keywords: ['salmonella'],                   defaultName: 'Salmonella (CFU/g) Raw Plant Material' },
};

function log(prefix, msg, data) {
  const line = data !== undefined
    ? `[${prefix}] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[${prefix}] ${msg}`;
  console.log(line);
}

/**
 * Discover the correct lab test type names for a facility and build
 * a mapping from generic analyte key to actual METRC type name.
 */
async function discoverLabTestTypes(api, license) {
  const mapping = {};

  try {
    const resp = await api('/labtests/v2/types', { licenseNumber: license });
    const types = resp?.Data || resp || [];
    if (Array.isArray(types) && types.length > 0) {
      const names = types.map((t) => t.Name).filter(Boolean);
      log('Lab', `Discovered ${names.length} lab test types`);

      // Match each analyte to the best discovered type name.
      // Prefer "Raw Plant Material" variants (compatible with plant-based packages).
      for (const [key, def] of Object.entries(ANALYTE_DEFS)) {
        const lower = def.keywords.map((k) => k.toLowerCase());
        const matches = names.filter((n) => {
          const nl = n.toLowerCase();
          return lower.some((kw) => nl.includes(kw));
        });
        // Prefer Raw Plant Material, then any match, then default
        const preferred = matches.find((n) => n.includes('Raw Plant Material'))
          || matches.find((n) => n.includes('Plant Material'))
          || matches[0];
        mapping[key] = preferred || def.defaultName;
      }

      // Log any analytes that fell back to defaults
      const fallbacks = Object.entries(mapping).filter(([key, name]) => name === ANALYTE_DEFS[key].defaultName);
      if (fallbacks.length > 0) {
        log('Lab', `Using default names for: ${fallbacks.map(([k]) => k).join(', ')}`);
      }

      return mapping;
    }
  } catch (e) {
    log('Lab', 'Lab test types lookup failed:', e.message?.slice(0, 80));
  }

  // Fall back to all defaults
  for (const [key, def] of Object.entries(ANALYTE_DEFS)) {
    mapping[key] = def.defaultName;
  }
  log('Lab', 'Using all default (MA-style) lab test type names');
  return mapping;
}

/**
 * Build lab test profiles using the discovered type name mapping.
 */
function buildProfiles(m) {
  return [
    {
      label: 'pass-clean',
      overallPassed: true,
      results: [
        { name: m.thc, value: 22.5 },
        { name: m.cbd, value: 0.8 },
        { name: m.moisture, value: 10.5 },
        { name: m.water, value: 0.55 },
        { name: m.arsenic, value: 0 },
        { name: m.lead, value: 0 },
        { name: m.yeast, value: 500 },
        { name: m.ecoli, value: 0 },
        { name: m.salm, value: 0 },
      ],
    },
    {
      label: 'pass-highcbd',
      overallPassed: true,
      results: [
        { name: m.thc, value: 5.2 },
        { name: m.cbd, value: 14.8 },
        { name: m.moisture, value: 11.0 },
        { name: m.arsenic, value: 0 },
        { name: m.lead, value: 0 },
        { name: m.yeast, value: 200 },
        { name: m.ecoli, value: 0 },
      ],
    },
    {
      label: 'fail-metals',
      overallPassed: false,
      results: [
        { name: m.thc, value: 18.3 },
        { name: m.arsenic, value: 2.5, passed: false },
        { name: m.cadmium, value: 1.8, passed: false },
        { name: m.lead, value: 3.2, passed: false },
        { name: m.yeast, value: 300 },
      ],
    },
    {
      label: 'fail-micro',
      overallPassed: false,
      results: [
        { name: m.thc, value: 25.1 },
        { name: m.moisture, value: 14.5 },
        { name: m.yeast, value: 50000, passed: false },
        { name: m.ecoli, value: 150, passed: false },
        { name: m.salm, value: 1, passed: false },
      ],
    },
  ];
}

/**
 * Lab facility type names that can record test results.
 */
const LAB_FACILITY_TYPES = [
  'testing lab', 'lab', 'research', 'testing',
  'retail testing lab', 'medical testing lab',
];

/**
 * Main lab seeder entry point.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @param {object} [options] - Optional configuration
 * @param {string} [options.facilityType] - Facility type name
 * @param {boolean} [options.canTestPackages] - CanTestPackages flag from METRC API
 */
export async function seedLab(api, license, runId, options = {}) {
  log('Lab', `Starting seed (license: ${license}, runId: ${runId})`);

  // Guard: only lab/testing facilities can call POST /labtests/v2/record
  const { facilityType, canTestPackages } = options;
  if (canTestPackages === false) {
    log('Lab', `Skipping: facility does not have CanTestPackages permission (type: ${facilityType || 'unknown'}).`);
    log('Lab', 'Only Testing Lab facility types can record lab test results (confirmed by Metrc support).');
    return { tested: 0, passed: 0, failed: 0, skipped: 0 };
  }
  if (facilityType && !LAB_FACILITY_TYPES.some((t) => facilityType.toLowerCase().includes(t))) {
    log('Lab', `Warning: facility type "${facilityType}" may not support lab test recording.`);
    log('Lab', 'Proceeding anyway — set canTestPackages=false to skip explicitly.');
  }

  // Get active packages to test
  const packages = (await api('/packages/v2/active', { licenseNumber: license })).Data || [];
  if (packages.length === 0) {
    log('Lab', 'No active packages found. Skipping lab tests. (Run cultivator seeder first to create packages.)');
    return { tested: 0, passed: 0, failed: 0, skipped: 0 };
  }

  log('Lab', `Found ${packages.length} active packages`);

  // Discover available lab test type names and build profiles
  const typeMapping = await discoverLabTestTypes(api, license);
  const profiles = buildProfiles(typeMapping);

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

    const profile = profiles[i % profiles.length];
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
