/**
 * Edge-safe METRC client and tool execution for Vercel Edge (api/mcp, api/chat).
 * Uses process.env: METRC_API_URL, METRC_VENDOR_API_KEY, METRC_USER_API_KEY.
 */

const BASE = process.env.METRC_API_URL || 'https://sandbox-api-co.metrc.com';
const VENDOR = process.env.METRC_VENDOR_API_KEY || '';
const USER = process.env.METRC_USER_API_KEY || '';

export async function metrcFetch(path, params = {}, options = {}) {
  if (!VENDOR || !USER) {
    throw new Error(
      'METRC credentials required. Set METRC_VENDOR_API_KEY and METRC_USER_API_KEY in environment.'
    );
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const raw = `${VENDOR}:${USER}`;
  const creds =
    typeof btoa !== 'undefined'
      ? btoa(raw)
      : (typeof Buffer !== 'undefined' ? Buffer.from(raw, 'utf8').toString('base64') : null);
  if (!creds) throw new Error('No base64 encoder (btoa/Buffer) available');
  const init = {
    method: options.method || 'GET',
    headers: { Authorization: `Basic ${creds}` },
  };
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url.toString(), init);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// MCP tools list (same schema as server.js) – used for tools/list and for OpenRouter
export const TOOLS = [
  { name: 'metrc_get_facilities', description: 'List all facilities and their license numbers for the authenticated account', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'metrc_get_strains', description: 'Get active strains for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string', description: 'Facility license number (e.g. SF-SBX-CO-1-8002). Get from metrc_get_facilities.' } }, required: ['license_number'] } },
  { name: 'metrc_get_items', description: 'Get active items (products) for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_locations', description: 'Get active locations for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_packages', description: 'Get active packages for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_harvests', description: 'Get active harvests for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_plant_batches', description: 'Get active plant batches for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_units_of_measure', description: 'Get active units of measure (no license required)', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'metrc_get_waste_methods', description: 'Get waste methods (no license required)', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'metrc_get_employees', description: 'Get employees for a facility license', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_plants_flowering', description: 'Get flowering plants for a facility (required before creating a harvest)', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_harvest_plants', description: 'Create a harvest by harvesting flowering plants. Supply harvest name, harvest date (YYYY-MM-DD), and plant IDs from metrc_get_plants_flowering. Colorado also requires weight, unit, and drying location per plant.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_name: { type: 'string' }, harvest_date: { type: 'string' }, plant_ids: { type: 'array', items: { type: 'number' } }, plant_labels: { type: 'array', items: { type: 'string' } }, weight_per_plant: { type: 'number' }, unit_of_measure: { type: 'string' }, drying_location_id: { type: 'number' } }, required: ['license_number', 'harvest_name', 'harvest_date', 'plant_ids'] } },
  { name: 'metrc_get_location_types', description: 'Get location types for a facility (need one that allows plants to create plantings)', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_create_location', description: 'Create a location. Use a LocationTypeId that allows plants (ForPlants: true).', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, name: { type: 'string' }, location_type_id: { type: 'number' } }, required: ['license_number', 'name', 'location_type_id'] } },
  { name: 'metrc_get_tags_plant_available', description: 'Get available plant tags for the facility (needed to create plantings)', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_plant_batch_types', description: 'Get plant batch types (e.g. Seed, Clone) for the facility', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_plants_vegetative', description: 'Get vegetative plants for a facility (can be moved to flowering)', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_create_plant_batch_plantings', description: 'Create a plant batch and plantings (individual plants). Requires strain_id, location_id, type (e.g. Clone), count, planting_date (YYYY-MM-DD), and plant tag labels from metrc_get_tags_plant_available.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, plant_batch_name: { type: 'string' }, strain_id: { type: 'number' }, strain_name: { type: 'string' }, location_id: { type: 'number' }, type: { type: 'string' }, count: { type: 'number' }, planting_date: { type: 'string' }, plant_labels: { type: 'array', items: { type: 'string' } } }, required: ['license_number', 'plant_batch_name', 'strain_id', 'location_id', 'type', 'count', 'planting_date', 'plant_labels'] } },
  { name: 'metrc_change_plants_growth_phase', description: 'Change plant growth phase (e.g. to Flowering). Supply plant_ids and/or plant_labels, new growth_phase (e.g. Flowering), and change_date (YYYY-MM-DD).', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, growth_phase: { type: 'string' }, change_date: { type: 'string' }, plant_ids: { type: 'array', items: { type: 'number' } }, plant_labels: { type: 'array', items: { type: 'string' } } }, required: ['license_number', 'growth_phase', 'change_date'] } },
  { name: 'metrc_get_harvest', description: 'Get a single harvest by ID', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' } }, required: ['license_number', 'harvest_id'] } },
  { name: 'metrc_get_package', description: 'Get a single package by ID or by label', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, package_id: { type: 'number' }, package_label: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_plant', description: 'Get a single plant by ID or by label', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, plant_id: { type: 'number' }, plant_label: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_create_package', description: 'Create a new package. Requires item_id, tag, quantity, unit, location_id, and optional label.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, tag: { type: 'string' }, location_id: { type: 'number' }, item_id: { type: 'number' }, quantity: { type: 'number' }, unit_of_measure: { type: 'string' }, is_production_batch: { type: 'boolean' }, product_requires_remediation: { type: 'boolean' }, actual_date: { type: 'string' }, ingredients: { type: 'array', items: { type: 'object' } } }, required: ['license_number', 'tag', 'location_id', 'item_id', 'quantity', 'unit_of_measure', 'actual_date'] } },
  { name: 'metrc_create_harvest_packages', description: 'Create packages from a harvest. Supply harvest_id and package definitions (item, quantity, unit, tag, etc.).', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, harvest_name: { type: 'string' }, packages: { type: 'array', items: { type: 'object' } } }, required: ['license_number', 'packages'] } },
  { name: 'metrc_adjust_package', description: 'Adjust package quantity. Supply package label, quantity, unit, reason, and adjustment date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, label: { type: 'string' }, quantity: { type: 'number' }, unit_of_measure: { type: 'string' }, adjustment_reason: { type: 'string' }, adjustment_date: { type: 'string' }, reason_note: { type: 'string' } }, required: ['license_number', 'label', 'quantity', 'unit_of_measure', 'adjustment_reason', 'adjustment_date'] } },
  { name: 'metrc_change_package_location', description: 'Change package location. Supply package label and new location_id.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, label: { type: 'string' }, location_id: { type: 'number' } }, required: ['license_number', 'label', 'location_id'] } },
  { name: 'metrc_finish_package', description: 'Finish a package (make it available for sale). Supply label and actual_date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, label: { type: 'string' }, actual_date: { type: 'string' } }, required: ['license_number', 'label', 'actual_date'] } },
  { name: 'metrc_unfinish_package', description: 'Unfinish a package. Supply label and actual_date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, label: { type: 'string' }, actual_date: { type: 'string' } }, required: ['license_number', 'label', 'actual_date'] } },
  { name: 'metrc_bulk_adjust_packages', description: 'Adjust multiple packages in one call.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, adjustments: { type: 'array', items: { type: 'object' } } }, required: ['license_number', 'adjustments'] } },
  { name: 'metrc_bulk_finish_packages', description: 'Finish multiple packages in one call. Supply license_number, actual_date, and labels array.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, actual_date: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } } }, required: ['license_number', 'actual_date', 'labels'] } },
  { name: 'metrc_bulk_change_package_location', description: 'Change location for multiple packages in one call.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, moves: { type: 'array', items: { type: 'object' } } }, required: ['license_number', 'moves'] } },
  { name: 'metrc_move_harvest', description: 'Move harvest to a different location. Supply harvest_id and new location_id.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, location_id: { type: 'number' } }, required: ['license_number', 'harvest_id', 'location_id'] } },
  { name: 'metrc_rename_harvest', description: 'Rename a harvest. Supply harvest_id and new name.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, new_name: { type: 'string' } }, required: ['license_number', 'harvest_id', 'new_name'] } },
  { name: 'metrc_finish_harvest', description: 'Finish a harvest. Supply harvest_id and actual_date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, actual_date: { type: 'string' } }, required: ['license_number', 'harvest_id', 'actual_date'] } },
  { name: 'metrc_unfinish_harvest', description: 'Unfinish a harvest. Supply harvest_id and actual_date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, actual_date: { type: 'string' } }, required: ['license_number', 'harvest_id', 'actual_date'] } },
  { name: 'metrc_get_harvests_inactive', description: 'Get inactive harvests (with optional page)', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, page_size: { type: 'number' }, page: { type: 'number' } }, required: ['license_number'] } },
  { name: 'metrc_get_packages_inactive', description: 'Get inactive packages', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, page_size: { type: 'number' }, page: { type: 'number' } }, required: ['license_number'] } },
  { name: 'metrc_get_plant_batches_inactive', description: 'Get inactive plant batches', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, page_size: { type: 'number' }, page: { type: 'number' } }, required: ['license_number'] } },
  { name: 'metrc_get_transfers_incoming', description: 'List incoming transfers', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_transfers_outgoing', description: 'List outgoing transfers', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_create_item', description: 'Create a new item (product). Supply name, category, unit of measure, etc.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, name: { type: 'string' }, item_category: { type: 'string' }, unit_of_measure: { type: 'string' }, strain_id: { type: 'number' }, item_brand: { type: 'string' }, administration_method: { type: 'string' }, unit_cbd_percent: { type: 'number' }, unit_cbd_content: { type: 'number' }, unit_cbd_content_unit: { type: 'string' }, unit_thc_percent: { type: 'number' }, unit_thc_content: { type: 'number' }, unit_thc_content_unit: { type: 'string' } }, required: ['license_number', 'name', 'item_category', 'unit_of_measure'] } },
  { name: 'metrc_update_item', description: 'Update an existing item. Supply id and fields to update.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, id: { type: 'number' }, name: { type: 'string' }, item_category: { type: 'string' }, unit_of_measure: { type: 'string' } }, required: ['license_number', 'id'] } },
  { name: 'metrc_create_strain', description: 'Create a new strain', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, name: { type: 'string' }, testing_status: { type: 'string' }, thc_level: { type: 'number' }, cbd_level: { type: 'number' }, indica_percentage: { type: 'number' }, sativa_percentage: { type: 'number' }, genetics: { type: 'string' } }, required: ['license_number', 'name'] } },
  { name: 'metrc_update_strain', description: 'Update an existing strain', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, id: { type: 'number' }, name: { type: 'string' }, testing_status: { type: 'string' }, thc_level: { type: 'number' }, cbd_level: { type: 'number' }, indica_percentage: { type: 'number' }, sativa_percentage: { type: 'number' }, genetics: { type: 'string' } }, required: ['license_number', 'id'] } },
  { name: 'metrc_get_lab_test_types', description: 'Get lab test types', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_lab_test_batches', description: 'Get lab test batches', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, package_id: { type: 'number' }, harvest_id: { type: 'number' } }, required: ['license_number'] } },
  { name: 'metrc_get_lab_test_results', description: 'Get lab test results', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, package_id: { type: 'number' }, harvest_id: { type: 'number' } }, required: ['license_number'] } },
  { name: 'metrc_post_harvest_waste', description: 'Record waste on a harvest. Supply harvest_id, waste method, quantity, unit, and date.', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, harvest_id: { type: 'number' }, harvest_name: { type: 'string' }, waste_method_id: { type: 'number' }, waste_amount: { type: 'number' }, waste_unit_of_measure: { type: 'string' }, waste_date: { type: 'string' }, reason_note: { type: 'string' } }, required: ['license_number', 'harvest_id', 'harvest_name', 'waste_method_id', 'waste_amount', 'waste_unit_of_measure', 'waste_date'] } },
  { name: 'metrc_get_processing_active', description: 'Get active processing jobs', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_processing_job_types', description: 'Get processing job types', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_sandbox_setup', description: 'Run sandbox integrator setup to seed test data (sandbox only)', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'metrc_get_tags_package_available', description: 'Get available package tags', inputSchema: { type: 'object', properties: { license_number: { type: 'string' } }, required: ['license_number'] } },
  { name: 'metrc_get_packages_with_pagination', description: 'Get packages with optional page and pageSize', inputSchema: { type: 'object', properties: { license_number: { type: 'string' }, page: { type: 'number' }, page_size: { type: 'number' } }, required: ['license_number'] } },
];

export function getToolsList() {
  return TOOLS;
}

/** OpenAI/OpenRouter function-calling format */
export function getOpenAITools() {
  return TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export async function executeTool(name, args = {}) {
  let data;
  switch (name) {
    case 'metrc_get_facilities':
      data = await metrcFetch('/facilities/v2/');
      break;
    case 'metrc_get_strains':
      data = await metrcFetch('/strains/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_items':
      data = await metrcFetch('/items/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_locations':
      data = await metrcFetch('/locations/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_packages':
      data = await metrcFetch('/packages/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_harvests':
      data = await metrcFetch('/harvests/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_plant_batches':
      data = await metrcFetch('/plantbatches/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_units_of_measure':
      data = await metrcFetch('/unitsofmeasure/v2/active');
      break;
    case 'metrc_get_waste_methods':
      data = await metrcFetch('/wastemethods/v2/');
      break;
    case 'metrc_get_employees':
      data = await metrcFetch('/employees/v2/', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_plants_flowering':
      data = await metrcFetch('/plants/v2/flowering', { licenseNumber: args.license_number });
      break;
    case 'metrc_harvest_plants': {
      const labels = args.plant_labels || [];
      const ids = args.plant_ids || [];
      const weight = args.weight_per_plant ?? 1;
      const unit = args.unit_of_measure || 'Ounces';
      const dryingId = args.drying_location_id;
      const body = ids.map((id, i) => {
        const o = { HarvestName: args.harvest_name, HarvestDate: args.harvest_date, Id: id, Weight: weight, UnitOfMeasure: unit, ActualDate: args.harvest_date };
        if (labels[i] !== undefined) o.Label = labels[i];
        if (dryingId != null) o.DryingLocationId = dryingId;
        return o;
      });
      data = await metrcFetch('/plants/v2/harvest', { licenseNumber: args.license_number }, { method: 'PUT', body });
      break;
    }
    case 'metrc_get_location_types':
      data = await metrcFetch('/locations/v2/types', { licenseNumber: args.license_number });
      break;
    case 'metrc_create_location':
      data = await metrcFetch('/locations/v2/', { licenseNumber: args.license_number }, { method: 'POST', body: [{ Name: args.name, LocationTypeId: args.location_type_id }] });
      break;
    case 'metrc_get_tags_plant_available':
      data = await metrcFetch('/tags/v2/plant/available', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_plant_batch_types':
      data = await metrcFetch('/plantbatches/v2/types', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_plants_vegetative':
      data = await metrcFetch('/plants/v2/vegetative', { licenseNumber: args.license_number });
      break;
    case 'metrc_create_plant_batch_plantings': {
      let plantLabels = args.plant_labels;
      if (typeof plantLabels === 'string') plantLabels = JSON.parse(plantLabels);
      plantLabels = Array.isArray(plantLabels) ? plantLabels : [];
      const batchName = String(args.plant_batch_name ?? '').trim();
      if (!batchName) throw new Error('plant_batch_name is required');
      const arrayBody = plantLabels.map((label) => {
        const o = { PlantBatchName: batchName, Type: args.type, Count: 1, LocationId: args.location_id, ActualDate: args.planting_date, PlantLabel: label };
        if (args.strain_name) o.Strain = args.strain_name;
        else o.StrainId = args.strain_id;
        return o;
      });
      data = await metrcFetch('/plantbatches/v2/plantings', { licenseNumber: args.license_number }, { method: 'POST', body: arrayBody });
      break;
    }
    case 'metrc_change_plants_growth_phase': {
      const ids = args.plant_ids || [];
      const labels = args.plant_labels || [];
      const body = [
        ...ids.map((Id) => ({ Id, GrowthPhase: args.growth_phase, ActualDate: args.change_date })),
        ...labels.map((Label) => ({ Label, GrowthPhase: args.growth_phase, ActualDate: args.change_date })),
      ];
      if (body.length === 0) throw new Error('Provide plant_ids or plant_labels');
      data = await metrcFetch('/plants/v2/growthphase', { licenseNumber: args.license_number }, { method: 'PUT', body });
      break;
    }
    case 'metrc_get_harvest':
      data = await metrcFetch(`/harvests/v2/${args.harvest_id}`, { licenseNumber: args.license_number });
      break;
    case 'metrc_get_package':
      if (args.package_label != null) {
        data = await metrcFetch(`/packages/v2/${encodeURIComponent(args.package_label)}`, { licenseNumber: args.license_number });
      } else if (args.package_id != null) {
        data = await metrcFetch(`/packages/v2/${args.package_id}`, { licenseNumber: args.license_number });
      } else {
        throw new Error('Provide package_id or package_label');
      }
      break;
    case 'metrc_get_plant':
      if (args.plant_label != null) {
        data = await metrcFetch(`/plants/v2/${encodeURIComponent(args.plant_label)}`, { licenseNumber: args.license_number });
      } else if (args.plant_id != null) {
        data = await metrcFetch(`/plants/v2/${args.plant_id}`, { licenseNumber: args.license_number });
      } else {
        throw new Error('Provide plant_id or plant_label');
      }
      break;
    case 'metrc_create_package': {
      const pkg = { Tag: args.tag, LocationId: args.location_id, ItemId: args.item_id, Quantity: args.quantity, UnitOfMeasure: args.unit_of_measure, IsProductionBatch: args.is_production_batch ?? false, ProductRequiresRemediation: args.product_requires_remediation ?? false, ActualDate: args.actual_date };
      if (args.ingredients) pkg.Ingredients = args.ingredients;
      data = await metrcFetch('/packages/v2/', { licenseNumber: args.license_number }, { method: 'POST', body: [pkg] });
      break;
    }
    case 'metrc_create_harvest_packages':
      data = await metrcFetch('/harvests/v2/packages', { licenseNumber: args.license_number }, { method: 'POST', body: args.packages });
      break;
    case 'metrc_adjust_package': {
      const adjBody = [{ Label: args.label, Quantity: args.quantity, UnitOfMeasure: args.unit_of_measure, AdjustmentReason: args.adjustment_reason, AdjustmentDate: args.adjustment_date, ReasonNote: args.reason_note || '' }];
      data = await metrcFetch('/packages/v2/adjust', { licenseNumber: args.license_number }, { method: 'POST', body: adjBody });
      break;
    }
    case 'metrc_change_package_location':
      data = await metrcFetch('/packages/v2/location', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Label: args.label, LocationId: args.location_id }] });
      break;
    case 'metrc_finish_package':
      data = await metrcFetch('/packages/v2/finish', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Label: args.label, ActualDate: args.actual_date }] });
      break;
    case 'metrc_unfinish_package':
      data = await metrcFetch('/packages/v2/unfinish', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Label: args.label, ActualDate: args.actual_date }] });
      break;
    case 'metrc_bulk_adjust_packages': {
      const adjustments = Array.isArray(args.adjustments) ? args.adjustments : [];
      if (adjustments.length === 0) throw new Error('adjustments array is required and must not be empty');
      const adjBody = adjustments.map((a) => ({ Label: a.label, Quantity: a.quantity, UnitOfMeasure: a.unit_of_measure, AdjustmentReason: a.adjustment_reason, AdjustmentDate: a.adjustment_date, ReasonNote: a.reason_note || '' }));
      data = await metrcFetch('/packages/v2/adjust', { licenseNumber: args.license_number }, { method: 'POST', body: adjBody });
      break;
    }
    case 'metrc_bulk_finish_packages': {
      const labels = Array.isArray(args.labels) ? args.labels : [];
      if (labels.length === 0) throw new Error('labels array is required and must not be empty');
      data = await metrcFetch('/packages/v2/finish', { licenseNumber: args.license_number }, { method: 'PUT', body: labels.map((l) => ({ Label: l, ActualDate: args.actual_date })) });
      break;
    }
    case 'metrc_bulk_change_package_location': {
      const moves = Array.isArray(args.moves) ? args.moves : [];
      if (moves.length === 0) throw new Error('moves array is required and must not be empty');
      data = await metrcFetch('/packages/v2/location', { licenseNumber: args.license_number }, { method: 'PUT', body: moves.map((m) => ({ Label: m.label, LocationId: m.location_id })) });
      break;
    }
    case 'metrc_move_harvest':
      data = await metrcFetch('/harvests/v2/location', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Id: args.harvest_id, LocationId: args.location_id }] });
      break;
    case 'metrc_rename_harvest':
      data = await metrcFetch('/harvests/v2/rename', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Id: args.harvest_id, NewName: args.new_name }] });
      break;
    case 'metrc_finish_harvest':
      data = await metrcFetch('/harvests/v2/finish', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Id: args.harvest_id, ActualDate: args.actual_date }] });
      break;
    case 'metrc_unfinish_harvest':
      data = await metrcFetch('/harvests/v2/unfinish', { licenseNumber: args.license_number }, { method: 'PUT', body: [{ Id: args.harvest_id, ActualDate: args.actual_date }] });
      break;
    case 'metrc_get_harvests_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      data = await metrcFetch('/harvests/v2/inactive', q);
      break;
    }
    case 'metrc_get_packages_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      data = await metrcFetch('/packages/v2/inactive', q);
      break;
    }
    case 'metrc_get_plant_batches_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      data = await metrcFetch('/plantbatches/v2/inactive', q);
      break;
    }
    case 'metrc_get_transfers_incoming':
      data = await metrcFetch('/transfers/v2/incoming', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_transfers_outgoing':
      data = await metrcFetch('/transfers/v2/outgoing', { licenseNumber: args.license_number });
      break;
    case 'metrc_create_item': {
      const item = { Name: args.name, ItemCategory: args.item_category, UnitOfMeasure: args.unit_of_measure, StrainId: args.strain_id, ItemBrand: args.item_brand, AdministrationMethod: args.administration_method, UnitCbdPercent: args.unit_cbd_percent, UnitCbdContent: args.unit_cbd_content, UnitCbdContentUnit: args.unit_cbd_content_unit, UnitThcPercent: args.unit_thc_percent, UnitThcContent: args.unit_thc_content, UnitThcContentUnit: args.unit_thc_content_unit };
      Object.keys(item).forEach((k) => item[k] == null && delete item[k]);
      data = await metrcFetch('/items/v2/', { licenseNumber: args.license_number }, { method: 'POST', body: [item] });
      break;
    }
    case 'metrc_update_item': {
      const item = { Id: args.id, Name: args.name, ItemCategory: args.item_category, UnitOfMeasure: args.unit_of_measure };
      Object.keys(item).forEach((k) => item[k] == null && k !== 'Id' && delete item[k]);
      data = await metrcFetch('/items/v2/', { licenseNumber: args.license_number }, { method: 'PUT', body: [item] });
      break;
    }
    case 'metrc_create_strain': {
      const strain = { Name: args.name, TestingStatus: args.testing_status, ThcLevel: args.thc_level, CbdLevel: args.cbd_level, IndicaPercentage: args.indica_percentage, SativaPercentage: args.sativa_percentage, Genetics: args.genetics };
      Object.keys(strain).forEach((k) => strain[k] == null && delete strain[k]);
      data = await metrcFetch('/strains/v2/', { licenseNumber: args.license_number }, { method: 'POST', body: [strain] });
      break;
    }
    case 'metrc_update_strain': {
      const strain = { Id: args.id, Name: args.name, TestingStatus: args.testing_status, ThcLevel: args.thc_level, CbdLevel: args.cbd_level, IndicaPercentage: args.indica_percentage, SativaPercentage: args.sativa_percentage, Genetics: args.genetics };
      Object.keys(strain).forEach((k) => strain[k] == null && k !== 'Id' && delete strain[k]);
      data = await metrcFetch('/strains/v2/', { licenseNumber: args.license_number }, { method: 'PUT', body: [strain] });
      break;
    }
    case 'metrc_get_lab_test_types':
      data = await metrcFetch('/labtests/v2/types', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_lab_test_batches': {
      const q = { licenseNumber: args.license_number };
      if (args.package_id != null) q.packageId = args.package_id;
      if (args.harvest_id != null) q.harvestId = args.harvest_id;
      data = await metrcFetch('/labtests/v2/batches', q);
      break;
    }
    case 'metrc_get_lab_test_results': {
      const q = { licenseNumber: args.license_number };
      if (args.package_id != null) q.packageId = args.package_id;
      if (args.harvest_id != null) q.harvestId = args.harvest_id;
      data = await metrcFetch('/labtests/v2/results', q);
      break;
    }
    case 'metrc_post_harvest_waste': {
      data = await metrcFetch('/harvests/v2/waste', { licenseNumber: args.license_number }, { method: 'POST', body: [{ HarvestId: args.harvest_id, HarvestName: args.harvest_name, WasteMethodId: args.waste_method_id, WasteAmount: args.waste_amount, WasteUnitOfMeasure: args.waste_unit_of_measure, WasteDate: args.waste_date, ReasonNote: args.reason_note || '' }] });
      break;
    }
    case 'metrc_get_processing_active':
      data = await metrcFetch('/processing/v2/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_processing_job_types':
      data = await metrcFetch('/processing/v2/jobtypes/active', { licenseNumber: args.license_number });
      break;
    case 'metrc_sandbox_setup':
      data = await metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });
      break;
    case 'metrc_get_tags_package_available':
      data = await metrcFetch('/tags/v2/package/available', { licenseNumber: args.license_number });
      break;
    case 'metrc_get_packages_with_pagination': {
      const q = { licenseNumber: args.license_number };
      if (args.page != null) q.page = args.page;
      if (args.page_size != null) q.pageSize = args.page_size;
      data = await metrcFetch('/packages/v2/active', q);
      break;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}
