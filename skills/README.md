# METRC analysis skills

Higher-level analysis patterns that use the METRC MCP tools. Use these when the user asks about compliance, facility overview, traceability, or inventory.

| Skill | When to use | Cursor rule | MCP resource URI |
|-------|--------------|-------------|-------------------|
| **Needs attention** | "What needs attention?", "What's due?", compliance, expiring tags, stuck items | `metrc-skill-needs-attention.mdc` | `metrc://skills/needs-attention` |
| **Facility summary** | "Summarize the facility", "What's our state?", high-level overview | `metrc-skill-facility-summary.mdc` | `metrc://skills/facility-summary` |
| **Traceability** | "Where did this package come from?", "What was produced from harvest X?" | `metrc-skill-traceability.mdc` | `metrc://skills/traceability` |
| **Inventory summary** | "What do we have in inventory?", "By location/strain?", aging stock | `metrc-skill-inventory-summary.mdc` | `metrc://skills/inventory-summary` |
| **Audit-ready snapshot** | "Audit in a week — check risk areas", compliance health check | `metrc-skill-audit-ready-snapshot.mdc` | `metrc://skills/audit-ready-snapshot` |
| **FIFO / aging pull** | "What to pull for samples/vendor days/discounting?", FIFO list | `metrc-skill-fifo-aging-pull.mdc` | `metrc://skills/fifo-aging-pull` |
| **Fragmentation detection** | "Show fragmentation?", multiple partials per item | `metrc-skill-fragmentation-detection.mdc` | `metrc://skills/fragmentation-detection` |
| **Sample-out low counts** | "Which low-count packages to sample out?" | `metrc-skill-sample-out-low-counts.mdc` | `metrc://skills/sample-out-low-counts` |
| **Slow-moving inventory** | "Slow-moving or non-moving inventory?" | `metrc-skill-slow-moving-inventory.mdc` | `metrc://skills/slow-moving-inventory` |
| **Aging discount/sampling** | "Approaching age limits?", "Best for discount/sampling?" | `metrc-skill-aging-discount-sampling.mdc` | `metrc://skills/aging-discount-sampling` |
| **Package consolidation** | "Consolidate packages?", "Re-sticker or combine?" | `metrc-skill-package-consolidation.mdc` | `metrc://skills/package-consolidation` |

## How skills are used

- **In Cursor:** Rules in `.cursor/rules/` apply when this repo is open and the METRC MCP is connected.
- **External LLMs (any MCP client):** The METRC MCP server exposes skills as **MCP resources**. Call `resources/list` to see available skills, then `resources/read` with URI `metrc://skills/<name>` (e.g. `metrc://skills/needs-attention`) to fetch the skill text. Inject that into the model context, then call the METRC tools as described in the skill.
- **Without MCP:** Use the markdown files in `skills/` directly (e.g. copy into system prompt or fetch from GitHub raw URLs).

Get the facility `license_number` from `metrc_get_facilities` first if the user hasn't specified one.
