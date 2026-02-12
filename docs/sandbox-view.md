---
title: "Sandbox view — Colorado"
layout: default
---

# Sandbox view — Colorado

A single reference for everything in the **Colorado METRC sandbox**: what exists, how it’s linked, and which [tools](tools), [skills](skills), and [framework](framework) items to use. Use this page to navigate the sandbox and the docs.

**Environment:** [Colorado sandbox](https://sandbox-api-co.metrc.com) · **Default license:** `SF-SBX-CO-1-8002` (Accelerator Cultivation). Get licenses via [**metrc_get_facilities**](tools#facility--reference-no-or-single-license).

---

## 1. License and facility

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Facilities** | Multiple (Cultivation, Manufacturer, Store, etc.) | [metrc_get_facilities](tools#facility--reference-no-or-single-license) | Every skill needs `license_number`; get it here. |
| **License number** | e.g. `SF-SBX-CO-1-8002` | Same | Pass to all facility-scoped tools. |

---

## 2. Reference data (no or single license)

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Units of measure** | Ounces, Grams, Pounds, Each, etc. | [metrc_get_units_of_measure](tools#facility--reference-no-or-single-license) | [FIFO / aging pull](skills#skill-list), [Inventory summary](skills#skill-list), packaging. |
| **Waste methods** | For harvest/package waste | [metrc_get_waste_methods](tools#facility--reference-no-or-single-license) | [metrc_post_harvest_waste](tools#harvests-create-and-manage). |
| **Sandbox setup** | Seeds test data | [metrc_sandbox_setup](tools#facility--reference-no-or-single-license) | Optional before [populate script](#8-populate-script). |

---

## 3. Strains

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Strains** | e.g. SBX Strain 1, 2, … (12 after populate) | [metrc_get_strains](tools#read-facilities-strains-items-locations) · [metrc_get_harvest](tools#lookup-by-id-or-label) · [metrc_create_strain](tools#transfers-items-strains-lab-processing) · [metrc_update_strain](tools#transfers-items-strains-lab-processing) | [Traceability](skills#skill-list) · [Strain/product fit](framework#12-ai-strain--cross-intelligence) · [FIFO / aging](skills#skill-list). |
| **Lookup** | By ID | [metrc_get_harvest](tools#lookup-by-id-or-label) (harvest) | Package/harvest lineage. |

Strains are referenced by **Id** and **Name** in plant batches, harvests, items, and packages. Use strains when creating [plantings](#5-plants--plant-batches), [items](#6-items), and for reporting by strain.

---

## 4. Locations and location types

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Location types** | e.g. Centralized Processing Hub (ForPlants, ForPackages vary) | [metrc_get_location_types](tools#plants-create-and-change-phase) | Need a type with **ForPlants: true** to create plantings. |
| **Locations** | e.g. SBX Centralized Processing Hub Location 1 | [metrc_get_locations](tools#read-facilities-strains-items-locations) · [metrc_create_location](tools#plants-create-and-change-phase) | [Facility summary](skills#skill-list) · [Inventory by location](skills#skill-list) · [Fragmentation](skills#skill-list). |
| **Use** | Plants, harvests, packages | — | Drying location for [harvest](tools#harvests-create-and-manage); location for [packages](tools#packages-create-and-manage). |

Colorado sandbox may only expose types with **ForPlants: false**; then plantings are skipped until a plant-capable type exists. See [Populate script](#8-populate-script).

---

## 5. Plants and plant batches

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Plant batch types** | Seed, Clone, Genetic Material | [metrc_get_plant_batch_types](tools#plants-create-and-change-phase) | Create plantings. |
| **Plant tags (available)** | Many (for new plantings) | [metrc_get_tags_plant_available](tools#tags--employees) | [metrc_create_plant_batch_plantings](tools#plants-create-and-change-phase). |
| **Plant batches** | After create plantings | [metrc_get_plant_batches](tools#read-packages-harvests-plants) · [metrc_get_plant_batches_inactive](tools#read-packages-harvests-plants) | [Traceability](skills#skill-list). |
| **Vegetative plants** | Before moving to flowering | [metrc_get_plants_vegetative](tools#read-packages-harvests-plants) · [metrc_change_plants_growth_phase](tools#plants-create-and-change-phase) | Seed → vegetative → flowering. |
| **Flowering plants** | Required before harvest | [metrc_get_plants_flowering](tools#read-packages-harvests-plants) | [metrc_harvest_plants](tools#harvests-create-and-manage). |
| **Single plant** | By ID or label | [metrc_get_plant](tools#lookup-by-id-or-label) | Traceability. |

Lifecycle: **Plantings** (Seed/Clone) → **Vegetative** → **Flowering** → **Harvest**. All steps require a location that allows plants except harvest (drying location).

---

## 6. Harvests

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Active harvests** | After harvesting flowering plants | [metrc_get_harvests](tools#read-packages-harvests-plants) · [metrc_get_harvest](tools#lookup-by-id-or-label) | [Audit-ready snapshot](skills#skill-list) · [FIFO / aging](skills#skill-list) · [Traceability](skills#skill-list). |
| **Create harvest** | From flowering plants | [metrc_harvest_plants](tools#harvests-create-and-manage) | Colorado: plant_labels, weight, unit, drying_location_id. |
| **Harvest actions** | Move, rename, finish, waste | [metrc_move_harvest](tools#harvests-create-and-manage) · [metrc_rename_harvest](tools#harvests-create-and-manage) · [metrc_finish_harvest](tools#harvests-create-and-manage) · [metrc_post_harvest_waste](tools#harvests-create-and-manage) | [Needs attention](skills#skill-list) · §9 [Compliance](framework#9-compliance-confidence-tools). |
| **Packages from harvest** | Create packages from a harvest | [metrc_create_harvest_packages](tools#packages-create-and-manage) | Seed-to-sale completion. |
| **Inactive harvests** | Finished or historical | [metrc_get_harvests_inactive](tools#read-packages-harvests-plants) | Audit, reconciliation. |

---

## 7. Packages

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Active packages** | Saleable or in-progress | [metrc_get_packages](tools#read-packages-harvests-plants) · [metrc_get_packages_with_pagination](tools#read-packages-harvests-plants) | [Inventory summary](skills#skill-list) · [Fragmentation](skills#skill-list) · [Sample-out](skills#skill-list) · [FIFO](skills#skill-list). |
| **Single package** | By ID or label | [metrc_get_package](tools#lookup-by-id-or-label) | [Traceability](skills#skill-list). |
| **Package tags (available)** | For new packages | [metrc_get_tags_package_available](tools#tags--employees) | [metrc_create_package](tools#packages-create-and-manage) · [metrc_create_harvest_packages](tools#packages-create-and-manage). |
| **Create package** | Standalone or from harvest | [metrc_create_package](tools#packages-create-and-manage) · [metrc_create_harvest_packages](tools#packages-create-and-manage) | §1 [Bulk](framework#1-bulk--efficiency-tools). |
| **Adjust / move / finish** | Single or bulk | [metrc_adjust_package](tools#packages-create-and-manage) · [metrc_change_package_location](tools#packages-create-and-manage) · [metrc_finish_package](tools#packages-create-and-manage) · [metrc_bulk_*](tools#packages-create-and-manage) | [Needs attention](skills#skill-list) · §7 [Package optimization](framework#7-package-optimization--cleanup). |
| **Inactive packages** | Finished or retired | [metrc_get_packages_inactive](tools#read-packages-harvests-plants) | Audit. |

---

## 8. Items (products)

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Items** | e.g. Flower - Usable (after populate) | [metrc_get_items](tools#read-facilities-strains-items-locations) · [metrc_create_item](tools#transfers-items-strains-lab-processing) · [metrc_update_item](tools#transfers-items-strains-lab-processing) | Required to create packages. [Inventory summary](skills#skill-list) · [Strain/product](framework#12-ai-strain--cross-intelligence). |

Items are referenced by **ItemId** when creating or inspecting packages.

---

## 9. Transfers, lab, waste, processing

| What | In sandbox | Tools | Skills / framework |
|------|------------|--------|---------------------|
| **Transfers** | Incoming / outgoing | [metrc_get_transfers_incoming](tools#transfers-items-strains-lab-processing) · [metrc_get_transfers_outgoing](tools#transfers-items-strains-lab-processing) | [Needs attention](skills#skill-list) · [Audit-ready snapshot](skills#skill-list). |
| **Lab tests** | Types, batches, results | [metrc_get_lab_test_types](tools#transfers-items-strains-lab-processing) · [metrc_get_lab_test_batches](tools#transfers-items-strains-lab-processing) · [metrc_get_lab_test_results](tools#transfers-items-strains-lab-processing) | [Traceability](skills#skill-list) · §14 [Yield](framework#14-yield-analyzer). |
| **Processing** | Active jobs, job types | [metrc_get_processing_active](tools#transfers-items-strains-lab-processing) · [metrc_get_processing_job_types](tools#transfers-items-strains-lab-processing) | §11 [Tolling](framework#11-tolling-calculator). |

---

## 10. Lifecycle (seed → sale) — tools and skills

Flow in the sandbox and where to use tools/skills:

| Stage | What happens | Tools | Skills |
|-------|----------------|-------|--------|
| **1. Seed/clone** | Plant batch + plantings | [metrc_get_location_types](tools#plants-create-and-change-phase) · [metrc_create_location](tools#plants-create-and-change-phase) · [metrc_get_tags_plant_available](tools#tags--employees) · [metrc_get_plant_batch_types](tools#plants-create-and-change-phase) · [metrc_create_plant_batch_plantings](tools#plants-create-and-change-phase) | — |
| **2. Vegetative** | Plants in veg | [metrc_get_plants_vegetative](tools#read-packages-harvests-plants) | — |
| **3. Flowering** | Move to flower | [metrc_change_plants_growth_phase](tools#plants-create-and-change-phase) | — |
| **4. Harvest** | Harvest flowering plants | [metrc_get_plants_flowering](tools#read-packages-harvests-plants) · [metrc_harvest_plants](tools#harvests-create-and-manage) | — |
| **5. Package** | Create packages from harvest | [metrc_get_items](tools#read-facilities-strains-items-locations) · [metrc_get_tags_package_available](tools#tags--employees) · [metrc_create_harvest_packages](tools#packages-create-and-manage) | — |
| **6. Sale-ready** | Finish packages | [metrc_finish_package](tools#packages-create-and-manage) · [metrc_bulk_finish_packages](tools#packages-create-and-manage) | — |
| **Ongoing** | Query and analyze | All read tools | [Facility summary](skills#skill-list) · [Needs attention](skills#skill-list) · [Audit-ready](skills#skill-list) · [FIFO](skills#skill-list) · [Fragmentation](skills#skill-list) · [Sample-out](skills#skill-list) · [Traceability](skills#skill-list) · [Inventory summary](skills#skill-list) |

---

## 11. Populate script

The repo includes a script that seeds the Colorado sandbox with **12 strains** and a full lifecycle (plantings → flowering → harvest → packages → finish) where the API allows:

- **Run:** `npm run populate-sandbox` (see [README](https://github.com/F8ai/metrc-mcp#populate-sandbox-full-lifecycle)).
- **Requires:** `.env` with `METRC_VENDOR_API_KEY` and `METRC_USER_API_KEY`.
- **Creates:** Strains (SBX Strain 1–12), optional plant location, plantings (if ForPlants location exists), harvest(s), item(s), packages, and finishes packages.
- **Limits:** If the sandbox has no location type with **ForPlants: true**, plantings are skipped; you still get strains and items (and standalone packages if the API allows).

After running, use [metrc_get_facilities](tools#facility--reference-no-or-single-license), [metrc_get_strains](tools#read-facilities-strains-items-locations), [metrc_get_harvests](tools#read-packages-harvests-plants), [metrc_get_packages](tools#read-packages-harvests-plants) to inspect the sandbox.

---

## 12. Quick links

| Doc | Purpose |
|-----|---------|
| [Getting started](getting-started) | Setup, credentials, MCP config |
| [Tools](tools) | All MCP tools by category |
| [Skills](skills) | Analysis skills and MCP resource URIs |
| [Master Framework](framework) | Feature framework (bulk, aging, compliance, yield, etc.) |
| [Framework Q&A](framework-qa) | Example questions and answers per framework item |

---

[← Back to documentation](index.md) | [Tools](tools) | [Skills](skills) | [Framework](framework)
