# Skill: Sample-out low counts

Use when the user asks: *"Which low-count packages should we sample out?"*, *"Packages good for samples or sales incentives?"*, *"Low quantity packages for sampling?"*.

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — or **metrc_get_packages_with_pagination**.
3. **metrc_get_items** (license_number), **metrc_get_locations** (license_number), **metrc_get_strains** (license_number) — resolve names.

## How to summarize

- **Apply a quantity threshold:** Consider "low count" as packages where Quantity is below a reasonable threshold (e.g. under 5 units, or under 1 unit for flower, or a threshold the user may specify). If the user gave a number, use it; otherwise use a default (e.g. quantity &lt; 5 or smallest 10% of packages).
- **List candidates:** For each low-count package, show Label, Item, Location, Quantity, Unit. Add a one-line note: "Suitable for samples" or "Sales incentive candidate."
- **Output:** Short table: Package label, Item, Location, Quantity, Unit, Recommendation. Optionally suggest moving these to a dedicated "samples" location or tagging for promo use.
- If no packages meet the threshold, say so and suggest lowering the threshold or checking again after more sales.
