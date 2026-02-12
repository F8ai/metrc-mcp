# Skill: Needs attention

Answer questions like: *What needs attention?*, *What's due?*, *Compliance issues?*, *Expiring tags?*, *Anything stuck?*

## Tools to call (in any order; parallel where possible)

1. **metrc_get_facilities** – get `license_number` if not provided by user.
2. **metrc_get_tags_plant_available** (license_number) – low count = need to order plant tags.
3. **metrc_get_tags_package_available** (license_number) – low count = need to order package tags.
4. **metrc_get_harvests** (license_number) – active harvests not yet finished or packaged may need attention.
5. **metrc_get_harvests_inactive** (license_number) – optional; compare if checking completion.
6. **metrc_get_packages** (license_number) – unfinished packages, or packages that need testing/movement.
7. **metrc_get_transfers_incoming** (license_number) – pending incoming transfers.
8. **metrc_get_transfers_outgoing** (license_number) – pending outgoing transfers.

## How to summarize

- **Tags:** If plant or package available counts are low (e.g. &lt; 10), flag "Order more plant/package tags."
- **Harvests:** List active harvests with no packages yet, or harvests not finished; suggest "Finish harvest" or "Create harvest packages."
- **Packages:** Note packages that are Unfinished; suggest "Finish package" or "Change location" if relevant.
- **Transfers:** List incoming/outgoing that are not in a terminal state; suggest following up.
- Keep the reply concise: bullet list by category, then 1–2 sentence recommendation if needed.
