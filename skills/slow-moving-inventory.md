# Skill: Slow / non-moving inventory

Use when the user asks: *"Show slow-moving inventory"*, *"Non-moving packages?"*, *"Inventory not moving?"*, *"Cash tied up in stagnant stock?"*.

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — or **metrc_get_packages_with_pagination** (optionally with page_size to get more).
3. **metrc_get_harvests** (license_number) — unpackaged inventory that might also be aging.
4. **metrc_get_items** (license_number), **metrc_get_locations** (license_number) — resolve names.

## How to summarize

- **Use age when available:** If package data includes PackedDate, PackageDate, or similar, sort by oldest first. List packages (and optionally harvests) that are oldest as "likely slow-moving or non-moving" candidates.
- **Without dates:** If the API does not return dates, list all active packages and note: "Velocity cannot be computed from METRC alone; consider pairing with sales data. Below are all active packages—review by item for items that rarely sell."
- **Output:** Table or list: Package (label), Item, Location, Quantity, Age (if available), Note ("Oldest—review for discount/sample" or "No date—check sales velocity"). Optionally group by Item to show which products have the most stagnant inventory.
- **Caveat:** True velocity (slow vs fast moving) requires sales or movement history; METRC gives current state. This skill identifies aging and suggests further review.
