/**
 * METRC MCP Tool Definitions (FOR-995)
 *
 * Single source of truth for all MCP tool definitions.
 * Both server.js (stdio) and lib/metrc-edge.js (Vercel Edge) import from here.
 *
 * To add a new tool:
 *   1. Add definition to the TOOLS array below
 *   2. Add execution case in lib/tool-executor.js
 *   That's it — both stdio and Edge consumers pick it up automatically.
 */

export const TOOLS = [
  {
    name: 'metrc_get_facilities',
    description: 'List all facilities and their license numbers for the authenticated account',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_strains',
    description: 'Get active strains for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: {
          type: 'string',
          description: 'Facility license number (e.g. SF-SBX-CO-1-8002). Get from metrc_get_facilities.',
        },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_items',
    description: 'Get active items (products) for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_locations',
    description: 'Get active locations for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_packages',
    description: 'Get active packages for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_harvests',
    description: 'Get active harvests for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batches',
    description: 'Get active plant batches for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_units_of_measure',
    description: 'Get active units of measure (no license required)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_waste_methods',
    description: 'Get waste methods (no license required)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'metrc_get_employees',
    description: 'Get employees for a facility license',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plants_flowering',
    description: 'Get flowering plants for a facility (required before creating a harvest)',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_harvest_plants',
    description:
      'Create a harvest by harvesting flowering plants. Supply harvest name, harvest date (YYYY-MM-DD), and plant IDs from metrc_get_plants_flowering. Colorado also requires weight, unit, and drying location per plant.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        harvest_name: { type: 'string', description: 'Name for the harvest' },
        harvest_date: { type: 'string', description: 'Harvest date (YYYY-MM-DD)' },
        plant_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of plant Id values from flowering plants',
        },
        plant_labels: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of plant Label values from flowering plants (required for Colorado). Get from metrc_get_plants_flowering.',
        },
        weight_per_plant: { type: 'number', description: 'Weight per plant (e.g. 1). Default 1.' },
        unit_of_measure: { type: 'string', description: 'Unit of measure (e.g. Ounces). Default Ounces.' },
        drying_location_id: { type: 'number', description: 'Location Id for drying. Get from metrc_get_locations.' },
      },
      required: ['license_number', 'harvest_name', 'harvest_date', 'plant_ids'],
    },
  },
  {
    name: 'metrc_get_location_types',
    description: 'Get location types for a facility (need one that allows plants to create plantings)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_create_location',
    description: 'Create a location. Use a LocationTypeId that allows plants (ForPlants: true).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        name: { type: 'string', description: 'Location name' },
        location_type_id: { type: 'number', description: 'LocationTypeId from metrc_get_location_types' },
      },
      required: ['license_number', 'name', 'location_type_id'],
    },
  },
  {
    name: 'metrc_get_tags_plant_available',
    description: 'Get available plant tags for the facility (needed to create plantings)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batch_types',
    description: 'Get plant batch types (e.g. Seed, Clone) for the facility',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plants_vegetative',
    description: 'Get vegetative plants for a facility (can be moved to flowering)',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string', description: 'Facility license number' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_create_plant_batch_plantings',
    description:
      'Create a plant batch and plantings (individual plants). Requires strain_id, location_id, type (e.g. Clone), count, planting_date (YYYY-MM-DD), and plant tag labels from metrc_get_tags_plant_available.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        plant_batch_name: { type: 'string', description: 'Name for the plant batch' },
        strain_id: { type: 'number', description: 'Strain Id from metrc_get_strains' },
        strain_name: { type: 'string', description: 'Strain name (e.g. SBX Strain 1). Required by Colorado API.' },
        location_id: { type: 'number', description: 'Location Id (must allow plants)' },
        type: { type: 'string', description: 'Plant batch type, e.g. Clone or Seed' },
        count: { type: 'number', description: 'Number of plants to create' },
        planting_date: { type: 'string', description: 'Planting date YYYY-MM-DD' },
        plant_labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of plant tag labels from metrc_get_tags_plant_available (one per plant)',
        },
      },
      required: ['license_number', 'plant_batch_name', 'strain_id', 'location_id', 'type', 'count', 'planting_date', 'plant_labels'],
    },
  },
  {
    name: 'metrc_change_plants_growth_phase',
    description:
      'Change individual plant growth phase (e.g. Vegetative to Flowering). Supply plant_ids and/or plant_labels, growth_phase, change_date, and optional new_location.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        growth_phase: { type: 'string', description: 'New phase: Vegetative or Flowering' },
        change_date: { type: 'string', description: 'Date of change YYYY-MM-DD' },
        plant_ids: { type: 'array', items: { type: 'number' }, description: 'Plant Ids to change' },
        plant_labels: { type: 'array', items: { type: 'string' }, description: 'Plant Labels to change' },
        new_location: { type: 'string', description: 'New location name (required by Colorado v2)' },
      },
      required: ['license_number', 'growth_phase', 'change_date'],
    },
  },
  {
    name: 'metrc_change_plant_batch_growth_phase',
    description:
      'Convert untracked plant batch plants into tracked individual plants by changing the batch growth phase. Required step after plantings in Colorado v2: batch plants start untracked and must be converted to Vegetative via this call before they appear in plants/vegetative.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        plant_batch_name: { type: 'string', description: 'Plant batch name from plantings' },
        count: { type: 'number', description: 'Number of plants to convert' },
        starting_tag: { type: 'string', description: 'First plant tag for tracked plants (consumes one tag per plant)' },
        growth_phase: { type: 'string', description: 'Target phase: Vegetative' },
        growth_date: { type: 'string', description: 'Date YYYY-MM-DD' },
        new_location: { type: 'string', description: 'Location name for the plants' },
      },
      required: ['license_number', 'plant_batch_name', 'count', 'starting_tag', 'growth_phase', 'growth_date', 'new_location'],
    },
  },
  // Lookups by ID/label
  {
    name: 'metrc_get_harvest',
    description: 'Get a single harvest by ID',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        harvest_id: { type: 'number', description: 'Harvest Id' },
      },
      required: ['license_number', 'harvest_id'],
    },
  },
  {
    name: 'metrc_get_package',
    description: 'Get a single package by ID or by label',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        package_id: { type: 'number', description: 'Package Id (use id or label, not both)' },
        package_label: { type: 'string', description: 'Package label (use id or label)' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant',
    description: 'Get a single plant by ID or by label',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string', description: 'Facility license number' },
        plant_id: { type: 'number', description: 'Plant Id' },
        plant_label: { type: 'string', description: 'Plant label' },
      },
      required: ['license_number'],
    },
  },
  // Packages - create, from harvest, adjust, location, finish
  {
    name: 'metrc_create_package',
    description: 'Create a new package. Requires item_id, tag, quantity, unit, location_id, and optional label.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        tag: { type: 'string', description: 'Package tag from metrc_get_tags_package_available' },
        location_id: { type: 'number' },
        item_id: { type: 'number' },
        quantity: { type: 'number' },
        unit_of_measure: { type: 'string' },
        is_production_batch: { type: 'boolean' },
        product_requires_remediation: { type: 'boolean' },
        actual_date: { type: 'string', description: 'YYYY-MM-DD' },
        ingredients: { type: 'array', items: { type: 'object' }, description: 'For derived packages' },
      },
      required: ['license_number', 'tag', 'location_id', 'item_id', 'quantity', 'unit_of_measure', 'actual_date'],
    },
  },
  {
    name: 'metrc_create_harvest_packages',
    description: 'Create packages from a harvest. Supply harvest_id and package definitions (item, quantity, unit, tag, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        harvest_name: { type: 'string' },
        packages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Tag: { type: 'string' },
              LocationId: { type: 'number' },
              ItemId: { type: 'number' },
              Quantity: { type: 'number' },
              UnitOfMeasure: { type: 'string' },
              IsProductionBatch: { type: 'boolean' },
              ProductRequiresRemediation: { type: 'boolean' },
              ActualDate: { type: 'string' },
            },
          },
        },
      },
      required: ['license_number', 'packages'],
    },
  },
  {
    name: 'metrc_adjust_package',
    description: 'Adjust package quantity. Supply package label, quantity, unit, reason, and adjustment date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        quantity: { type: 'number' },
        unit_of_measure: { type: 'string' },
        adjustment_reason: { type: 'string' },
        adjustment_date: { type: 'string' },
        reason_note: { type: 'string' },
      },
      required: ['license_number', 'label', 'quantity', 'unit_of_measure', 'adjustment_reason', 'adjustment_date'],
    },
  },
  {
    name: 'metrc_change_package_location',
    description: 'Change package location. Supply package label and new location_id.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        location_id: { type: 'number' },
      },
      required: ['license_number', 'label', 'location_id'],
    },
  },
  {
    name: 'metrc_finish_package',
    description: 'Finish a package (make it available for sale). Supply label and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'label', 'actual_date'],
    },
  },
  {
    name: 'metrc_unfinish_package',
    description: 'Unfinish a package. Supply label and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        label: { type: 'string' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'label', 'actual_date'],
    },
  },
  // Bulk package actions
  {
    name: 'metrc_bulk_adjust_packages',
    description: 'Adjust multiple packages in one call. Supply license_number and adjustments array (each: label, quantity, unit_of_measure, adjustment_reason, adjustment_date, optional reason_note).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        adjustments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              quantity: { type: 'number' },
              unit_of_measure: { type: 'string' },
              adjustment_reason: { type: 'string' },
              adjustment_date: { type: 'string' },
              reason_note: { type: 'string' },
            },
            required: ['label', 'quantity', 'unit_of_measure', 'adjustment_reason', 'adjustment_date'],
          },
        },
      },
      required: ['license_number', 'adjustments'],
    },
  },
  {
    name: 'metrc_bulk_finish_packages',
    description: 'Finish multiple packages in one call. Supply license_number, actual_date, and labels array.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        actual_date: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Package labels to finish' },
      },
      required: ['license_number', 'actual_date', 'labels'],
    },
  },
  {
    name: 'metrc_bulk_change_package_location',
    description: 'Change location for multiple packages in one call. Supply license_number and moves array (each: label, location_id).',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        moves: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              location_id: { type: 'number' },
            },
            required: ['label', 'location_id'],
          },
        },
      },
      required: ['license_number', 'moves'],
    },
  },
  // Harvest actions
  {
    name: 'metrc_move_harvest',
    description: 'Move harvest to a different location. Supply harvest_id and new location_id.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        location_id: { type: 'number' },
      },
      required: ['license_number', 'harvest_id', 'location_id'],
    },
  },
  {
    name: 'metrc_rename_harvest',
    description: 'Rename a harvest. Supply harvest_id and new name.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        new_name: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'new_name'],
    },
  },
  {
    name: 'metrc_finish_harvest',
    description: 'Finish a harvest. Supply harvest_id and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'actual_date'],
    },
  },
  {
    name: 'metrc_unfinish_harvest',
    description: 'Unfinish a harvest. Supply harvest_id and actual_date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        actual_date: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'actual_date'],
    },
  },
  // Inactive / historical
  {
    name: 'metrc_get_harvests_inactive',
    description: 'Get inactive harvests (with optional page)',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_packages_inactive',
    description: 'Get inactive packages',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_plant_batches_inactive',
    description: 'Get inactive plant batches',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page_size: { type: 'number' },
        page: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  // Transfers
  {
    name: 'metrc_get_transfers_incoming',
    description: 'List incoming transfers',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_transfers_outgoing',
    description: 'List outgoing transfers',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Items create/update
  {
    name: 'metrc_create_item',
    description: 'Create a new item (product). Supply name, category, unit of measure, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        name: { type: 'string' },
        item_category: { type: 'string' },
        unit_of_measure: { type: 'string' },
        strain_id: { type: 'number' },
        item_brand: { type: 'string' },
        administration_method: { type: 'string' },
        unit_cbd_percent: { type: 'number' },
        unit_cbd_content: { type: 'number' },
        unit_cbd_content_unit: { type: 'string' },
        unit_thc_percent: { type: 'number' },
        unit_thc_content: { type: 'number' },
        unit_thc_content_unit: { type: 'string' },
      },
      required: ['license_number', 'name', 'item_category', 'unit_of_measure'],
    },
  },
  {
    name: 'metrc_update_item',
    description: 'Update an existing item. Supply id and fields to update.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        id: { type: 'number' },
        name: { type: 'string' },
        item_category: { type: 'string' },
        unit_of_measure: { type: 'string' },
      },
      required: ['license_number', 'id'],
    },
  },
  // Strains create/update
  {
    name: 'metrc_create_strain',
    description: 'Create a new strain',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        name: { type: 'string' },
        testing_status: { type: 'string' },
        thc_level: { type: 'number' },
        cbd_level: { type: 'number' },
        indica_percentage: { type: 'number' },
        sativa_percentage: { type: 'number' },
        genetics: { type: 'string' },
      },
      required: ['license_number', 'name'],
    },
  },
  {
    name: 'metrc_update_strain',
    description: 'Update an existing strain',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        id: { type: 'number' },
        name: { type: 'string' },
        testing_status: { type: 'string' },
        thc_level: { type: 'number' },
        cbd_level: { type: 'number' },
        indica_percentage: { type: 'number' },
        sativa_percentage: { type: 'number' },
        genetics: { type: 'string' },
      },
      required: ['license_number', 'id'],
    },
  },
  // Lab tests
  {
    name: 'metrc_get_lab_test_types',
    description: 'Get lab test types',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_lab_test_batches',
    description: 'Get lab test batches',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        package_id: { type: 'number' },
        harvest_id: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_lab_test_results',
    description: 'Get lab test results',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        package_id: { type: 'number' },
        harvest_id: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
  // Waste
  {
    name: 'metrc_post_harvest_waste',
    description: 'Record waste on a harvest. Supply harvest_id, waste method, quantity, unit, and date.',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        harvest_id: { type: 'number' },
        harvest_name: { type: 'string' },
        waste_method_id: { type: 'number' },
        waste_amount: { type: 'number' },
        waste_unit_of_measure: { type: 'string' },
        waste_date: { type: 'string' },
        reason_note: { type: 'string' },
      },
      required: ['license_number', 'harvest_id', 'harvest_name', 'waste_method_id', 'waste_amount', 'waste_unit_of_measure', 'waste_date'],
    },
  },
  // Processing
  {
    name: 'metrc_get_processing_active',
    description: 'Get active processing jobs',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  {
    name: 'metrc_get_processing_job_types',
    description: 'Get processing job types',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Sandbox
  {
    name: 'metrc_sandbox_setup',
    description: 'Run sandbox integrator setup to seed test data (sandbox only)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  // Package tags
  {
    name: 'metrc_get_tags_package_available',
    description: 'Get available package tags',
    inputSchema: {
      type: 'object',
      properties: { license_number: { type: 'string' } },
      required: ['license_number'],
    },
  },
  // Pagination
  {
    name: 'metrc_get_packages_with_pagination',
    description: 'Get packages with optional page and pageSize',
    inputSchema: {
      type: 'object',
      properties: {
        license_number: { type: 'string' },
        page: { type: 'number' },
        page_size: { type: 'number' },
      },
      required: ['license_number'],
    },
  },
];

/** Get all tool definitions (MCP format). */
export function getToolsList() {
  return TOOLS;
}

/** Get tool definitions in OpenAI/OpenRouter function-calling format. */
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

/** Look up a single tool by name. */
export function getToolByName(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
