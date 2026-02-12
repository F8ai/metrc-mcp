# Skill: Audit-ready snapshot

Use when the user asks: *"We have an audit in a week — check common risk areas"*, *"Audit readiness"*, *"Compliance health check"*, *"What should we clean up before an audit?"*

## Tools to call (in parallel where possible)

1. **metrc_get_facilities** — get license_number.
2. **metrc_get_harvests** (license_number) — active harvests; flag unfinished or very old.
3. **metrc_get_harvests_inactive** (license_number) — optional; compare if checking completion.
4. **metrc_get_packages** (license_number) — active packages; flag Unfinished, or packages with missing/odd data.
5. **metrc_get_packages_inactive** (license_number) — optional.
6. **metrc_get_tags_plant_available** (license_number) — low count = tag risk.
7. **metrc_get_tags_package_available** (license_number) — low count = tag risk.
8. **metrc_get_transfers_incoming** (license_number) — stuck or overdue transfers.
9. **metrc_get_transfers_outgoing** (license_number) — stuck or overdue.
10. **metrc_get_locations** (license_number) — ensure all in use are valid.
11. **metrc_get_plants_flowering** / **metrc_get_plants_vegetative** (license_number) — ensure plants match harvest/package expectations.

## How to summarize (audit-ready snapshot)

- **Health summary:** One paragraph: overall state (e.g. "X active harvests, Y packages, Z plants; N incoming and M outgoing transfers.").
- **Risk areas:** Bullet list:
  - Harvests: any active harvests not finished or not packaged; harvests sitting too long.
  - Packages: Unfinished packages; packages with no or stale lab linkage if required; duplicate or fragmented partials.
  - Tags: Low plant or package tag counts (e.g. &lt; 10).
  - Transfers: Incoming/outgoing not in a terminal state; overdue or stuck.
  - Data: Missing locations, items, or strains; orphaned or inconsistent references.
- **Recommendations:** 3–5 concrete actions (e.g. "Finish harvest H-123", "Complete transfer T-456", "Order package tags").
- Keep tone factual and suitable for an auditor; avoid speculation.
