---
title: "Sandbox Limitations & Facility Selection"
layout: default
---

# Sandbox Limitations & Facility Selection

Hard-won knowledge from testing the METRC sandbox APIs across Colorado and Massachusetts. This page documents which facilities to use, what behaviors are expected (confirmed by Metrc support), and what workflows actually work.

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

## 2. API Rules (Confirmed by Metrc Support)

As of 2026-02-20. Confirmed via Metrc support case #02372700.

These behaviors were originally logged as "sandbox bugs" but are **expected API behavior** per Metrc support.

### Opening balance packages require `CanCreateOpeningBalancePackages`

`POST /packages/v2/` (standalone package creation without a source harvest) is only available on facilities where the `FacilityType.CanCreateOpeningBalancePackages` flag is `true`. Colorado sandbox Retail facilities do not have this flag. This is **not** a sandbox bug — it reflects the facility's license permissions.

Workaround: Create packages from harvests using `POST /harvests/v2/{id}/packages`, which works on all cultivator facilities.

**Key flag**: Check `GET /facilities/v2/` response → `FacilityType.CanCreateOpeningBalancePackages`.

### Transfers are template-only via API

The METRC API only supports creating transfer **templates**, not direct transfers.

- `POST /transfers/v2/templates/outgoing` — **correct endpoint** (works)
- `POST /transfers/v2/external/outgoing` — **does not exist** (HTTP 404)
- `POST /transfers/v2/external/incoming` — requires `CanTransferFromExternalFacilities=true` (testing labs only in CO sandbox)

Templates must include `Name`, `TransporterFacilityLicenseNumber`, `Destinations[].Transporters[]` (driver info), and `PlannedRoute`.

**Key flag**: Check `GET /facilities/v2/` response → `FacilityType.CanTransferFromExternalFacilities`.

### Lab test recording restricted to lab licenses

`POST /labtests/v2/record` is only available on facilities where `FacilityType.CanTestPackages=true` (testing labs). Non-lab facilities receive HTTP 401.

Additionally, the package being tested must be physically present at the lab facility (transferred there first). The full workflow requires:

1. Create outgoing transfer template to testing lab
2. Testing lab receives the transfer
3. Testing lab records lab tests using their license

**Key flag**: Check `GET /facilities/v2/` response → `FacilityType.CanTestPackages`.

### Accelerator facilities return 0 item categories (under investigation)

`GET /items/v2/categories` returns 0 results for Accelerator facilities (CO-1, CO-3). Retail facilities (CO-21, CO-24, etc.) return 13-18 categories. Metrc is investigating this issue (case open).

---

## 3. What Works

**Full cultivator lifecycle** on CO-21 and MA-4:
- Create strains, items, locations (with `ForPlants` type)
- Create plantings from seed/clone
- Move through vegetative and flowering growth phases
- Harvest plants
- Create packages from harvests (`POST /harvests/v2/{id}/packages`)

**Transfer templates** on CO-21:
- `POST /transfers/v2/templates/outgoing` creates transfer templates with driver info
- Templates show up in `/transfers/v2/templates/outgoing` endpoint
- Templates support multiple destinations and packages per destination
- Both "Transfer to Testing Facility" and "Unaffiliated" transfer types work

**Lab test recording** on MA-8:
- MA-8 has pre-seeded packages available for testing
- `POST /labtests/v2/record` works on packages present at the lab
- Dynamic lab test type discovery via `GET /labtests/v2/types` with preference for "Raw Plant Material"

**Lab test recording** on CO-25:
- CO-25 (Retail Testing Lab) has `CanTestPackages=true`
- Requires packages to be present at the lab (via transfer)

**Read endpoints** work broadly across most facilities for strains, items, locations, plants, harvests, and packages.

---

## 4. Key Facility Capability Flags

The `GET /facilities/v2/` response includes `FacilityType` with boolean capability flags. Use `npm run seed:probe` to see all flags for all facilities.

| Flag | Meaning | Who has it |
|------|---------|------------|
| `CanGrowPlants` | Can create plant batches and manage cultivation | Cultivators |
| `CanTestPackages` | Can call `POST /labtests/v2/record` | Testing Labs only |
| `CanCreateOpeningBalancePackages` | Can create packages without harvest source | Varies by license |
| `CanTransferFromExternalFacilities` | Can receive external incoming transfers | Testing Labs (CO) |
| `CanSellToConsumers` | Can create sales receipts | Dispensaries/Stores |
| `CanInfuseProducts` | Can create infused/manufactured products | Manufacturers |
| `CanCreateDerivedPackages` | Can create derived packages from existing | Most facility types |

---

## 5. Seed Scripts

| Command | What it does |
|---------|--------------|
| `npm run seed:demo` | Seed demo data for all states (CO + MA). **Recommended entry point.** |
| `npm run seed:co` | Seed demo data for Colorado only |
| `npm run seed:ma` | Seed demo data for Massachusetts only |
| `npm run populate-sandbox` | Legacy script, seeds CO-21 with basic cultivation data |
| `npm run seed:probe` | Probe CO + MA sandbox facilities, output capabilities JSON |

`seed:demo` runs seeders in dependency order: cultivator, lab, dispensary. It writes a manifest to `scripts/seed-manifest.json` on completion.

---

## 6. Facility Map

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
