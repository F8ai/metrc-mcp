#!/usr/bin/env node
/**
 * Submit-for-testing seeder.
 *
 * Finds active packages with LabTestingStateName === 'NotSubmitted' and submits
 * them for lab testing via POST /packages/v2/testing. This creates a lab sample
 * package and transitions the source package to 'SubmittedForTesting'.
 *
 * Required for MA sandbox: packages start as NotSubmitted and cannot be
 * transferred until submitted for testing (confirmed case #02372700).
 *
 * Best-effort: if no NotSubmitted packages exist (e.g. CO), returns gracefully.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @returns {Promise<object>} Summary { submitted, skipped }
 */

const log = (msg, data) => console.log(
  data !== undefined ? `[SubmitTesting] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}` : `[SubmitTesting] ${msg}`
);

/** Extract tag labels from a METRC tags response. */
function extractTags(resp) {
  return (resp?.Data ?? resp ?? []).map((t) => (typeof t === 'string' ? t : t.Label ?? t)).filter(Boolean);
}

export async function submitPackagesForTesting(api, license, runId) {
  log(`Starting (license: ${license}, runId: ${runId})`);

  // 1. Get active packages
  let allPackages;
  try {
    const resp = await api('/packages/v2/active', { licenseNumber: license });
    allPackages = resp?.Data ?? resp ?? [];
  } catch (e) {
    log('Failed to fetch active packages:', e.message?.slice(0, 80));
    return { submitted: 0, skipped: 0 };
  }

  if (allPackages.length === 0) {
    log('No active packages found. Skipping.');
    return { submitted: 0, skipped: 0 };
  }
  log(`Found ${allPackages.length} active packages`);

  // 2. Filter to NotSubmitted packages
  const notSubmitted = allPackages.filter((pkg) => {
    const state = pkg.LabTestingStateName ?? pkg.LabTestingState ?? '';
    return state === 'NotSubmitted';
  });

  if (notSubmitted.length === 0) {
    log('No NotSubmitted packages found (likely CO sandbox). Skipping.');
    return { submitted: 0, skipped: 0 };
  }
  log(`${notSubmitted.length} packages are NotSubmitted`);

  // 3. Get available tags for the sample packages
  let tags;
  try {
    const tagResp = await api('/tags/v2/package/available', { licenseNumber: license });
    tags = extractTags(tagResp);
  } catch (e) {
    log('Failed to fetch available tags:', e.message?.slice(0, 80));
    return { submitted: 0, skipped: 0 };
  }

  if (tags.length === 0) {
    log('No available tags. Cannot create testing samples. Skipping.');
    return { submitted: 0, skipped: 0 };
  }
  log(`${tags.length} tags available`);

  // 4. Submit up to 4 packages (one tag per package)
  const today = new Date().toISOString().slice(0, 10);
  const TARGET = Math.min(4, notSubmitted.length, tags.length);
  const toSubmit = notSubmitted.slice(0, TARGET);

  const payload = toSubmit.map((pkg, i) => {
    const label = pkg.Label ?? pkg.PackageLabel;
    const itemName = pkg.Item?.Name ?? pkg.ItemName ?? 'Unknown Item';
    const unit = pkg.Item?.UnitOfMeasureName ?? pkg.UnitOfMeasureName ?? 'Grams';
    // Use a small sample quantity (1g or 1 unit)
    const quantity = unit === 'Each' ? 1 : 1.0;

    return {
      Tag: tags[i],
      Location: null,
      Item: itemName,
      Quantity: quantity,
      UnitOfMeasure: unit,
      PackagedDate: today,
      IsProductionBatch: false,
      ProductionBatchNumber: null,
      ProductRequiresRemediation: false,
      SourcePackageLabels: label,
      Note: `Testing sample - seed run ${runId}`,
    };
  });

  let submitted = 0;
  let skipped = 0;

  try {
    await api('/packages/v2/testing', { licenseNumber: license }, {
      method: 'POST',
      body: payload,
    });
    submitted = payload.length;
    log(`Submitted ${submitted} packages for testing`);
  } catch (e) {
    const errMsg = e.message || '';
    log('Submit for testing failed:', errMsg.slice(0, 120));
    skipped = payload.length;

    // Try one-at-a-time if batch failed
    if (payload.length > 1) {
      log('Retrying one-at-a-time...');
      submitted = 0;
      skipped = 0;
      for (const entry of payload) {
        try {
          await api('/packages/v2/testing', { licenseNumber: license }, {
            method: 'POST',
            body: [entry],
          });
          submitted++;
          log(`  Submitted: ${entry.SourcePackageLabels}`);
        } catch (e2) {
          skipped++;
          log(`  Skipped: ${entry.SourcePackageLabels} — ${e2.message?.slice(0, 60)}`);
        }
      }
    }
  }

  const summary = { submitted, skipped };
  log('Done.', JSON.stringify(summary));
  return summary;
}
