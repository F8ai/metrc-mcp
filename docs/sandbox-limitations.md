---
title: "Sandbox Limitations & Facility Selection"
layout: default
---

# Sandbox Limitations & Facility Selection

Hard-won knowledge from testing the METRC sandbox APIs across Colorado and Massachusetts. This page documents which facilities to use, what endpoints are broken, and what workflows actually work.

---

## 1. Facility Selection

The default "Accelerator" facilities (CO-1, CO-3) have crippled capabilities and should not be used for demos or seed data.

| Problem | Facility | Detail |
|---------|----------|--------|
| 0 item categories | CO-1 (Accelerator Cultivation) | `GET /items/v2/categories` returns empty array |
| No `ForPlants` location type | CO-1 | Cannot create planting locations |
| 0 transfer types | CO-3 (Accelerator Store) | `GET /transfers/v2/types` returns empty array |

**Use these facilities instead:**

| Role | Colorado | Massachusetts |
|------|----------|---------------|
| Cultivator | CO-21 (`SF-SBX-CO-21-8002`) Retail Cultivation | MA-4 (`SF-SBX-MA-4-3301`) Cultivator |
| Store / Dispensary | CO-24 (`SF-SBX-CO-24-8002`) Retail Store | MA-9 (`SF-SBX-MA-9-3301`) Retailer |
| Testing Lab | CO-25 (`SF-SBX-CO-25-8002`) Retail Testing Lab | MA-8 (`SF-SBX-MA-8-3301`) Research |
| Manufacturer | CO-22 (`SF-SBX-CO-22-8002`) Retail Manufacturer | -- |

---

## 2. Known Sandbox Bugs

As of 2026-02-20.

### Standalone package creation broken (HTTP 500)

`POST /packages/v2/` returns HTTP 500 "unexpected error" on ALL facilities in both CO and MA. This is a sandbox-side bug, not a payload issue. Only harvest-based package creation works:

```
POST /harvests/v2/{id}/packages   # Works on cultivator facilities
POST /packages/v2/                # Broken everywhere
```

### Transfer endpoints broken

- `POST /transfers/v2/external/outgoing` returns HTTP 404 on cultivator and store facilities.
- `POST /transfers/v2/external/incoming` returns HTTP 401 on all non-lab facilities.
- Lab facilities (CO-11, CO-25) have transfer write permissions but payloads still return HTTP 500.

Net effect: no working transfer path exists in the CO sandbox.

### Lab test recording restricted

- `POST /labtests/v2/record` returns HTTP 401 on non-lab facilities.
- Lab facilities can record tests but only on packages physically present at the lab.
- Combined with broken transfers and broken standalone package creation, there is no working path to get a package to a CO lab facility and then test it.
- MA-8 (Research) works because it has pre-seeded packages.

### Accelerator facilities return 0 item categories

`GET /items/v2/categories` returns 0 results for Accelerator facilities (CO-1, CO-3). Retail facilities (CO-21, CO-24, etc.) return 13-18 categories.

---

## 3. What Works

**Full cultivator lifecycle** on CO-21 and MA-4:
- Create strains, items, locations (with `ForPlants` type)
- Create plantings from seed/clone
- Move through vegetative and flowering growth phases
- Harvest plants
- Create packages from harvests (`POST /harvests/v2/{id}/packages`)

**Lab test recording** on MA-8:
- MA-8 has pre-seeded packages available for testing
- `POST /labtests/v2/record` works on packages present at the lab
- Dynamic lab test type discovery via `GET /labtests/v2/types` with preference for "Raw Plant Material"

**Read endpoints** work broadly across most facilities for strains, items, locations, plants, harvests, and packages.

---

## 4. Seed Scripts

| Command | What it does |
|---------|--------------|
| `npm run seed:demo` | Seed demo data for all states (CO + MA). **Recommended entry point.** |
| `npm run seed:co` | Seed demo data for Colorado only |
| `npm run seed:ma` | Seed demo data for Massachusetts only |
| `npm run populate-sandbox` | Legacy script, seeds CO-21 with basic cultivation data |
| `npm run seed:probe` | Probe CO + MA sandbox facilities, output capabilities JSON |

`seed:demo` runs seeders in dependency order: cultivator, lab, dispensary. It writes a manifest to `scripts/seed-manifest.json` on completion.

---

## 5. Facility Map

Current `FACILITY_MAP` from `scripts/seed-demo.mjs`:

```javascript
const FACILITY_MAP = {
  CO: {
    cultivator:   'SF-SBX-CO-21-8002',  // Retail Cultivation
    lab:          'SF-SBX-CO-25-8002',  // Retail Testing Lab
    manufacturer: 'SF-SBX-CO-22-8002',  // Retail Manufacturer
    dispensary:   'SF-SBX-CO-24-8002',  // Retail Store
  },
  MA: {
    cultivator:   'SF-SBX-MA-4-3301',   // Cultivator
    lab:          'SF-SBX-MA-8-3301',   // Research
    dispensary:   'SF-SBX-MA-9-3301',   // Retailer
  },
};
```

The full sandbox has 28 CO facilities (`SF-SBX-CO-1-8002` through `SF-SBX-CO-28-8002`) and 10+ MA facilities, but most are empty until seeded. The facilities above are the tested and recommended set.
