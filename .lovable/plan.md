

# Fix Deep Verify: Coordinate Swap + Dialog Display

## Root Cause Analysis

### Bug 1: 0/39 verified, 28 mismatched -- all wrong
The Navio API returns polygon coordinates in **[lat, lon] order** instead of the standard GeoJSON [lon, lat]. When these are stored in PostGIS via `ST_GeomFromGeoJSON`, PostGIS interprets the first value as X (longitude) and second as Y (latitude), so the stored geometries have **lat and lon swapped**.

The deep verify geocodes an area name (e.g., "Thorvald Meyers gate, Oslo") and gets correct coordinates (lat=59.918, lon=10.759). It then calls `find_delivery_areas(lat=59.918, lng=10.759)` which creates `ST_MakePoint(10.759, 59.918)` -- correct WGS84. But the stored polygons are in swapped space, so nothing matches.

**Proof**: Querying with swapped coordinates `ST_MakePoint(59.918, 10.759)` returns a match; correct coordinates return zero.

**Fix**: Swap the arguments in the deep verify call to match the stored coordinate order.

### Bug 2: Dialog shows all zeros
The deep verify logs with `operation_type: "coverage_check"` but only stores geocode-specific fields (`checked`, `verified`, `mismatched`, `mismatches`). The dialog's `CoverageCheckDetails` component tries to read `apiZones`, `coveragePercent`, etc. which are all undefined, rendering as "0".

**Fix**: Detect deep verify results and render a dedicated geocode validation view.

---

## Changes

### 1. Edge Function: Swap coordinates (`supabase/functions/navio-import/index.ts`)

In the `coverage_check_deep` mode (~line 2741), change the `find_delivery_areas` call:

```typescript
// Before (broken):
const { data: containsResult } = await supabase.rpc("find_delivery_areas", {
  lat,
  lng: lon,
});

// After (matches swapped polygon storage):
const { data: containsResult } = await supabase.rpc("find_delivery_areas", {
  lat: lon,   // pass real lon as lat param -> becomes Y in ST_MakePoint
  lng: lat,   // pass real lat as lng param -> becomes X in ST_MakePoint
});
```

This makes `ST_MakePoint(real_lat, real_lon)` which matches the swapped coordinate space of the stored polygons.

### 2. Dialog: Handle deep verify results (`src/components/navio/OperationDetailDialog.tsx`)

Detect deep verify operations by checking for `checked` or `mismatches` fields in the details JSON. When found, render a dedicated view:

- Summary: "39 areas geocoded, 28 verified, 3 mismatched, 8 not found"
- Verified count with green indicator
- Mismatched areas listed with their geocoded coordinates and which zone they were expected in
- "Not found" count (Nominatim couldn't geocode the name)

This replaces the generic `CoverageCheckDetails` that currently renders zeros.

### 3. Also fix the regular coverage check dialog

The regular `coverage_check` details (not deep) currently show zeros for `apiZones`, `coveragePercent` etc. because those fields aren't stored in the operation log. Need to ensure the coverage_check mode stores these metrics when logging to `navio_operation_log`.

Check the coverage_check log storage and add the missing fields if needed.

---

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Swap lat/lng in the `find_delivery_areas` call within `coverage_check_deep` |
| `src/components/navio/OperationDetailDialog.tsx` | Add dedicated deep verify results view; fix coverage check details to handle missing fields |

---

## Expected Result After Fix

Deep verify should show realistic results like:
- "39 areas geocoded: 28 verified, 3 mismatched, 8 not found"
- Mismatched areas will be genuinely outside their assigned Navio zone polygon
- Dialog will clearly show geocode validation results instead of zeros
