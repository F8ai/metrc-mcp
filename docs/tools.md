---
title: Tools
layout: default
---

# MCP tools

All tools require the METRC MCP server to be connected. Most facility-scoped tools take `license_number`; get it from `metrc_get_facilities`.

---

## Facility & reference (no or single license)

| Tool | Description |
|------|-------------|
| `metrc_get_facilities` | List all facilities and license numbers |
| `metrc_get_units_of_measure` | Active units of measure (no license) |
| `metrc_get_waste_methods` | Waste methods (no license) |
| `metrc_sandbox_setup` | Sandbox only: seed test data |

---

## Read: facilities, strains, items, locations

| Tool | Description |
|------|-------------|
| `metrc_get_strains` | Active strains |
| `metrc_get_items` | Active items (products) |
| `metrc_get_locations` | Active locations |
| `metrc_get_location_types` | Location types (e.g. for creating locations) |

---

## Read: packages, harvests, plants

| Tool | Description |
|------|-------------|
| `metrc_get_packages` | Active packages |
| `metrc_get_packages_with_pagination` | Active packages with page / pageSize |
| `metrc_get_harvests` | Active harvests |
| `metrc_get_plant_batches` | Active plant batches |
| `metrc_get_plants_flowering` | Flowering plants (before harvest) |
| `metrc_get_plants_vegetative` | Vegetative plants |
| `metrc_get_harvests_inactive` | Inactive harvests (optional page) |
| `metrc_get_packages_inactive` | Inactive packages |
| `metrc_get_plant_batches_inactive` | Inactive plant batches |

---

## Lookup by ID or label

| Tool | Description |
|------|-------------|
| `metrc_get_harvest` | Single harvest by ID |
| `metrc_get_package` | Single package by ID or label |
| `metrc_get_plant` | Single plant by ID or label |

---

## Tags & employees

| Tool | Description |
|------|-------------|
| `metrc_get_tags_plant_available` | Available plant tags (for plantings) |
| `metrc_get_tags_package_available` | Available package tags (for new packages) |
| `metrc_get_employees` | Employees for the facility |

---

## Plants: create and change phase

| Tool | Description |
|------|-------------|
| `metrc_get_plant_batch_types` | Plant batch types (Seed, Clone, etc.) |
| `metrc_create_location` | Create a location (use type that allows plants) |
| `metrc_create_plant_batch_plantings` | Create plant batch and plantings (strain, location, type, count, date, plant_labels) |
| `metrc_change_plants_growth_phase` | Change growth phase (e.g. to Flowering) |

---

## Harvests: create and manage

| Tool | Description |
|------|-------------|
| `metrc_harvest_plants` | Create harvest from flowering plants (name, date, plant_ids; CO: plant_labels, weight, unit, drying_location_id) |
| `metrc_create_harvest_packages` | Create packages from a harvest |
| `metrc_move_harvest` | Move harvest to another location |
| `metrc_rename_harvest` | Rename harvest |
| `metrc_finish_harvest` | Finish harvest |
| `metrc_unfinish_harvest` | Unfinish harvest |
| `metrc_post_harvest_waste` | Record waste on a harvest |

---

## Packages: create and manage

| Tool | Description |
|------|-------------|
| `metrc_create_package` | Create a package (tag, location_id, item_id, quantity, unit, actual_date, etc.) |
| `metrc_adjust_package` | Adjust package quantity (label, quantity, unit, reason, date) |
| `metrc_change_package_location` | Change package location |
| `metrc_finish_package` | Finish package (available for sale) |
| `metrc_unfinish_package` | Unfinish package |

---

## Transfers, items, strains, lab, processing

| Tool | Description |
|------|-------------|
| `metrc_get_transfers_incoming` | Incoming transfers |
| `metrc_get_transfers_outgoing` | Outgoing transfers |
| `metrc_create_item` | Create item (product) |
| `metrc_update_item` | Update item |
| `metrc_create_strain` | Create strain |
| `metrc_update_strain` | Update strain |
| `metrc_get_lab_test_types` | Lab test types |
| `metrc_get_lab_test_batches` | Lab test batches (optional package_id, harvest_id) |
| `metrc_get_lab_test_results` | Lab test results |
| `metrc_get_processing_active` | Active processing jobs |
| `metrc_get_processing_job_types` | Processing job types |

---

## Framework mapping

These tools support the [Master Function & Feature Framework](framework): bulk (array payloads), aging/FIFO (packages + harvests), compliance (harvests, packages, tags, transfers), traceability (package/harvest lookups), and reporting (all read tools). See [Framework](framework) for which capabilities are MCP/skills vs app.
