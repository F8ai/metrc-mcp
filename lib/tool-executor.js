/**
 * Shared METRC tool execution logic (FOR-995).
 *
 * Single source of truth for the tool name → METRC API call mapping.
 * Used by both server.js (stdio MCP) and lib/metrc-edge.js (Vercel Edge).
 *
 * The `metrcFetch` function is injected so each environment can supply
 * its own HTTP client (Node Buffer-based vs Edge btoa-based).
 */

import { getToolByName } from './tools.js';
import { validateToolInput } from './validate.js';

/**
 * Execute a METRC MCP tool.
 *
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {Function} metrcFetch - HTTP client: (path, params?, options?) => Promise<any>
 * @returns {Promise<string>} JSON-stringified result
 */
export async function executeTool(name, args = {}, metrcFetch) {
  // Validate tool exists
  const tool = getToolByName(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  // Validate input against schema
  const { valid, errors } = validateToolInput(name, args, tool.inputSchema);
  if (!valid) {
    throw new Error(`Invalid input for ${name}: ${errors.join('; ')}`);
  }

  const data = await executeToolCall(name, args, metrcFetch);
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

async function executeToolCall(name, args, metrcFetch) {
  switch (name) {
    case 'metrc_get_facilities':
      return metrcFetch('/facilities/v2/');

    case 'metrc_get_strains':
      return metrcFetch('/strains/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_items':
      return metrcFetch('/items/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_locations':
      return metrcFetch('/locations/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_packages':
      return metrcFetch('/packages/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_harvests':
      return metrcFetch('/harvests/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_plant_batches':
      return metrcFetch('/plantbatches/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_units_of_measure':
      return metrcFetch('/unitsofmeasure/v2/active');

    case 'metrc_get_waste_methods':
      return metrcFetch('/wastemethods/v2/');

    case 'metrc_get_employees':
      return metrcFetch('/employees/v2/', { licenseNumber: args.license_number });

    case 'metrc_get_plants_flowering':
      return metrcFetch('/plants/v2/flowering', { licenseNumber: args.license_number });

    case 'metrc_harvest_plants': {
      const labels = args.plant_labels || [];
      const ids = args.plant_ids || [];
      const weight = args.weight_per_plant ?? 1;
      const unit = args.unit_of_measure || 'Ounces';
      const dryingId = args.drying_location_id;
      const body = ids.map((id, i) => {
        const o = {
          HarvestName: args.harvest_name,
          HarvestDate: args.harvest_date,
          Id: id,
          Weight: weight,
          UnitOfMeasure: unit,
          ActualDate: args.harvest_date,
        };
        if (labels[i] !== undefined) o.Label = labels[i];
        if (dryingId != null) o.DryingLocationId = dryingId;
        return o;
      });
      return metrcFetch(
        '/plants/v2/harvest',
        { licenseNumber: args.license_number },
        { method: 'PUT', body }
      );
    }

    case 'metrc_get_location_types':
      return metrcFetch('/locations/v2/types', { licenseNumber: args.license_number });

    case 'metrc_create_location':
      return metrcFetch(
        '/locations/v2/',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [{ Name: args.name, LocationTypeId: args.location_type_id }] }
      );

    case 'metrc_get_tags_plant_available':
      return metrcFetch('/tags/v2/plant/available', { licenseNumber: args.license_number });

    case 'metrc_get_plant_batch_types':
      return metrcFetch('/plantbatches/v2/types', { licenseNumber: args.license_number });

    case 'metrc_get_plants_vegetative':
      return metrcFetch('/plants/v2/vegetative', { licenseNumber: args.license_number });

    case 'metrc_create_plant_batch_plantings': {
      let plantLabels = args.plant_labels;
      if (typeof plantLabels === 'string') plantLabels = JSON.parse(plantLabels);
      plantLabels = Array.isArray(plantLabels) ? plantLabels : [];
      const batchName = String(args.plant_batch_name ?? '').trim();
      if (!batchName) throw new Error('plant_batch_name is required');
      const arrayBody = plantLabels.map((label) => {
        const o = {
          PlantBatchName: batchName,
          Type: args.type,
          Count: 1,
          LocationId: args.location_id,
          ActualDate: args.planting_date,
          PlantLabel: label,
        };
        if (args.strain_name) o.Strain = args.strain_name;
        else o.StrainId = args.strain_id;
        return o;
      });
      return metrcFetch(
        '/plantbatches/v2/plantings',
        { licenseNumber: args.license_number },
        { method: 'POST', body: arrayBody }
      );
    }

    case 'metrc_change_plants_growth_phase': {
      const ids = args.plant_ids || [];
      const labels = args.plant_labels || [];
      const entry = { GrowthPhase: args.growth_phase, GrowthDate: args.change_date };
      if (args.new_location) entry.NewLocation = args.new_location;
      const body = [
        ...ids.map((Id) => ({ Id, ...entry })),
        ...labels.map((Label) => ({ Label, ...entry })),
      ];
      if (body.length === 0) throw new Error('Provide plant_ids or plant_labels');
      return metrcFetch(
        '/plants/v2/growthphase',
        { licenseNumber: args.license_number },
        { method: 'PUT', body }
      );
    }

    case 'metrc_change_plant_batch_growth_phase': {
      const body = [{
        Name: args.plant_batch_name,
        Count: args.count,
        StartingTag: args.starting_tag,
        GrowthPhase: args.growth_phase,
        GrowthDate: args.growth_date,
        NewLocation: args.new_location,
      }];
      return metrcFetch(
        '/plantbatches/v2/growthphase',
        { licenseNumber: args.license_number },
        { method: 'POST', body }
      );
    }

    case 'metrc_get_harvest':
      return metrcFetch(`/harvests/v2/${args.harvest_id}`, { licenseNumber: args.license_number });

    case 'metrc_get_package':
      if (args.package_label != null) {
        return metrcFetch(`/packages/v2/${encodeURIComponent(args.package_label)}`, { licenseNumber: args.license_number });
      } else if (args.package_id != null) {
        return metrcFetch(`/packages/v2/${args.package_id}`, { licenseNumber: args.license_number });
      }
      throw new Error('Provide package_id or package_label');

    case 'metrc_get_plant':
      if (args.plant_label != null) {
        return metrcFetch(`/plants/v2/${encodeURIComponent(args.plant_label)}`, { licenseNumber: args.license_number });
      } else if (args.plant_id != null) {
        return metrcFetch(`/plants/v2/${args.plant_id}`, { licenseNumber: args.license_number });
      }
      throw new Error('Provide plant_id or plant_label');

    case 'metrc_create_package': {
      const pkg = {
        Tag: args.tag,
        LocationId: args.location_id,
        ItemId: args.item_id,
        Quantity: args.quantity,
        UnitOfMeasure: args.unit_of_measure,
        IsProductionBatch: args.is_production_batch ?? false,
        ProductRequiresRemediation: args.product_requires_remediation ?? false,
        ActualDate: args.actual_date,
      };
      if (args.ingredients) pkg.Ingredients = args.ingredients;
      return metrcFetch(
        '/packages/v2/',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [pkg] }
      );
    }

    case 'metrc_create_harvest_packages':
      return metrcFetch(
        '/harvests/v2/packages',
        { licenseNumber: args.license_number },
        { method: 'POST', body: args.packages }
      );

    case 'metrc_adjust_package': {
      const adjBody = [{
        Label: args.label,
        Quantity: args.quantity,
        UnitOfMeasure: args.unit_of_measure,
        AdjustmentReason: args.adjustment_reason,
        AdjustmentDate: args.adjustment_date,
        ReasonNote: args.reason_note || '',
      }];
      return metrcFetch(
        '/packages/v2/adjust',
        { licenseNumber: args.license_number },
        { method: 'POST', body: adjBody }
      );
    }

    case 'metrc_change_package_location':
      return metrcFetch(
        '/packages/v2/location',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Label: args.label, LocationId: args.location_id }] }
      );

    case 'metrc_finish_package':
      return metrcFetch(
        '/packages/v2/finish',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Label: args.label, ActualDate: args.actual_date }] }
      );

    case 'metrc_unfinish_package':
      return metrcFetch(
        '/packages/v2/unfinish',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Label: args.label, ActualDate: args.actual_date }] }
      );

    case 'metrc_bulk_adjust_packages': {
      const adjustments = Array.isArray(args.adjustments) ? args.adjustments : [];
      if (adjustments.length === 0) throw new Error('adjustments array is required and must not be empty');
      const adjBody = adjustments.map((a) => ({
        Label: a.label,
        Quantity: a.quantity,
        UnitOfMeasure: a.unit_of_measure,
        AdjustmentReason: a.adjustment_reason,
        AdjustmentDate: a.adjustment_date,
        ReasonNote: a.reason_note || '',
      }));
      return metrcFetch(
        '/packages/v2/adjust',
        { licenseNumber: args.license_number },
        { method: 'POST', body: adjBody }
      );
    }

    case 'metrc_bulk_finish_packages': {
      const labels = Array.isArray(args.labels) ? args.labels : [];
      if (labels.length === 0) throw new Error('labels array is required and must not be empty');
      return metrcFetch(
        '/packages/v2/finish',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: labels.map((l) => ({ Label: l, ActualDate: args.actual_date })) }
      );
    }

    case 'metrc_bulk_change_package_location': {
      const moves = Array.isArray(args.moves) ? args.moves : [];
      if (moves.length === 0) throw new Error('moves array is required and must not be empty');
      return metrcFetch(
        '/packages/v2/location',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: moves.map((m) => ({ Label: m.label, LocationId: m.location_id })) }
      );
    }

    case 'metrc_move_harvest':
      return metrcFetch(
        '/harvests/v2/location',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Id: args.harvest_id, LocationId: args.location_id }] }
      );

    case 'metrc_rename_harvest':
      return metrcFetch(
        '/harvests/v2/rename',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Id: args.harvest_id, NewName: args.new_name }] }
      );

    case 'metrc_finish_harvest':
      return metrcFetch(
        '/harvests/v2/finish',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Id: args.harvest_id, ActualDate: args.actual_date }] }
      );

    case 'metrc_unfinish_harvest':
      return metrcFetch(
        '/harvests/v2/unfinish',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [{ Id: args.harvest_id, ActualDate: args.actual_date }] }
      );

    case 'metrc_get_harvests_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      return metrcFetch('/harvests/v2/inactive', q);
    }

    case 'metrc_get_packages_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      return metrcFetch('/packages/v2/inactive', q);
    }

    case 'metrc_get_plant_batches_inactive': {
      const q = { licenseNumber: args.license_number };
      if (args.page_size != null) q.pageSize = args.page_size;
      if (args.page != null) q.page = args.page;
      return metrcFetch('/plantbatches/v2/inactive', q);
    }

    case 'metrc_get_transfers_incoming':
      return metrcFetch('/transfers/v2/incoming', { licenseNumber: args.license_number });

    case 'metrc_get_transfers_outgoing':
      return metrcFetch('/transfers/v2/outgoing', { licenseNumber: args.license_number });

    case 'metrc_create_item': {
      const item = {
        Name: args.name,
        ItemCategory: args.item_category,
        UnitOfMeasure: args.unit_of_measure,
        StrainId: args.strain_id,
        ItemBrand: args.item_brand,
        AdministrationMethod: args.administration_method,
        UnitCbdPercent: args.unit_cbd_percent,
        UnitCbdContent: args.unit_cbd_content,
        UnitCbdContentUnit: args.unit_cbd_content_unit,
        UnitThcPercent: args.unit_thc_percent,
        UnitThcContent: args.unit_thc_content,
        UnitThcContentUnit: args.unit_thc_content_unit,
      };
      Object.keys(item).forEach((k) => item[k] == null && delete item[k]);
      return metrcFetch(
        '/items/v2/',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [item] }
      );
    }

    case 'metrc_update_item': {
      const item = {
        Id: args.id,
        Name: args.name,
        ItemCategory: args.item_category,
        UnitOfMeasure: args.unit_of_measure,
      };
      Object.keys(item).forEach((k) => item[k] == null && k !== 'Id' && delete item[k]);
      return metrcFetch(
        '/items/v2/',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [item] }
      );
    }

    case 'metrc_create_strain': {
      const strain = {
        Name: args.name,
        TestingStatus: args.testing_status,
        ThcLevel: args.thc_level,
        CbdLevel: args.cbd_level,
        IndicaPercentage: args.indica_percentage,
        SativaPercentage: args.sativa_percentage,
        Genetics: args.genetics,
      };
      Object.keys(strain).forEach((k) => strain[k] == null && delete strain[k]);
      return metrcFetch(
        '/strains/v2/',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [strain] }
      );
    }

    case 'metrc_update_strain': {
      const strain = {
        Id: args.id,
        Name: args.name,
        TestingStatus: args.testing_status,
        ThcLevel: args.thc_level,
        CbdLevel: args.cbd_level,
        IndicaPercentage: args.indica_percentage,
        SativaPercentage: args.sativa_percentage,
        Genetics: args.genetics,
      };
      Object.keys(strain).forEach((k) => strain[k] == null && k !== 'Id' && delete strain[k]);
      return metrcFetch(
        '/strains/v2/',
        { licenseNumber: args.license_number },
        { method: 'PUT', body: [strain] }
      );
    }

    case 'metrc_get_lab_test_types':
      return metrcFetch('/labtests/v2/types', { licenseNumber: args.license_number });

    case 'metrc_get_lab_test_batches': {
      const q = { licenseNumber: args.license_number };
      if (args.package_id != null) q.packageId = args.package_id;
      if (args.harvest_id != null) q.harvestId = args.harvest_id;
      return metrcFetch('/labtests/v2/batches', q);
    }

    case 'metrc_get_lab_test_results': {
      const q = { licenseNumber: args.license_number };
      if (args.package_id != null) q.packageId = args.package_id;
      if (args.harvest_id != null) q.harvestId = args.harvest_id;
      return metrcFetch('/labtests/v2/results', q);
    }

    case 'metrc_post_harvest_waste':
      return metrcFetch(
        '/harvests/v2/waste',
        { licenseNumber: args.license_number },
        {
          method: 'POST',
          body: [{
            HarvestId: args.harvest_id,
            HarvestName: args.harvest_name,
            WasteMethodId: args.waste_method_id,
            WasteAmount: args.waste_amount,
            WasteUnitOfMeasure: args.waste_unit_of_measure,
            WasteDate: args.waste_date,
            ReasonNote: args.reason_note || '',
          }],
        }
      );

    case 'metrc_get_processing_active':
      return metrcFetch('/processing/v2/active', { licenseNumber: args.license_number });

    case 'metrc_get_processing_job_types':
      return metrcFetch('/processing/v2/jobtypes/active', { licenseNumber: args.license_number });

    case 'metrc_sandbox_setup':
      return metrcFetch('/sandbox/v2/integrator/setup', {}, { method: 'POST', body: {} });

    case 'metrc_get_tags_package_available':
      return metrcFetch('/tags/v2/package/available', { licenseNumber: args.license_number });

    case 'metrc_get_packages_with_pagination': {
      const q = { licenseNumber: args.license_number };
      if (args.page != null) q.page = args.page;
      if (args.page_size != null) q.pageSize = args.page_size;
      return metrcFetch('/packages/v2/active', q);
    }

    // Sales
    case 'metrc_get_sales_receipts': {
      const q = { licenseNumber: args.license_number };
      if (args.page != null) q.page = args.page;
      if (args.page_size != null) q.pageSize = args.page_size;
      return metrcFetch('/sales/v2/receipts/active', q);
    }

    case 'metrc_get_sales_customer_types':
      return metrcFetch('/sales/v2/customertypes', { licenseNumber: args.license_number });

    case 'metrc_create_sales_receipt': {
      const receipt = {
        SalesDate: args.receipt_date,
        SalesCustomerType: args.sales_customer_type,
        Transactions: args.transactions,
      };
      if (args.patient_license_number) receipt.PatientLicenseNumber = args.patient_license_number;
      if (args.caregiver_license_number) receipt.CaregiverLicenseNumber = args.caregiver_license_number;
      return metrcFetch(
        '/sales/v2/receipts',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [receipt] }
      );
    }

    // Transfers (extended)
    case 'metrc_get_transfer_types':
      return metrcFetch('/transfers/v2/types', { licenseNumber: args.license_number });

    case 'metrc_create_transfer': {
      const transfer = {
        ShipperLicenseNumber: args.shipper_license_number,
        TransferTypeName: args.transfer_type_name,
        EstimatedDepartureDateTime: args.estimated_departure_date,
        EstimatedArrivalDateTime: args.estimated_arrival_date,
        Packages: args.packages,
      };
      if (args.transporter_license_number) {
        transfer.Transporters = [{
          TransporterLicenseNumber: args.transporter_license_number,
          EstimatedDepartureDateTime: args.estimated_departure_date,
          EstimatedArrivalDateTime: args.estimated_arrival_date,
        }];
      }
      return metrcFetch(
        '/transfers/v2/external/incoming',
        { licenseNumber: args.license_number },
        { method: 'POST', body: [transfer] }
      );
    }

    case 'metrc_get_transfer_deliveries':
      return metrcFetch(`/transfers/v2/${args.transfer_id}/deliveries`, { licenseNumber: args.license_number });

    case 'metrc_get_transfer_packages':
      return metrcFetch(`/transfers/v2/deliveries/${args.delivery_id}/packages`, { licenseNumber: args.license_number });

    // Lab Tests (record) & Processing (remediate) & Item Categories
    case 'metrc_record_lab_test_results': {
      const body = [{
        PackageLabel: args.package_label,
        ResultDate: args.result_date,
        OverallPassed: args.overall_passed,
        Results: args.results,
      }];
      return metrcFetch(
        '/labtests/v2/record',
        { licenseNumber: args.license_number },
        { method: 'POST', body }
      );
    }

    case 'metrc_get_item_categories': {
      const q = {};
      if (args.license_number) q.licenseNumber = args.license_number;
      return metrcFetch('/items/v1/categories', q);
    }

    case 'metrc_remediate_package':
      return metrcFetch(
        '/packages/v2/remediate',
        { licenseNumber: args.license_number },
        {
          method: 'POST',
          body: [{
            Label: args.package_label,
            RemediationMethodName: args.remediation_method,
            RemediationDate: args.remediation_date,
          }],
        }
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
