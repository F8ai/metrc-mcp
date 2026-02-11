---
title: "Master Function & Feature Framework"
layout: default
---

# Master Function & Feature Framework

This document maps the product/feature framework to **METRC MCP** capabilities. Use it to decide what to build in this repo (tools + skills) vs in your app (UI, rules engine, external data).

**Legend:** **MCP** = implement with current or new tools/resources. **Skill** = analysis pattern (LLM + tools). **App** = needs UI, rules engine, or external data.

**See also:** [Tools](tools) | [Skills](skills) | [Getting started](getting-started)

---

## 1. BULK & EFFICIENCY TOOLS

### 1.1 True Bulk Inventory Actions
- **Description:** Bulk adjustments, status changes, package actions (not 1-by-1). Preview before execution.
- **METRC feasibility:** HIGH (array payloads).
- **Implementation:** **MCP** — Add tools like `metrc_adjust_package` (already have), extend to accept **arrays** of adjustments; add `metrc_bulk_finish_packages`, `metrc_bulk_change_location`. Optional tool: `metrc_preview_bulk_adjustments` (dry-run / validation).
- **Skill:** "Bulk actions" skill: list packages to change → build payload → show preview (tool returns summary) → user confirms → execute.

---

## 2. INVENTORY AGING & LIFECYCLE AWARENESS

### 2.1 Intelligent FIFO / Aging Pull Recommendations
- **Description:** Recommend what to pull for samples, vendor days, sales kits, discounting. Use harvest/production/package age. Warn before breaking full case when partial exists, or pulling too fresh when older exists.
- **METRC feasibility:** HIGH (dates + quantities in packages/items).
- **Implementation:** **Skill + MCP.** Skill: "What should I pull for [samples|vendor days|discounting]?" — call `metrc_get_packages`, `metrc_get_harvests`; sort/filter by date and quantity; apply FIFO logic in prompt or a small helper. **App** for brand-specific prioritization rules.
- **MCP:** Implemented as skill **FIFO / aging pull** — see [Skills](skills). URI: `metrc://skills/fifo-aging-pull`.

### 2.2 Aging Inventory Discount / Sampling Recommendations
- **Description:** Proactively identify inventory near brand/legal/shelf-life limits; best candidates for discount or sampling.
- **METRC feasibility:** HIGH for detection; shelf-life interpretation = **App** logic.
- **Implementation:** **Skill** for "What's approaching age limits?" using package/harvest dates; **App** for configurable thresholds and rules engine.

---

## 3. INVENTORY INTELLIGENCE

### 3.1 Slow / Non-Moving Inventory Detection
- **Description:** Identify products/packages not moving; cash tie-up; operational risk.
- **METRC feasibility:** HIGH (sales + package endpoints).
- **Implementation:** **Skill + MCP.** Skill: "Show slow-moving or non-moving inventory" — `metrc_get_packages`, optional sales data if available; LLM or post-process for velocity. **App** for trend/velocity store.

### 3.2 Future Compliance Risk Forecasting
- **Description:** Forecast expiration, shelf-life, structural (fragmentation, lab timing) risk.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** for "Compliance risk forecast" using packages/harvests/lab; **App** for rules + forecasting engine.

---

## 4. EMPLOYEE & TRAINING RISK DETECTION

### 4.1 New Employee Pattern Detection
- **Description:** Detect new-hire mistake patterns, repeated adjustment errors, unusual vs team norms. Training needs; prevent compliance drift.
- **METRC feasibility:** MEDIUM–HIGH (sales have attribution; inventory actions limited unless proxied).
- **Implementation:** **App** — attribution and history; MCP can feed `metrc_get_*` for context. **Skill** possible for "Review recent adjustments" if we have adjustment history.

### 4.2 Real-Time Mistake Warnings
- **Description:** Warn before wrong unit, wrong package, out-of-trend adjustments.
- **METRC feasibility:** MEDIUM (strongest when actions originate in your system).
- **Implementation:** **App** (overlay/co-pilot UI + risk scoring). MCP tools can be called to validate before commit.

---

## 5. INTEGRATION & DATA QUALITY

### 5.1 Cross-System Data Reconciliation
- **Description:** METRC ↔ Dutchie, Flowhub, LeafLink, Stashstock, ERPs — missing data, duplicates, out-of-trend, sync issues.
- **METRC feasibility:** HIGH on METRC side; full power with partner APIs.
- **Implementation:** **App** (multi-source reconciliation). MCP supplies METRC snapshot; **Skill** "Reconcile METRC vs [system]" if other system is queryable by LLM.

---

## 6. CUSTOMER & INVENTORY PRIORITIZATION

### 6.1 Early Warning for Key Customer Fulfillment Risk
- **Description:** Customer orders X every Y weeks; inventory may not cover next order; alert to prioritize production/prep.
- **METRC feasibility:** HIGH (historical sales + inventory).
- **Implementation:** **Skill** for "Will we have enough for key customers?" using packages + (if provided) order history. **App** for predictive logic and CRM data.

---

## 7. PACKAGE OPTIMIZATION & CLEANUP

### 7.1 Partial Package Fragmentation Detection
- **Description:** Detect when employees break new cases and ignore existing partials.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** — "Show fragmentation" — `metrc_get_packages`, group by item/location, flag multiple partials where one could be used.

### 7.2 Package Consolidation Recommendations
- **Description:** Recommend re-sticker, combine low-counts, simplify selling units.
- **METRC feasibility:** MEDIUM–HIGH (recommendation easy; execution state-dependent).
- **Implementation:** **Skill** for recommendations; **App** for execution workflow.

### 7.3 Sample-Out Low Counts for Sales Enablement
- **Description:** Identify low counts better used as samples/sales incentives.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** — "Which low-count packages should we sample out?" using packages + quantity thresholds.

---

## 8. PRODUCT & BIOMASS UTILIZATION

### 8.1 Smart Biomass Utilization
- **Description:** Recommend best use of uneven biomass (don't burn 6 lbs on fresh test; route small lots to extraction; large for pre-rolls).
- **METRC feasibility:** HIGH (quantities + lineage).
- **Implementation:** **Skill** using packages/harvests/items; **App** for strong proprietary logic.

### 8.2 Historical Yield-Aware Recommendations
- **Description:** Strain historically processed well but now used inefficiently; recommend better use cases.
- **METRC feasibility:** MEDIUM–HIGH (Metrc quantities; yield math = yours).
- **Implementation:** **App** (yield store); **Skill** can use strain + package data for context.

---

## 9. COMPLIANCE CONFIDENCE TOOLS

### 9.1 Audit-Ready Snapshots
- **Description:** "Audit in a week — check common risk areas." Health snapshot, trend flags, areas to review.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** — "Audit readiness check" — call harvests, packages, transfers, tags, inactive lists; summarize risks and cleanup items. **App** for trend + rules engine.
- **MCP:** Implemented as skill **Audit-ready snapshot** — see [Skills](skills). URI: `metrc://skills/audit-ready-snapshot`.

### 9.2 Employee Self-Audit Mode
- **Description:** Employees check own work for errors, patterns, risk.
- **METRC feasibility:** MEDIUM–HIGH (attribution limitations).
- **Implementation:** **Skill** for "Review my recent actions" if we have action history; **App** for attribution.

---

## 10. TREND ANALYSIS (CROSS-CUTTING)
- **Description:** Out-of-trend behavior, historical anomalies, silent drift.
- **METRC feasibility:** HIGH.
- **Implementation:** **App** (core engine). MCP/skills feed data; **Skill** "Anything out of trend?" can run spot checks from current state.

---

## 11. TOLLING CALCULATOR

### 11.1 Toll / Split Agreement Financial Engine
- **Description:** Fees, splits, costs; yields biomass → finished; yield/loss by stage, inventory, financials.
- **METRC feasibility:** HIGH for quantities; costs in your system.
- **Implementation:** **Skill** for yield and inventory from METRC; **App** for costs and financial engine.

---

## 12. AI STRAIN & CROSS INTELLIGENCE

### 12.1 Strain Pairing & Product Fit Recommendations
- **Description:** Recommend crosses, blends, product types from inventory, history, goals.
- **METRC feasibility:** MEDIUM–HIGH (inventory context; creativity = yours).
- **Implementation:** **Skill** "Strain/product recommendations" using `metrc_get_strains`, `metrc_get_items`, `metrc_get_packages`; **App** for AI/heuristics IP.

---

## 13. CUSTOM REPORTS

### 13.1 User-Defined Report Builder
- **Description:** Build, save, reuse reports from METRC endpoints and derived fields.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** — "Build a report: [dimensions]" — LLM chooses tools and shapes output. **App** for GUI report builder and saved definitions.

---

## 14. YIELD ANALYZER

### 14.1 Stage-by-Stage Yield Analysis
- **Description:** Yield at raw material, production, test, final product.
- **METRC feasibility:** HIGH.
- **Implementation:** **Skill** for "Yield analysis" using harvests, packages, lab tests, items; **App** for yield modeling and storage.

---

## Summary: MCP/Skill vs App

| Build in MCP/Skills (this repo) | Build in App (UI, rules, external data) |
|---------------------------------|------------------------------------------|
| Bulk actions (array tools + preview skill) | Brand/shelf-life rules, trend engine |
| FIFO / aging pull recommendations (skill) | Real-time mistake overlay, attribution |
| Slow-moving detection (skill) | Cross-system reconciliation, velocity store |
| Fragmentation + consolidation + sample-out (skills) | Employee pattern detection, risk scoring |
| Audit-ready snapshot (skill) | Custom report builder GUI, saved reports |
| Yield / tolling from METRC data (skills) | Cost/financial engine, historical yield DB |
| Strain/product fit from inventory (skill) | Predictive customer fulfillment, AI strain IP |

Use this doc as a roadmap: implement **skills** and **array-capable tools** first for high-feasibility items; reserve **App** for proprietary logic, GUI, and multi-source data.

---

[← Back to documentation](index.md) | [Tools](tools) | [Skills](skills)
