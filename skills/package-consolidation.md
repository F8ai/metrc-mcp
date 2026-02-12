# Skill: Package consolidation recommendations

Use when the user asks: *"Should we consolidate packages?"*, *"Re-sticker or combine low-counts?"*, *"Simplify selling units?"*, *"Package consolidation recommendations?"*.

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — or **metrc_get_packages_with_pagination**.
3. **metrc_get_items** (license_number), **metrc_get_locations** (license_number) — resolve names.

## How to summarize

- **Group by item and location:** For each ItemId (and optionally LocationId), list packages and their quantities. Identify groups where multiple small packages could be combined (e.g. several packages of the same item in the same location with low counts).
- **Recommendations:** For each group with 2+ packages and low total or fragmented quantities, suggest: "Consider combining into fewer packages" or "Re-sticker/consolidate to simplify selling units." Note that execution (create new package, adjust/retire others) is a separate workflow and may require package tags and METRC create/adjust steps.
- **Output:** Table or list: Item, Location, Packages (labels + quantities), Total quantity, Recommendation. Do not execute consolidation—only recommend.
- **Caveat:** Actual consolidation requires METRC package creation and adjustments; this skill is analytical only.
