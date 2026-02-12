# Skill: Aging discount / sampling recommendations

Use when the user asks: *"What's approaching age limits?"*, *"Best for discount or sampling?"*, *"Inventory near shelf life?"*, *"Aging inventory for promo?"*.

## Tools to call

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_packages** (license_number) — or **metrc_get_packages_with_pagination**.
3. **metrc_get_harvests** (license_number) — for harvest-date context.
4. **metrc_get_items** (license_number), **metrc_get_locations** (license_number) — resolve names.

## How to summarize

- **Sort by age:** Use PackedDate, PackageDate, or HarvestDate (from package or linked harvest) to order by oldest first. List the oldest N packages (e.g. top 20 or 10% of total) as "approaching age" or "best for discount/sampling" candidates.
- **No internal thresholds:** METRC does not store your brand or legal shelf-life limits. State: "Below are oldest packages by date. Apply your own age/shelf-life rules to decide discount or sampling."
- **Output:** Table: Package label, Item, Location, Quantity, Age (date or days if computable), Recommendation ("Discount candidate" / "Sampling candidate"). Optionally note harvest name if linked.
- If the user provides a threshold (e.g. "older than 90 days"), filter to packages older than that and list them.
