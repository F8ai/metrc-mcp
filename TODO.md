# TODO — METRC MCP

Comprehensive roadmap: tools, skills, known issues, and app boundary. Tied to the [Master Function & Feature Framework](https://f8ai.github.io/metrc-mcp/framework).

---

## Legend

- **MCP** = implement in this repo (tools or skills).
- **Skill** = analysis pattern: LLM + existing tools; add `skills/*.md`, `.cursor/rules/*.mdc`, and `metrc://skills/<name>` resource.
- **App** = build in your app (UI, rules engine, external systems); MCP can feed data via tools.

---

## Current state

### Implemented

- **50 MCP tools** — facilities, strains, items, locations, packages (incl. pagination), harvests, plant batches, plants (flowering/vegetative), tags (plant/package), employees, units of measure, waste methods; lookups (harvest, package, plant by ID/label); create/update (location, plant batch/plantings, harvest, packages, items, strains); adjust/finish/unfinish package, move/rename/finish/unfinish harvest, change plant growth phase; transfers (incoming/outgoing), lab tests, waste, processing; sandbox setup.
- **6 analysis skills** — needs-attention, facility-summary, traceability, inventory-summary, audit-ready-snapshot, fifo-aging-pull (with Cursor rules and MCP resources).
- **Docs** — GitHub Pages at https://f8ai.github.io/metrc-mcp/ (getting-started, tools, skills, framework).
- **Tests** — `npm test` (initialize, list tools, call tools; optional credentials).

---

## 1. Tools to implement

### 1.1 Bulk package actions (§1.1)

| Task | Description | Notes |
|------|-------------|--------|
| [x] **Bulk adjust** | Tool that accepts an **array** of package adjustments (label, quantity, unit, reason, date) and calls METRC once. | `metrc_bulk_adjust_packages` added. |
| [x] **Bulk finish packages** | Tool that accepts an array of package labels + actual_date and finishes all. | `metrc_bulk_finish_packages` added. |
| [x] **Bulk change location** | Tool that accepts an array of (label, location_id) and moves all. | `metrc_bulk_change_package_location` added. |
| [ ] **Preview bulk (optional)** | Dry-run / validation tool that returns what *would* change without calling write APIs. | `metrc_preview_bulk_adjustments` or similar; for trust/UX. |

---

## 2. Skills to implement

### 2.1 High priority (METRC data only, high value)

| # | Skill | Framework | Trigger / purpose |
|---|--------|------------|-------------------|
| [x] 1 | **Fragmentation detection** | §7.1 | “Show fragmentation” — `metrc_get_packages`, group by item/location, flag multiple partials where one could be used. |
| [x] 2 | **Sample-out low counts** | §7.3 | “Which low-count packages should we sample out?” — packages + quantity thresholds. |
| [x] 3 | **Slow / non-moving inventory** | §3.1 | “Show slow-moving or non-moving inventory” — packages (and sales if ever available); flag by velocity. |
| [x] 4 | **Aging discount / sampling** | §2.2 | “What’s approaching age limits?”, “Best for discount/sampling?” — package/harvest dates; thresholds = app. |
| [x] 5 | **Package consolidation** | §7.2 | Recommend re-sticker, combine low-counts, simplify selling units (recommendation only). |

### 2.2 Medium priority (METRC + light logic)

| # | Skill | Framework | Trigger / purpose |
|---|--------|------------|-------------------|
| [ ] 6 | **Compliance risk forecast** | §3.2 | “Compliance risk forecast” — packages, harvests, lab; flag expiration/shelf-life/structural risk. |
| [ ] 7 | **Strain / product fit** | §12.1 | “Strain/product recommendations” — `metrc_get_strains`, `metrc_get_items`, `metrc_get_packages`. |
| [ ] 8 | **Yield analysis** | §14.1 | “Yield analysis” — harvests, packages, lab tests, items; yield modeling = app. |
| [ ] 9 | **Smart biomass utilization** | §8.1 | Recommend best use of uneven biomass (packages/harvests/items); heavy logic can stay in app. |
| [ ] 10 | **Tolling (METRC side)** | §11.1 | Skill for yield and inventory from METRC; costs/financials = app. |

### 2.3 Lower priority (need app or external data)

| # | Skill | Framework | Trigger / purpose |
|---|--------|------------|-------------------|
| [ ] 11 | **Key customer fulfillment** | §6.1 | “Will we have enough for key customers?” — packages + (if provided) order history. |
| [ ] 12 | **Custom report** | §13.1 | “Build a report: [dimensions]” — LLM picks tools and shapes output. |
| [ ] 13 | **Employee self-audit** | §9.2 | “Review my recent actions” — only if we have action history; attribution = app. |
| [ ] 14 | **Out-of-trend spot check** | §10 | “Anything out of trend?” — spot checks from current state; trend engine = app. |

---

## 3. Known issues / blockers

| Issue | Description | Status |
|-------|-------------|--------|
| **Colorado create-plantings** | `metrc_create_plant_batch_plantings` returns “Plant Batch Name was not specified” for Colorado sandbox despite sending `PlantBatchName`. Suspect Colorado-specific request shape for `POST /plantbatches/v2/plantings`. | Open — need CO API docs or Postman to confirm payload. |
| **Sandbox location types** | Sandbox may only offer “Centralized Processing Hub” (ForPlants: false), so creating plantings can fail until a plant-capable location exists. | Document in README / getting-started; user may need to create location with correct type. |

---

## 4. Docs & infra

| Task | Description |
|------|-------------|
| [ ] **Skills table in README** | Keep README skills table in sync with `skills/README.md` and `.cursor/rules` when adding skills. |
| [ ] **Framework doc sync** | When adding a skill that maps to a framework section, add the **MCP:** line and URI in `docs/framework.md` (and `docs/MASTER_FRAMEWORK.md` if still used). |
| [ ] **Tools doc** | When adding tools, add to `docs/tools.md` in the right category. |
| [ ] **Changelog** | Optionally add a CHANGELOG.md for releases. |

---

## 5. App vs MCP (reference)

Do **not** implement in this repo; build in your app instead:

- Brand/shelf-life rules and configurable age thresholds.
- Real-time mistake overlay and risk scoring (co-pilot style UI).
- Cross-system reconciliation (METRC ↔ Dutchie, Flowhub, LeafLink, ERPs).
- Employee pattern detection and attribution (unless METRC exposes action history).
- Custom report builder GUI and saved report definitions.
- Cost/financial engine and historical yield DB for tolling.
- Predictive customer fulfillment and CRM integration.
- Trend/velocity store and out-of-trend engine.

MCP supplies METRC data and analysis skills; the app supplies UI, rules, and external data.

---

## 6. Quick checklist for adding a skill

1. Add `skills/<name>.md` (tools to call, how to summarize).
2. Add `.cursor/rules/metrc-skill-<name>.mdc` (when to use, steps).
3. Add to `server.js`: `SKILL_RESOURCES` entry and `skills/<name>.md` in ReadResource handler error message if needed.
4. Update `.cursor/rules/metrc-mcp.mdc` router with the new trigger.
5. Update `skills/README.md` table.
6. Update `docs/skills.md` and, if applicable, `docs/framework.md` with **MCP:** and URI.

---

## 7. Quick checklist for adding a tool

1. Add tool definition to `tools` array in `server.js` (name, description, inputSchema).
2. Add `case 'metrc_<name>':` in the CallTool handler; call `metrcFetch` with correct path/method/body.
3. Add to `docs/tools.md` in the right category.
4. If it supports a framework section, note it in `docs/framework.md`.

---

*Last updated from framework and repo state. For full framework text see [Framework](https://f8ai.github.io/metrc-mcp/framework).*
