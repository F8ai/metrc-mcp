# Skill: FIFO / aging pull recommendations

Use when the user asks: *"What should I pull for samples?"*, *"What to use for vendor days?"*, *"Best packages for discounting?"*, *"FIFO pull list"*, *"What’s oldest inventory we should use first?"*

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — need PackageDate, HarvestId, ItemId, Quantity, UnitOfMeasure, LocationId. If the API returns PackedDate or similar, use it for age.
3. **metrc_get_harvests** (license_number) — HarvestDate for harvest-aged context.
4. **metrc_get_locations** (license_number) — resolve location names.
5. **metrc_get_items** (license_number) — resolve item names.
6. **metrc_get_strains** (license_number) — if package has StrainId.

## How to recommend (FIFO / aging)

- **Sort by age:** Prefer packages (or harvest-linked packages) with the **oldest** PackedDate, PackageDate, or HarvestDate first. If only harvest date exists, use that as proxy for “age.”
- **Use case:** If user said "samples" or "vendor days" or "sales kits" — prefer older but still compliant inventory; list by item/location with oldest first. If "discounting" — same; flag oldest per item as discount candidates.
- **Warnings to include:**
  - "Consider using partial/low-count packages before breaking a new full case" — i.e. if multiple packages exist for same item, list partials first.
  - "Older inventory available" — if user might be about to pull a newer package, note that older packages exist and suggest pulling those first.
- **Output:** Short table or list: Package (label or id), Item, Location, Quantity, Age (date or “oldest in set”), and a one-line recommendation (e.g. "Use for samples," "Use for discount," "Use first before opening new case").
- If no date fields are in the response, say so and list by package/id only; suggest checking METRC for dates.
