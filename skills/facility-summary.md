# Skill: Facility summary

Answer questions like: *Summarize the facility*, *What's our state?*, *High-level overview*, *How are we set up?*

## Tools to call (in any order; parallel where possible)

1. **metrc_get_facilities** – facility name(s) and license number(s).
2. **metrc_get_locations** (license_number) – active locations.
3. **metrc_get_strains** (license_number) – active strains.
4. **metrc_get_items** (license_number) – active items/products.
5. **metrc_get_harvests** (license_number) – active harvests.
6. **metrc_get_packages** (license_number) – active packages (or **metrc_get_packages_with_pagination** with page_size if large).
7. **metrc_get_plants_flowering** (license_number) – flowering plant count.
8. **metrc_get_plants_vegetative** (license_number) – vegetative plant count.
9. **metrc_get_plant_batches** (license_number) – active plant batches.
10. **metrc_get_transfers_incoming** / **metrc_get_transfers_outgoing** (license_number) – optional; mention if there are pending transfers.

Use the first facility's license for all license-scoped calls unless the user specified one.

## How to summarize

- **Facility:** Name and license number.
- **Counts:** Locations, strains, items, active harvests, active packages, flowering plants, vegetative plants, plant batches.
- **One line each** for key numbers; then 1–2 sentences on "state" (e.g. "X harvests in progress, Y packages on hand, Z plants in flower."). Optionally mention pending transfers.
