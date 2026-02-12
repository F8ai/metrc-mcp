---
title: "Master Framework Q&A"
layout: default
---

# Master Framework Q&A

Example questions to ask the LLM for each item in the [Master Function & Feature Framework](framework), and the kind of answer to expect. Use this for demos, testing, or training.

**How to use:** Ask the question in natural language (e.g. in Cursor with the METRC MCP connected). The LLM should route to the right skill and tools and return an answer in the shape described.

---

## 1. BULK & EFFICIENCY TOOLS

### 1.1 True Bulk Inventory Actions

**Q:** *I need to adjust 10 packages at once—same reason and date but different labels and quantities. Can you do that in one go?*

**A:** The LLM should use **`metrc_bulk_adjust_packages`** with `license_number` and an `adjustments` array (each element: label, quantity, unit_of_measure, adjustment_reason, adjustment_date, optional reason_note). Answer should confirm the call was made and summarize: e.g. "Adjusted 10 packages. Labels: [list]. Reason: [X], Date: [Y]." If the user asks for a preview first, the LLM can list the intended changes and ask for confirmation before calling the tool.

---

**Q:** *Finish these 5 packages for me: [list labels]. Use today’s date.*

**A:** Use **`metrc_bulk_finish_packages`** with `license_number`, `actual_date` (today YYYY-MM-DD), and `labels` array. Answer: "Finished 5 packages: [labels]. Actual date: [date]."

---

**Q:** *Move these 3 packages to location ID 123: [label1], [label2], [label3].*

**A:** Use **`metrc_bulk_change_package_location`** with `license_number` and `moves`: [{ label, location_id: 123 }] for each. Answer: "Moved 3 packages to location 123: [labels]."

---

## 2. INVENTORY AGING & LIFECYCLE AWARENESS

### 2.1 Intelligent FIFO / Aging Pull Recommendations

**Q:** *What should I pull for samples this week? I want to use oldest inventory first.*

**A:** Uses skill **FIFO / aging pull** (`metrc://skills/fifo-aging-pull`). Calls `metrc_get_packages`, `metrc_get_harvests`, resolves items/locations. Answer: a short table or list—Package (label), Item, Location, Quantity, Age (date or “oldest”), Recommendation (e.g. "Use for samples"). Warnings if partials exist that should be used before breaking a new case, or if newer product is being pulled while older exists.

---

### 2.2 Aging Inventory Discount / Sampling Recommendations

**Q:** *What’s approaching our age limits? What’s best to discount or use for sampling?*

**A:** Uses skill **Aging discount/sampling** (`metrc://skills/aging-discount-sampling`). Calls `metrc_get_packages`, `metrc_get_harvests`, sorts by oldest date. Answer: table of Package, Item, Location, Quantity, Age, Recommendation ("Discount candidate" / "Sampling candidate"). Should note that brand/legal shelf-life rules are not in METRC—user applies their own thresholds.

---

## 3. INVENTORY INTELLIGENCE

### 3.1 Slow / Non-Moving Inventory Detection

**Q:** *Show me slow-moving or non-moving inventory. What’s not moving?*

**A:** Uses skill **Slow-moving inventory** (`metrc://skills/slow-moving-inventory`). Calls `metrc_get_packages` (and optionally harvests), resolves items/locations. If date fields exist, sort by oldest and list as "likely slow-moving" candidates. Answer: table—Package, Item, Location, Quantity, Age (if available), Note. Caveat: true velocity requires sales data; this is age/current-state based.

---

### 3.2 Future Compliance Risk Forecasting

**Q:** *Give me a compliance risk forecast—what could become a problem with expiration, shelf life, or lab timing?*

**A:** No dedicated skill yet; LLM can use **Audit-ready snapshot** plus packages/harvests/lab tools to flag: packages or harvests with old dates, missing lab linkage, fragmentation. Answer: short list of risk areas (e.g. "Packages over X days old", "Harvests not yet packaged", "Low tag counts") and suggested actions. Full forecasting engine = App.

---

## 4. EMPLOYEE & TRAINING RISK DETECTION

### 4.1 New Employee Pattern Detection

**Q:** *Are there any patterns that suggest training is needed—repeated errors or unusual adjustments?*

**A:** Primarily **App** (attribution and history). If the user only has METRC, the LLM can use `metrc_get_packages`, `metrc_get_harvests`, adjustments history (if exposed) to describe what’s in METRC; answer should state that employee-level pattern detection requires your system’s action history and attribution.

---

### 4.2 Real-Time Mistake Warnings

**Q:** *Before I submit this adjustment, can you check if the unit and package look right?*

**A:** **App** (overlay/co-pilot). LLM can call `metrc_get_package` to validate package exists and show item/unit, and compare to user’s intent. Answer: "Package [label] is Item [X], Unit [Y]. [Matches/doesn’t match] your description. Proceed?" Risk scoring = App.

---

## 5. INTEGRATION & DATA QUALITY

### 5.1 Cross-System Data Reconciliation

**Q:** *Reconcile METRC against our POS—do we have any missing or duplicate packages?*

**A:** **App** (multi-source). LLM can pull METRC snapshot via `metrc_get_packages`, `metrc_get_harvests`, etc., and say: "Here’s the current METRC snapshot [summary]. To reconcile with POS/ERP, you’ll need to compare in your system or a tool that has both data sources." If the other system is queryable by the LLM, a skill could compare and list discrepancies.

---

## 6. CUSTOMER & INVENTORY PRIORITIZATION

### 6.1 Early Warning for Key Customer Fulfillment Risk

**Q:** *Will we have enough inventory for our key customer who usually orders X every Y weeks?*

**A:** Skill could use `metrc_get_packages` (and optionally order history if provided). Answer: "Current inventory for [item/product]: [count/quantity]. [If order history given:] Typical order is X every Y weeks. [Assessment: likely sufficient / may need to prioritize production / suggest prep list]." Predictive logic and CRM = App.

---

## 7. PACKAGE OPTIMIZATION & CLEANUP

### 7.1 Partial Package Fragmentation Detection

**Q:** *Show me fragmentation—are we breaking new cases instead of using existing partials?*

**A:** Uses skill **Fragmentation detection** (`metrc://skills/fragmentation-detection`). Calls `metrc_get_packages`, groups by item (and location). Answer: for items with 2+ packages, list Item, Location, Package count, Labels/quantities, Recommendation ("Use or consolidate before opening new full case"). If no multi-partial groups: "No fragmentation detected; you’re not holding multiple partials for the same item."

---

### 7.2 Package Consolidation Recommendations

**Q:** *Should we consolidate any packages? Where would re-sticker or combining low-counts make sense?*

**A:** Uses skill **Package consolidation** (`metrc://skills/package-consolidation`). Calls `metrc_get_packages`, groups by item/location. Answer: table—Item, Location, Packages (labels + quantities), Total quantity, Recommendation ("Consider combining" / "Re-sticker to simplify"). Explicitly no execution—recommendation only; execution is a separate workflow.

---

### 7.3 Sample-Out Low Counts for Sales Enablement

**Q:** *Which low-count packages should we use as samples or sales incentives?*

**A:** Uses skill **Sample-out low counts** (`metrc://skills/sample-out-low-counts`). Calls `metrc_get_packages`, applies quantity threshold (user or default). Answer: table—Package label, Item, Location, Quantity, Unit, Recommendation ("Suitable for samples" / "Sales incentive candidate"). If none: suggest lowering threshold or recheck later.

---

## 8. PRODUCT & BIOMASS UTILIZATION

### 8.1 Smart Biomass Utilization

**Q:** *We have uneven biomass lots—what’s the best use? Don’t want to burn a big lot on a single test.*

**A:** Skill could use `metrc_get_packages`, `metrc_get_harvests`, `metrc_get_items` to list by quantity and type. Answer: "By quantity: [small lots] → consider extraction batches or tests; [large lots] → pre-rolls or bulk. [Specific suggestions by item/harvest]." Heavy logic = App; LLM gives data-driven suggestions.

---

### 8.2 Historical Yield-Aware Recommendations

**Q:** *This strain used to process really well—are we using it efficiently now?*

**A:** **App** (yield store). LLM can use `metrc_get_strains`, `metrc_get_packages`, harvests to show current use of that strain; answer: "Strain [X] appears in [packages/harvests]. To compare to historical yield, use your yield database." Skill can provide context; yield math = App.

---

## 9. COMPLIANCE CONFIDENCE TOOLS

### 9.1 Audit-Ready Snapshots

**Q:** *We have an audit in a week—check common risk areas and tell me what to clean up.*

**A:** Uses skill **Audit-ready snapshot** (`metrc://skills/audit-ready-snapshot`). Calls harvests, packages, tags (plant + package), transfers (incoming/outgoing), locations, plants. Answer: (1) **Health summary**—one paragraph with counts; (2) **Risk areas**—bullets (unfinished harvests, unfinished packages, low tags, stuck transfers, data gaps); (3) **Recommendations**—3–5 concrete actions (e.g. "Finish harvest H-123", "Order package tags"). Factual, audit-appropriate tone.

---

### 9.2 Employee Self-Audit Mode

**Q:** *I want to review my own recent actions for errors or risk.*

**A:** **App** for attribution. If action history is available to the LLM, answer with a list of recent actions and any flags. Otherwise: "METRC doesn’t attribute actions to employees by default. Use your system’s activity log for self-audit."

---

## 10. TREND ANALYSIS (CROSS-CUTTING)

**Q:** *Anything out of trend or unusual in our current METRC state?*

**A:** **App** for full trend engine. LLM can use current tools (packages, harvests, transfers, tags) to give a spot check: "Current state: [summary]. Without historical trend data, I can’t flag drift. For ongoing trend analysis, use your analytics engine."

---

## 11. TOLLING CALCULATOR

### 11.1 Toll / Split Agreement Financial Engine

**Q:** *What’s our current yield and inventory position for the tolling agreement?*

**A:** Skill uses `metrc_get_harvests`, `metrc_get_packages`, `metrc_get_processing_active` (and lab if needed) to report quantities and stages. Answer: "Harvests: [summary]. Packages: [summary]. Processing: [summary]. [Yield/loss by stage if derivable from data.] For fees, splits, and financials, use your tolling calculator." Costs = App.

---

## 12. AI STRAIN & CROSS INTELLIGENCE

### 12.1 Strain Pairing & Product Fit Recommendations

**Q:** *Recommend strain crosses or product types that fit our current inventory and goals.*

**A:** Skill uses `metrc_get_strains`, `metrc_get_items`, `metrc_get_packages`. Answer: "Current strains: [list]. Inventory: [summary by item/strain]. Recommendations: [suggested crosses, blends, or product types based on what you have]." AI/heuristics = App; LLM gives inventory-aware suggestions.

---

## 13. CUSTOM REPORTS

### 13.1 User-Defined Report Builder

**Q:** *Build me a report: packages by location and item, with quantities. Just this facility.*

**A:** LLM chooses tools (`metrc_get_facilities`, `metrc_get_packages`, `metrc_get_locations`, `metrc_get_items`) and shapes output. Answer: table or structured summary—Location, Item, Package count, Total quantity (or list of labels). "Saved report builder" = App; this is ad-hoc.

---

## 14. YIELD ANALYZER

### 14.1 Stage-by-Stage Yield Analysis

**Q:** *Analyze yield from raw material through production to final product.*

**A:** Skill uses `metrc_get_harvests`, `metrc_get_packages`, `metrc_get_lab_test_batches` / `metrc_get_lab_test_results`, `metrc_get_items` to show stages and quantities. Answer: "Harvests (raw): [summary]. Packages (production/finished): [summary]. Lab: [summary]. [Simple yield % if computable from linked data.] For full yield modeling, use your yield analyzer." Storage = App.

---

## Quick reference: question → skill/tool

| Framework item | Example question | Skill / tool |
|----------------|------------------|--------------|
| §1.1 Bulk | "Adjust these 10 packages in one call" | `metrc_bulk_adjust_packages` |
| §1.1 Bulk | "Finish these 5 packages" | `metrc_bulk_finish_packages` |
| §1.1 Bulk | "Move these 3 packages to location X" | `metrc_bulk_change_package_location` |
| §2.1 FIFO | "What should I pull for samples? Oldest first." | FIFO / aging pull |
| §2.2 Aging | "What’s approaching age limits? Best for discount?" | Aging discount/sampling |
| §3.1 Slow-moving | "Show slow-moving or non-moving inventory" | Slow-moving inventory |
| §3.2 Compliance forecast | "Compliance risk forecast" | Audit snapshot + packages/harvests/lab |
| §7.1 Fragmentation | "Show fragmentation—multiple partials?" | Fragmentation detection |
| §7.2 Consolidation | "Should we consolidate packages?" | Package consolidation |
| §7.3 Sample-out | "Which low-count packages to sample out?" | Sample-out low counts |
| §9.1 Audit | "Audit in a week—check risk areas" | Audit-ready snapshot |
| §11.1 Tolling | "Yield and inventory for tolling" | Harvests + packages + processing |
| §12.1 Strain/product | "Strain or product recommendations from inventory" | Strains + items + packages |
| §13.1 Reports | "Build a report: packages by location and item" | Ad-hoc tools + output shape |
| §14.1 Yield | "Stage-by-stage yield analysis" | Harvests + packages + lab |

---

[← Back to documentation](index.md) | [Framework](framework) | [Skills](skills) | [Tools](tools)
