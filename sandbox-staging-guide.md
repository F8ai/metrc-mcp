# Metrc Sandbox Staging Guide — February 2026

## Access

- **URL**: https://metrc.formul8.ai
- **Login**: Google OAuth (any @staqs.io or @formul8.ai account)
- **Sandbox mode**: After signing in, select a facility, then open Facility Settings (gear icon in the header bar) and set the environment to **Sandbox**

---

## What's Been Seeded

**10 facilities now have full lifecycle data** (up from 3). Seeded on Feb 24, 2026 (run ID: `dmm0amdpr`).

### Colorado — 4 Cultivators

| Facility | License | Type | Strains | Plants | Harvests | Packages | Transfers | Activity |
|----------|---------|------|---------|--------|----------|----------|-----------|----------|
| **CO-21** Retail Cultivation | SF-SBX-CO-21-8002 | Cultivator | 52 | 4 planted, 4 flowered, 4 harvested | yes | 8 | 8 (4 to lab, 4 to dispensary) | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **CO-7** Medical Cultivation | SF-SBX-CO-7-8002 | Cultivator | 24 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 8 | adjustments, moves, waste, 2 pkgs finished |
| **CO-19** OPC | SF-SBX-CO-19-8002 | Cultivator | 14 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 8 | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **CO-20** R&D Cultivation | SF-SBX-CO-20-8002 | Cultivator | 14 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 8 | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| CO-25 Retail Testing Lab | SF-SBX-CO-25-8002 | Lab | — | — | — | 0 (blocked) | — | — |
| CO-24 Retail Store | SF-SBX-CO-24-8002 | Dispensary | — | — | — | 0 (blocked) | — | — |

### Massachusetts — 5 Cultivators + 1 Lab

| Facility | License | Type | Strains | Plants | Harvests | Packages | Transfers | Activity |
|----------|---------|------|---------|--------|----------|----------|-----------|----------|
| **MA-4** Marijuana Cultivator | SF-SBX-MA-4-3301 | Cultivator | 26 | 4 planted, 4 flowered, 4 harvested | yes | 8 | 4 to lab | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **MA-1** Craft Cooperative | SF-SBX-MA-1-3301 | Cultivator | 23 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 4 to lab | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **MA-6** Microbusiness | SF-SBX-MA-6-3301 | Cultivator | 22 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 4 to lab | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **MA-12** Medical Cultivator | SF-SBX-MA-12-3301 | Cultivator | 30 | 4 planted, 3 flowered, 4 harvested | yes | 8 | 4 to lab | adjustments, moves, waste, 2 pkgs finished |
| **MA-15** Microbusiness Delivery | SF-SBX-MA-15-3301 | Cultivator | 22 | 4 planted, 3 flowered, 3 harvested | yes | 8 | 4 to lab | adjustments, moves, waste, 1 harvest finished, 2 pkgs finished |
| **MA-8** Research Lab | SF-SBX-MA-8-3301 | Lab | — | grows own | 1 | 4 | — | 4 lab tests (2 passed, 2 failed), adjustments, moves, waste, 2 pkgs finished |
| MA-9 Retailer | SF-SBX-MA-9-3301 | Dispensary | — | — | — | 0 (blocked) | — | — |

### What each seeded facility has (lifecycle)

Every cultivator above was seeded with:

- **Strains** — 14-52 registered genetics (indica/sativa/hybrid)
- **Plants** — 4 planted, moved through vegetative and flowering phases
- **Harvests** — 3-4 harvested with recorded waste
- **Packages** — 8 created from harvests (flower, trim, etc.)
- **Transfers** — outgoing transfer templates to lab and/or dispensary
- **Activity** — quantity adjustments, location moves, harvest waste records, finished harvests, finished packages

**MA-8 (Research Lab)** is the only facility with **lab test results** — 4 packages tested, 2 passed, 2 failed. This is a Metrc limitation: only facilities with `CanTestPackages=true` can record tests.

---

## Dashboard Navigation — Where to Find Things

After selecting a facility (use the **Facility Switcher** dropdown at the top of the left sidebar), the sidebar shows pages grouped by function. Here's where to go for each data type:

| What to see | Sidebar path | What's there |
|-------------|-------------|-------------|
| **Daily overview** | `/dashboard` (top-level) | KPI cards per facility — package counts, audit score, aging, insights |
| **Active packages** | Inventory | KPI cards (total, fresh/normal/aging/critical), lab test summary, AI insight card, full package table with bulk actions |
| **Aging analysis** | Inventory > Aging | Age distribution, FIFO violations, AI recommendations (discount/sample-out/destroy), slow-moving detection |
| **Plants** | Plants *(cultivators only)* | Individual plant tracking |
| **Plant batches** | Plant Batches *(cultivators only)* | Batch lifecycle management |
| **Harvests** | Harvests *(cultivators only)* | Active/finished harvests, yield analytics, strain performance chart, waste rates |
| **Transfers** | Transfers | Incoming/outgoing/rejected tabs, manifest details, delivery-level package drill-down |
| **Lab tests** | Lab Tests | Pass/fail KPIs, overall pass rate, status tabs (passed/failed/pending), record results |
| **Strains catalog** | Catalog > Strains | All registered strains with genetics breakdown (indica/sativa %), THC/CBD levels |
| **Items catalog** | Catalog > Items | Master product item catalog |
| **Locations** | Catalog > Locations | Registered grow/storage locations |
| **Compliance** | Compliance | Open alerts by severity, "Run Evaluation" button to trigger rules engine, AI insight card |
| **Audit trail** | Compliance > Audit | Audit score timeline, detailed findings, action log history |
| **Package intelligence** | Packages | Fragmentation analysis, consolidation recommendations, sample-out candidates |
| **Biomass** | Packages > Biomass | Biomass classification and recommendations |
| **Analytics** | Analytics | Category breakdown, location distribution, anomaly alerts, lab testing stats |
| **AI Copilot** | Click "Copilot" at sidebar bottom (or go to full-page `/copilot`) | Chat interface with 25+ read tools and 10 write/action tools |

---

## Testing Scenarios

### Scenario 1: Multi-Facility Comparison (5 min)

**Goal**: Demonstrate that multiple facilities now have real data to compare.

1. Go to `/dashboard` — see KPI cards for all facilities
2. Click into **CO-21** (Retail Cultivation) — note package counts, aging
3. Switch to **CO-7** (Medical Cultivation) via the Facility Switcher — observe different strain mix, similar lifecycle data
4. Switch to **MA-4** (Marijuana Cultivator) — cross-state comparison
5. **What to look for**: Each facility should show non-zero package counts, plants, harvests

### Scenario 2: Full Grow Lifecycle Walk-through (10 min)

**Goal**: Follow a plant from seed to package to transfer on a single facility.

1. Select **MA-1** (Craft Cooperative) — a freshly seeded facility
2. **Plant Batches** — see the 4 planted batches
3. **Plants** — see individual plants in vegetative/flowering stages
4. **Harvests** — see completed harvests with waste records and yield analytics
5. **Inventory** — see 8 packages created from those harvests, with ages and locations
6. **Transfers** — see 4 outgoing transfer templates to the lab
7. **What to verify**: The data tells a coherent story — plants became harvests became packages became transfers

### Scenario 3: Inventory Aging & FIFO (10 min)

**Goal**: Test the aging intelligence features with real package data.

1. Select **CO-21** (has the most data — 60+ packages from previous runs + 8 new)
2. Go to **Inventory** — check the aging KPI cards (Fresh/Normal/Aging/Critical buckets)
3. Click into **Inventory > Aging** — three tabs:
   - **FIFO Violations**: Should show pairs where newer packages are being used ahead of older ones
   - **Recommendations**: AI-generated actions (Discount, Sample Out, Destroy)
   - **Slow Moving**: Packages tiered as Slow/Stagnant/Dead
4. Try the **bulk action flow**: Select a few FIFO violations, click "Prioritize Older", see the Preview > Confirm > Execute flow
5. **What to verify**: The aging engine produces meaningful recommendations based on real package ages

### Scenario 4: Lab Testing Pipeline — MA Only (5 min)

**Goal**: Show lab test results (only MA-8 has them).

1. Select **MA-8** (Research Lab) — the only facility with both grow + test capabilities
2. Go to **Lab Tests** — see 4 tests: 2 passed (green), 2 failed (red)
3. Check the **Overall Pass Rate** (should be ~50%)
4. Go to **Inventory** — see the lab test status column on packages
5. **What to verify**: Pass/fail badges render correctly, KPI cards show accurate counts

### Scenario 5: AI Copilot with Real Data (10 min)

**Goal**: Demonstrate the Copilot answering questions against live sandbox data.

1. Select any facility with data (e.g., **CO-21** or **MA-4**)
2. Open **Copilot** (click in sidebar or go to full-page `/copilot`)
3. Try these prompts:
   - *"Give me an inventory overview"* — should return real package counts and categories
   - *"Are there any FIFO violations?"* — should detect actual aging issues
   - *"What strains are we growing?"* — should list the seeded strains
   - *"Show me my active harvests"* — should return harvest data with yields
   - *"Run a compliance audit"* — triggers the rules engine against real packages
4. Try a **write action**: *"Flag the oldest 2 packages for discount"* — should trigger the Preview > Confirm > Execute flow
5. **What to verify**: Copilot returns data-backed responses, tool badges appear during streaming, deep-link buttons appear in responses

### Scenario 6: Compliance Engine (5 min)

**Goal**: Run the compliance rules engine against real inventory.

1. Select **CO-21** (most data)
2. Go to **Compliance**
3. Click **"Run Evaluation"** — this scans all packages against compliance rules
4. Review generated alerts by severity (Critical/Warning/Info)
5. Go to **Compliance > Audit** — see the audit score and timeline
6. **What to verify**: The engine finds real violations (aging, untested packages, etc.)

### Scenario 7: Cross-State Facility Switching (3 min)

**Goal**: Test the multi-state organization experience.

1. Open the **Facility Switcher** — facilities should be grouped by state (CO / MA)
2. Switch between a CO cultivator and an MA cultivator
3. Notice the sidebar adapts to facility type (e.g., Microbusiness facilities show Sales and Dutchie Ops; cultivators show Plants and Harvests)
4. **What to verify**: Switching preserves the current page (if you're on Inventory, it stays on Inventory for the new facility)

---

## Known Sandbox Limitations

These are **Metrc API limitations**, not dashboard bugs:

| Limitation | Impact |
|------------|--------|
| No API to accept/receive incoming transfers | Transfer templates are created but packages stay in "pending receipt" — they never arrive at the destination |
| CO lab (CO-25) has no active packages | Can't grow plants, can't create standalone packages — lab test seeding blocked for CO |
| CO/MA dispensaries have no active packages | No `CanGrowPlants` or `CanCreateOpeningBalancePackages` — sales cannot be seeded |
| MA dispensary transfers skipped | MA-9 lacks the transfer type configurations needed for incoming transfers |
| Lab tests only on MA-8 | Only facility in either state sandbox with both `CanGrowPlants` + `CanTestPackages` |

---

## Best Starting Point

**Start at `/dashboard`** — this gives the bird's-eye view of all facilities with data. From there, click into **CO-21** (richest dataset) to explore Inventory, Aging, Harvests, and Copilot. Then switch to **MA-4** or **MA-1** to see the cross-state/cross-facility experience.

For the most impressive demo path: **Dashboard > CO-21 Inventory > Aging FIFO tab > Copilot "run a compliance audit" > Switch to MA-8 Lab Tests**.
