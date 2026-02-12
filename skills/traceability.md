# Skill: Traceability

Answer questions like: *Where did this package come from?*, *What was produced from harvest X?*, *Lineage of this tag.*

## Package → origin (where did this package come from?)

1. **metrc_get_facilities** – get license_number if needed.
2. **metrc_get_package** (license_number, package_label or package_id) – get package details. Note `SourceHarvestId` or harvest identifiers, `SourcePackageId`, `ItemId`, `StrainId` if present.
3. **metrc_get_harvest** (license_number, harvest_id) – if package links to a harvest, get harvest name and dates.
4. **metrc_get_plant_batches** (license_number) – optional; if harvest links to plant batch, mention strain/batch.
5. **metrc_get_strains** (license_number) – resolve strain name from StrainId.
6. **metrc_get_items** (license_number) – resolve item name from ItemId.

Summarize: Package → Harvest (name, date) → Strain; optionally Plant batch. If the package came from another package, note Source package.

## Harvest → outputs (what was produced from this harvest?)

1. **metrc_get_harvest** (license_number, harvest_id) – get harvest name and details.
2. **metrc_get_packages** (license_number) – filter or search results for packages that reference this harvest (e.g. SourceHarvestId or harvest name in metadata). If the API doesn't filter by harvest, list active packages and indicate which ones are linked to this harvest based on the data returned.
3. **metrc_get_lab_test_batches** (license_number, harvest_id) – optional; lab tests for this harvest.

Summarize: Harvest name → list of packages (and optionally lab tests) produced from it.
