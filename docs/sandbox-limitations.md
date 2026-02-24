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

As of 2026-02-23. Confirmed via Metrc support case #02372700 and extensive API probing (Feb 2026).

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

### No API to receive/accept incoming transfers

External incoming transfers (`POST /transfers/v2/external/incoming`) successfully create transfer manifests at receiving facilities, but there is **no API endpoint** to accept or receive them. Packages remain in "pending receipt" state indefinitely.

Probed endpoints (all returned HTTP 404, Feb 2026):
- `POST /transfers/v2/incoming/receive`
- `PUT /transfers/v2/incoming/receive`
- `POST /transfers/v2/receive`
- `PUT /transfers/v2/receive`
- `POST /transfers/v2/{transferId}/receive`
- `POST /transfers/v2/deliveries/receive`
- `PUT /transfers/v2/deliveries/{deliveryId}/receive`
- `POST /transfers/v2/deliveries/{deliveryId}/packages/receive`

**Impact**: Lab facilities (CO-25) cannot get packages into active inventory via API. Only MA-8 (Research, `CanGrowPlants` + `CanTestPackages`) can create AND test packages using the mini-cultivator pipeline.

### Massachusetts "NotSubmitted" package state

Packages created at MA facilities start in a "NotSubmitted" state. Transferring these packages returns: `"Package is marked as NotSubmitted and cannot be transferred."`

The `GET /packages/v2/active` response does not reliably expose this flag. No API endpoint exists to submit or approve packages programmatically. **Status**: awaiting Metrc support response (case #02372700).

### External incoming transfer payload format

The correct payload for `POST /transfers/v2/external/incoming` uses the `Destinations[]` wrapper format. Discovered through iterative probing (Feb 2026).

Key required fields:
- `ShipperFacilityLicenseNumber`, `ShipperFacilityName`, `ShipperName`
- `ShipperAddress1`, `ShipperAddressCity`, `ShipperAddressState`, `ShipperAddressPostalCode`
- `Destinations[].RecipientLicenseNumber`, `TransferTypeName`, `PlannedRoute`
- `Destinations[].Transporters[]` with driver details (`TransporterFacilityLicenseNumber`, `DriverName`, `DriverLicenseNumber`, `VehicleMake`, `VehicleModel`, `VehicleLicensePlateNumber`)
- `Destinations[].Packages[].PackagedDate` — **required but not documented** in official API docs
- `TransferTypeName` must have `ForExternalIncomingShipments=true` (e.g., "Industrial Hemp Product" in CO)

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

**Lab test recording** on MA-8 (fully working -- ONLY working lab test path):
- MA-8 (Research Facility) has both `CanGrowPlants` and `CanTestPackages`
- Package seeder runs the mini-cultivator pipeline locally: strains -> locations -> plants -> harvest -> packages
- Lab seeder records 4 test profiles on the locally-created packages
- Dynamic lab test type discovery via `GET /labtests/v2/types` with preference for "Raw Plant Material"
- This is the **only fully working lab test path** across both CO and MA states

**Lab test recording** on CO-25 (BLOCKED):
- CO-25 (Retail Testing Lab) has `CanTestPackages=true` but NOT `CanGrowPlants`
- External incoming transfers create manifests but packages stay in "pending receipt" (no receive API exists)
- No standalone package creation (`CanCreateOpeningBalancePackages=false`)
- Cannot grow plants locally (`CanGrowPlants=false`)
- Result: no active packages can be created at CO-25, so lab tests cannot be recorded

**Dispensary sales** (BLOCKED for both CO and MA):
- No dispensary facility (CO-24, MA-9) has `CanGrowPlants` or `CanCreateOpeningBalancePackages`
- No way to get packages into dispensary inventory via API
- External incoming transfers create manifests but packages stay in "pending receipt" (no receive API)
- Dispensary sales seeder runs but finds zero active packages to sell

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

`seed:demo` runs seeders in dependency order: cultivator -> seed lab packages -> lab tests -> transfer templates (to lab + dispensary) -> seed dispensary packages -> dispensary sales. It writes run metadata to `scripts/.last-seed.json` on completion.

For the full seeding pipeline architecture, strategy decision trees, per-state results matrix, and payload formats, see [Sandbox Seeding Pipeline](./sandbox-seeding).

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
