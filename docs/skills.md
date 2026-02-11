---
title: Skills
layout: default
---

# Analysis skills

Skills are **higher-level analysis patterns**: the LLM uses the [tools](tools) as directed by the skill text to answer questions like “What needs attention?”, “Summarize the facility”, or “Audit in a week — check risk areas.”

Skills are available in two ways:

1. **Cursor** — When this repo is open, rules in `.cursor/rules/` route questions to the right skill.
2. **Any MCP client** — The server exposes skills as **MCP resources**. Call `resources/list`, then `resources/read` with the URI below; pass the returned markdown to the LLM as context.

---

## Skill list

| Skill | When to use | MCP resource URI | Framework section |
|-------|-------------|------------------|-------------------|
| **Needs attention** | “What needs attention?”, “What’s due?”, compliance, expiring tags, stuck items | `metrc://skills/needs-attention` | §1 Bulk, §9 Compliance |
| **Facility summary** | “Summarize the facility”, “What’s our state?”, overview | `metrc://skills/facility-summary` | — |
| **Traceability** | “Where did this package come from?”, “What was produced from harvest X?” | `metrc://skills/traceability` | — |
| **Inventory summary** | “What’s in inventory?”, “By location/strain?”, aging stock | `metrc://skills/inventory-summary` | §3 Inventory intelligence |
| **Audit-ready snapshot** | “Audit in a week — check risk areas”, compliance health check | `metrc://skills/audit-ready-snapshot` | **§9.1** Audit-ready snapshots |
| **FIFO / aging pull** | “What to pull for samples/vendor days/discounting?”, FIFO list | `metrc://skills/fifo-aging-pull` | **§2.1** Intelligent FIFO / aging pull |
| **Skills index** | List of all skills and how to use them | `metrc://skills/README` | — |

---

## Using resources in an external LLM

1. **List resources:** Call MCP `resources/list`. You’ll get URIs like `metrc://skills/needs-attention`, `metrc://skills/facility-summary`, etc.
2. **Read a skill:** Call `resources/read` with `params: { uri: "metrc://skills/needs-attention" }`. The response contains the full skill markdown.
3. **Context:** Add that text to the LLM’s system or user message so it knows which tools to call and how to summarize.
4. **Execute:** The LLM then calls the METRC tools (e.g. `metrc_get_harvests`, `metrc_get_packages`, `metrc_get_tags_plant_available`) and formats the answer per the skill.

---

## Mapping to the Master Framework

The [Master Function & Feature Framework](framework) defines 14 feature areas. Skills above implement or align with:

| Framework section | Implemented as skill / tool |
|-------------------|----------------------------|
| **§1** Bulk & efficiency | Tools support array payloads; “Bulk actions” skill pattern in framework. |
| **§2.1** FIFO / aging pull | **Skill:** [FIFO / aging pull](skills#skill-list) (`metrc://skills/fifo-aging-pull`) |
| **§2.2** Aging discount / sampling | Use inventory summary + package/harvest dates; app for thresholds. |
| **§3** Inventory intelligence | **Skill:** Inventory summary; slow-moving can be added as skill. |
| **§7** Package optimization | Fragmentation / consolidation / sample-out can be added as skills (packages + logic). |
| **§9.1** Audit-ready snapshots | **Skill:** [Audit-ready snapshot](skills#skill-list) (`metrc://skills/audit-ready-snapshot`) |
| **§9.2** Employee self-audit | App for attribution; skill possible if action history available. |
| **§13** Custom reports | LLM + tools = ad-hoc reports; see framework for GUI report builder. |
| **§14** Yield analyzer | Skill can use harvests, packages, lab tests; app for yield modeling. |

See [Framework](framework) for the full mapping of each section to MCP/skills vs app.
