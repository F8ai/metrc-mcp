#!/usr/bin/env node
/**
 * Dispensary facility seeder.
 *
 * Creates sales receipts on a dispensary facility using active packages.
 * Generates a mix of Consumer and Patient sale types with varying amounts.
 *
 * @param {Function} api - Configured metrcFetch function
 * @param {string} license - Facility license number
 * @param {string} runId - Unique run identifier
 * @returns {Promise<object>} Summary of created sales
 */

const today = new Date().toISOString().slice(0, 10);

function log(prefix, msg, data) {
  const line = data !== undefined
    ? `[${prefix}] ${msg} ${typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data}`
    : `[${prefix}] ${msg}`;
  console.log(line);
}

/**
 * Sale receipt templates with varying types and amounts.
 */
const SALE_TEMPLATES = [
  { type: 'Consumer', totalHint: 45.00 },
  { type: 'Consumer', totalHint: 72.50 },
  { type: 'Consumer', totalHint: 120.00 },
  { type: 'Patient',  totalHint: 35.00 },
  { type: 'Patient',  totalHint: 88.75 },
  { type: 'Consumer', totalHint: 55.25 },
];

/**
 * Discover valid sales customer types for this facility.
 */
async function getCustomerTypes(api, license) {
  try {
    const resp = await api('/sales/v2/customertypes', { licenseNumber: license });
    const types = resp?.Data || resp || [];
    if (Array.isArray(types)) {
      return types.map((t) => (typeof t === 'string' ? t : t.Name ?? t)).filter(Boolean);
    }
  } catch (e) {
    log('Dispensary', 'Customer types lookup failed:', e.message?.slice(0, 80));
  }
  return ['Consumer', 'Patient'];
}

/**
 * Main dispensary seeder entry point.
 */
export async function seedDispensary(api, license, runId) {
  log('Dispensary', `Starting seed (license: ${license}, runId: ${runId})`);

  // Get active packages for sale transactions
  const packages = (await api('/packages/v2/active', { licenseNumber: license })).Data || [];
  if (packages.length === 0) {
    log('Dispensary', 'No active packages found. Skipping sales.');
    return { receiptsCreated: 0, skipped: 0 };
  }

  log('Dispensary', `Found ${packages.length} active packages for sale transactions`);

  // Discover valid customer types
  const customerTypes = await getCustomerTypes(api, license);
  log('Dispensary', `Customer types: ${customerTypes.join(', ')}`);

  let receiptsCreated = 0;
  let skipped = 0;

  // Create sales receipts — one package per receipt for simplicity
  const TARGET = Math.min(SALE_TEMPLATES.length, packages.length);
  for (let i = 0; i < TARGET; i++) {
    const pkg = packages[i];
    const label = pkg.Label ?? pkg.PackageLabel;
    if (!label) { skipped++; continue; }

    const template = SALE_TEMPLATES[i];
    // Resolve customer type: use template type if available, else first valid type
    const resolvedType = customerTypes.includes(template.type)
      ? template.type
      : customerTypes[0] || 'Consumer';

    // Transaction: sell a small quantity from the package
    const quantity = 0.1; // small amount to not exhaust the package
    const uom = pkg.UnitOfMeasureName || 'Ounces';

    const receipt = {
      SalesDate: today,
      SalesCustomerType: resolvedType,
      Transactions: [{
        PackageLabel: label,
        Quantity: quantity,
        UnitOfMeasure: uom,
        TotalAmount: template.totalHint,
      }],
    };

    try {
      await api('/sales/v2/receipts', { licenseNumber: license }, {
        method: 'POST',
        body: [receipt],
      });
      receiptsCreated++;
      log('Dispensary', `Sale #${i + 1}: ${resolvedType} $${template.totalHint} (${label})`);
    } catch (e) {
      skipped++;
      log('Dispensary', `Sale #${i + 1} skipped:`, e.message?.slice(0, 100));
    }
  }

  const summary = { receiptsCreated, skipped };
  log('Dispensary', 'Done.', JSON.stringify(summary));
  return summary;
}
