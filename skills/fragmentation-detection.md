# Skill: Fragmentation detection

Use when the user asks: *"Show fragmentation"*, *"Are we breaking new cases instead of using partials?"*, *"Multiple partials for same item?"*, *"Package fragmentation"*.

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — or **metrc_get_packages_with_pagination** if inventory is large.
3. **metrc_get_items** (license_number) — resolve item names.
4. **metrc_get_locations** (license_number) — resolve location names.

## How to summarize

- **Group packages** by ItemId (and optionally LocationId). For each item (and location), count how many packages exist and their quantities.
- **Flag fragmentation:** When the same item (and optionally same location) has **multiple packages** (e.g. 2+ partials), list them and note: "Consider using or consolidating these before opening a new full case."
- **Output:** Short table or list: Item, Location, Package count, Package labels/quantities, Recommendation (e.g. "Use partials first" or "Consider consolidation"). Focus on items with 2+ packages.
- If no multi-partial groups exist, say so and suggest continuing to use full cases first.
