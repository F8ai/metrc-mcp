---
title: "Adam Freed – Questions & How This MCP Answers Them"
layout: default
---

# Adam Freed – Questions & How This MCP Answers Them

This page records **questions from Adam Freed** and describes **how the METRC MCP can answer them**. Use the [Chat UI](chat/) or any MCP client (Cursor, Claude Desktop) with this server; ask the question in natural language and the model will call the right tools and return an answer. We add **example Q&A** below as we run them (ask in chat, paste answer here).

**See live sandbox state:** [Sandbox view](/sandbox) — load facilities, pick one, then refresh to see its data. **Check other facilities** by switching the facility dropdown and clicking Refresh (e.g. Manufacturer has items, Cultivation has strains/locations; see [Sandbox view — Checking other facilities](sandbox-view#checking-other-facilities)).

**Richer examples:** To get non-zero package/harvest data in the Colorado sandbox, run `npm run populate-simulated-year` (see [Sandbox view §11](sandbox-view#11-populate-scripts)); then re-ask in Chat and paste updated answers here.

---

## Note on these questions

Adam Freed’s questions are captured here so we can:

1. Map each to the **tools and skills** this MCP provides.
2. Show **example answers** from the chat (or Cursor) so stakeholders see what “ask in natural language, get an answer” looks like.
3. Extend the page as new questions come in and new examples are run.

**How to add examples:** Ask the question in [Chat](chat/) (or via Cursor with MCP), copy the assistant’s answer, and add it under **Example answers** below.

---

## Questions from Adam Freed

*(Replace or append with Adam’s actual questions; the following are placeholders aligned to common METRC/compliance use cases.)*

1. **What facilities do we have, and what’s the license number for the one we use for [X]?**
2. **What needs attention right now—compliance, expiring tags, or anything stuck?**
3. **Give me a facility summary: what’s in the vault, what’s in progress, what’s ready to sell?**
4. **What packages do we have for [item or location]? Can you show quantity and age?**
5. **What should we pull for samples this week using oldest inventory first (FIFO)?**
6. **Is there slow-moving or non-moving inventory we should look at?**
7. **If we have an audit in a week, what’s the risk snapshot and what should we clean up?**
8. **Where did this package come from? (traceability / harvest to package)**
9. **Can we adjust [N] packages at once with the same reason and date?**
10. **What harvests are active, and do we have flowering plants ready to harvest?**
11. **What incoming or outgoing transfers do we have?**
12. **What waste methods can we use for harvest or package waste?**

*(Add more questions from Adam here as they’re shared.)*

---

## Quick prompts (copy into Chat)

Use these as-is in the [Chat UI](chat/). Select a facility first (Load facilities, then pick one) so the model has a license to use.

| # | Paste this in Chat |
|---|--------------------|
| 1 | What facilities do we have, and what’s the license number for the one we use for cultivation? |
| 2 | What needs attention right now—compliance, expiring tags, or anything stuck? |
| 3 | Give me a facility summary: what’s in the vault, what’s in progress, what’s ready to sell? |
| 4 | What packages do we have, and can you show quantity and age? |
| 5 | What should we pull for samples this week using oldest inventory first (FIFO)? |
| 6 | Is there slow-moving or non-moving inventory we should look at? |
| 7 | If we have an audit in a week, what’s the risk snapshot and what should we clean up? |
| 8 | Where did this package come from? *(Replace with a real package label when you have one.)* |
| 9 | Can we adjust multiple packages at once with the same reason and date? |
| 10 | What harvests are active, and do we have flowering plants ready to harvest? |
| 11 | What incoming or outgoing transfers do we have? |
| 12 | What waste methods can we use for harvest or package waste? |

---

## How the MCP answers these

| Question (summary) | How the MCP answers it | Tools / skills |
|--------------------|------------------------|----------------|
| Facilities & license numbers | Lists facilities and their licenses so you can pick the one for a given use. | `metrc_get_facilities` |
| What needs attention? | Runs a “needs attention” flow: compliance, expiring tags, stuck harvests/transfers. | Skill: [Needs attention](skills#needs-attention); tools: packages, harvests, transfers, locations. |
| Facility summary | Summarizes counts and state: vault, in progress, ready to sell. | Skill: [Facility summary](skills#facility-summary); `metrc_get_*` for packages, harvests, locations, etc. |
| Packages by item/location, quantity, age | Fetches packages (and harvests if needed), filters by item/location, shows quantity and dates. | `metrc_get_packages`, `metrc_get_harvests`, `metrc_get_items`, `metrc_get_locations` |
| What to pull for samples (FIFO) | Recommends what to pull using oldest-first logic; can warn about partials. | Skill: [FIFO / aging pull](skills#fifo-aging-pull); packages, harvests. |
| Slow / non-moving inventory | Identifies candidates by age/state (no sales data in METRC). | Skill: [Slow-moving inventory](skills#slow-moving-inventory); packages, harvests. |
| Audit risk snapshot & cleanup | Flags risk areas and suggests cleanup; not a full forecasting engine. | Skill: [Audit-ready snapshot](skills#audit-ready-snapshot); packages, harvests, lab. |
| Traceability (package → harvest) | Traces package back to harvest and harvest outputs. | Skill: [Traceability](skills#traceability); packages, harvests. |
| Bulk adjust packages | Adjusts many packages in one call with same reason/date. | `metrc_bulk_adjust_packages` |
| Active harvests & plants ready to harvest | Lists active harvests and flowering plants. | `metrc_get_harvests`, `metrc_get_plants_flowering` |
| Incoming/outgoing transfers | Lists pending transfers for the facility. | `metrc_get_transfers_incoming`, `metrc_get_transfers_outgoing` |
| Waste methods | Lists allowed waste methods for harvest/package waste. | `metrc_get_waste_methods` |

Full tool list: [Tools](tools). Skill details: [Skills](skills).

---

## Example answers (from MCP)

*Answers below were generated by calling the METRC MCP tools (e.g. from Cursor or the Chat UI). Data is for the Colorado sandbox as of the last run.*

### 1. What facilities do we have?

**Q:** What facilities do we have, and what’s the license number for the Colorado sandbox?

**A:** The account has **28 facilities** in the Colorado sandbox. Each has a distinct license number and type. Examples:

| Facility | License | Type |
|----------|---------|------|
| Sandbox Accelerator Cultivation | **SF-SBX-CO-1-8002** | Accelerator Cultivation |
| Sandbox Accelerator Manufacturer | SF-SBX-CO-2-8002 | Accelerator Manufacturer |
| Sandbox Accelerator Store | SF-SBX-CO-3-8002 | Accelerator Store |
| … | … | … |
| (through SF-SBX-CO-28-8002) | RMJ Transporter (No Premises) | |

For cultivation and plant/harvest workflows you’d typically use **SF-SBX-CO-1-8002** (Sandbox Accelerator Cultivation). All facility-scoped MCP tools take `license_number`; use one of these values.

---

### 2. What needs attention?

**Q:** What needs attention right now—compliance, expiring tags, or anything stuck?

**A:** For **SF-SBX-CO-1-8002** (Accelerator Cultivation), the MCP reports:

- **Active packages:** 0 — nothing in inventory to expire or adjust.
- **Active harvests:** 0 — no harvests stuck in progress.
- **Incoming transfers:** 0 — no pending transfers.
- **Locations:** 1 (SBX Centralized Processing Hub Location 1; supports harvests only, not plants/packages).

So for this facility there’s no current inventory or in-progress harvests/transfers to flag. In a live facility, the MCP would use the same tools (packages, harvests, transfers) plus the “Needs attention” skill to call out expiring tags, stuck harvests, or compliance gaps.

---

### 3. Facility summary

**Q:** Give me a facility summary: what’s in the vault, what’s in progress, what’s ready to sell?

**A:** For **SF-SBX-CO-1-8002**:

- **Packages (vault / ready to sell):** 0.
- **Harvests (in progress):** 0.
- **Items (products):** 0.
- **Strains:** 10 (e.g. Blue Dream, Gelato, Girl Scout Cookies, Gorilla Glue, OG Kush, Purple Haze, SBX Strain 1–2, Sour Diesel, Wedding Cake).
- **Locations:** 1 — “SBX Centralized Processing Hub Location 1” (ForHarvests: true; not for plants or packages).
- **Flowering plants:** 0.
- **Plant batches:** 0.

Summary: no packages or harvests in this facility right now; strains and one harvest-capable location are set up. The MCP uses `metrc_get_packages`, `metrc_get_harvests`, `metrc_get_items`, `metrc_get_locations`, `metrc_get_strains`, and `metrc_get_plants_flowering` to build this view.

---

### 4. Packages by item or location

**Q:** What packages do we have, and can you show quantity and age?

**A:** For **SF-SBX-CO-1-8002**, **active packages: 0**. There are no packages to list by quantity or age. When packages exist, the MCP would call `metrc_get_packages` (and optionally harvests for creation date) and can filter by item or location and show quantity and age in a table.

---

### 5. FIFO / what to pull for samples

**Q:** What should we pull for samples this week using oldest inventory first?

**A:** For **SF-SBX-CO-1-8002** there are **0 active packages**, so there’s no inventory to pull for samples. When packages exist, the MCP would use the FIFO/aging-pull skill: call `metrc_get_packages` (and harvests), sort by oldest first, and recommend which packages to use for samples, with warnings about partials or breaking full cases.

---

### 6. Slow-moving inventory

**Q:** Is there slow-moving or non-moving inventory we should look at?

**A:** For **SF-SBX-CO-1-8002**, **0 packages** — no inventory to classify as slow- or non-moving. With data, the MCP would use the slow-moving-inventory skill and package/harvest dates to list candidates (METRC doesn’t have sales velocity; this is age/state-based).

---

### 7. Audit risk snapshot

**Q:** If we have an audit in a week, what’s the risk snapshot and what should we clean up?

**A:** For **SF-SBX-CO-1-8002** right now: no packages, no harvests, no plant batches, one location. So there’s little to audit in inventory. The MCP would normally use the audit-ready-snapshot skill plus packages, harvests, and lab tools to flag old packages, missing lab linkage, fragmentation, and suggest cleanup; with no data, the snapshot is “no current inventory risks.”

---

### 8. Traceability (where did this package come from?)

**Q:** Where did this package come from? (traceability / harvest to package)

**A:** With **0 packages** there’s nothing to trace. When you have a package label or ID, the MCP uses the traceability skill and tools (`metrc_get_package`, `metrc_get_harvest`, harvest packages) to show harvest → package lineage. Ask e.g. “Where did package [label] come from?” once packages exist.

---

### 9. Bulk adjust packages

**Q:** Can we adjust [N] packages at once with the same reason and date?

**A:** Yes. The MCP provides **`metrc_bulk_adjust_packages`**: you pass `license_number`, an `adjustments` array (each with label, quantity, unit_of_measure, adjustment_reason, adjustment_date, optional reason_note), and it performs all adjustments in one API call. No packages exist in this facility to run it against right now.

---

### 10. Active harvests and plants ready to harvest

**Q:** What harvests are active, and do we have flowering plants ready to harvest?

**A:** For **SF-SBX-CO-1-8002**:

- **Active harvests:** 0.
- **Flowering plants:** 0.

So there are no harvests in progress and no plants ready to harvest. When present, the MCP would list them via `metrc_get_harvests` and `metrc_get_plants_flowering`; you’d then use `metrc_harvest_plants` to create a harvest from selected flowering plants.

---

### 11. Incoming and outgoing transfers

**Q:** What incoming or outgoing transfers do we have?

**A:** For **SF-SBX-CO-1-8002**, the MCP reports **0 incoming** and **0 outgoing** transfers. When transfers exist, the MCP uses `metrc_get_transfers_incoming` and `metrc_get_transfers_outgoing` to list them so you can see what’s pending or in transit.

---

### 12. Waste methods

**Q:** What waste methods can we use for harvest or package waste?

**A:** The MCP calls **`metrc_get_waste_methods`** (no license required). The Colorado sandbox returns allowed waste methods—e.g. **“Made it Unusable and Unrecognizable”** (ForPlants: true). Use the returned method **Id** and **Name** when recording harvest waste via `metrc_post_harvest_waste` or package waste tools.

---

*(Re-run these questions in [Chat](chat/) or Cursor to refresh answers as sandbox data changes.)*

---

## How to use this page

- **Stakeholders (e.g. Adam):** Use the **Quick prompts** table to try questions in [Chat](chat/); see **Example answers** for the kind of answer to expect. Check [Sandbox view](/sandbox) for current facility data.
- **Implementers:** Use the “How the MCP answers” table to map questions to tools/skills; add new rows for new questions.
- **Content:** After each chat run, paste the assistant’s answer into the right example block so the page stays a living set of examples.

For more product-framework Q&A (aging, reconciliation, compliance), see [Framework Q&A](framework-qa).
