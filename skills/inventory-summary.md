# Skill: Inventory summary

Answer questions like: *What do we have in inventory?*, *By location?*, *By strain?*, *Aging or slow-moving?*

## Tools to call

1. **metrc_get_facilities** – get license_number if needed.
2. **metrc_get_packages** (license_number) – active packages. For large inventories use **metrc_get_packages_with_pagination** (license_number, page, page_size) and aggregate or summarize first page.
3. **metrc_get_harvests** (license_number) – active harvests (inventory not yet packaged).
4. **metrc_get_locations** (license_number) – to resolve location names for packages.
5. **metrc_get_items** (license_number) – to resolve item names.
6. **metrc_get_strains** (license_number) – to resolve strain names if needed.

## How to summarize

- **By item:** Group packages by ItemId (or item name); sum quantities per unit; show count of packages per item.
- **By location:** Group packages by LocationId; resolve to location name; list what's in each location.
- **By strain:** If package data includes StrainId, group by strain and summarize.
- **Aging:** If package data includes PackedDate or similar, list packages older than X days or flag "no date" and suggest reviewing.
- Prefer a short table or bullet list; if the user asked for one dimension (e.g. "by location"), lead with that.
