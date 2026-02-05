

# Data Alignment Check: Production vs Navio API

## Overview

Create a new feature to validate that your production delivery data accurately reflects what the Navio API reports. This will help identify:

1. **Coverage gaps** - Areas in Navio not covered in production
2. **Over-coverage** - Production polygons covering areas Navio doesn't serve
3. **Polygon mismatches** - Same area with different boundaries

---

## Current Data Structure

| Source | Records | Description |
|--------|---------|-------------|
| **navio_snapshot** | 215 | Official Navio service areas with real polygons |
| **areas (production)** | 4,898 | AI-discovered neighborhoods + 188 matched Navio areas |
| **Navio API (live)** | ~215 | Real-time service area data |

The key insight is that **Navio defines ~215 delivery zones**, but your production database has **4,898 granular neighborhoods** that should be contained within those zones.

---

## Solution: Two-Level Alignment Check

### Level 1: Snapshot vs Live API (Quick Check)
Compare the stored snapshot with the live Navio API to ensure your reference data is current.

### Level 2: Production Coverage vs Snapshot (Spatial Check)
Verify that production area polygons properly align with the authoritative Navio polygons.

---

## Implementation Plan

### Step 1: Add New "coverage_check" Mode to Edge Function

Add a new mode to `navio-import` that:
1. Fetches live Navio API data (215 service areas)
2. Fetches production areas with geofences
3. Performs spatial analysis:
   - For each Navio polygon, check if production has coverage
   - Identify Navio areas with no matching production polygon
   - Identify production polygons outside any Navio zone

```text
File: supabase/functions/navio-import/index.ts

New mode: "coverage_check"

Logic:
1. Fetch Navio API service areas (with geofence_geojson)
2. Fetch snapshot for comparison
3. Fetch production areas with geofence (deduplicated by polygon hash)
4. Compare:
   a. Snapshot freshness: Is snapshot up-to-date with API?
   b. Coverage alignment: Do production polygons match Navio boundaries?
   c. Orphaned production: Areas with polygons not in any Navio zone?
```

### Step 2: Create Coverage Check Results Interface

```typescript
interface CoverageCheckResult {
  // Snapshot vs API freshness
  snapshotFreshness: {
    isUpToDate: boolean;
    apiCount: number;
    snapshotCount: number;
    missingFromSnapshot: number;
    removedFromApi: number;
  };
  
  // Production vs Navio alignment
  coverageAlignment: {
    navioAreasTotal: number;
    navioAreasCovered: number;        // Have matching production polygons
    navioAreasUncovered: number;      // No production coverage
    productionAreasTotal: number;
    productionAreasAligned: number;   // Inside Navio zones
    productionAreasOrphaned: number;  // Outside all Navio zones
  };
  
  // Detailed lists for review
  uncoveredNavioAreas: Array<{ id: number; name: string; city: string }>;
  orphanedProductionAreas: Array<{ id: string; name: string; city: string }>;
}
```

### Step 3: Add UI Component for Coverage Check

Create a new card on the Navio Dashboard showing coverage health:

```text
File: src/components/navio/CoverageHealthCard.tsx

Display:
- Snapshot freshness indicator (green/amber/red)
- Coverage percentage (e.g., "98% of Navio zones covered")
- List of uncovered Navio areas
- List of orphaned production areas
- "Check Now" button to run coverage check
```

### Step 4: Add to Dashboard

Add the coverage check to the Overview tab:

```text
File: src/pages/NavioDashboard.tsx

Add new action card:
- "Coverage Check" - Verify production aligns with Navio API
- Shows coverage health status
- Links to detailed results
```

---

## Spatial Analysis Logic

The core comparison uses PostGIS spatial functions:

### Check if Production Covers Navio Zones

```sql
-- For each Navio snapshot polygon, check if any production area intersects
SELECT 
  s.navio_service_area_id,
  s.name,
  s.city_name,
  EXISTS (
    SELECT 1 FROM areas a
    WHERE ST_Intersects(
      ST_GeomFromGeoJSON(s.geofence_json::text),
      a.geofence
    )
  ) as has_production_coverage
FROM navio_snapshot s
WHERE s.geofence_json IS NOT NULL
```

### Check for Orphaned Production Areas

```sql
-- Production areas not intersecting any Navio snapshot polygon
SELECT a.id, a.name, c.name as city
FROM areas a
JOIN cities c ON a.city_id = c.id
WHERE a.geofence IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM navio_snapshot s
  WHERE s.geofence_json IS NOT NULL
  AND ST_Intersects(
    a.geofence,
    ST_GeomFromGeoJSON(s.geofence_json::text)
  )
)
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Add `coverage_check` mode with spatial analysis |
| `src/components/navio/CoverageHealthCard.tsx` | New component showing coverage status |
| `src/hooks/useNavioImport.ts` | Add `checkCoverage` mutation |
| `src/pages/NavioDashboard.tsx` | Add coverage check card to Overview tab |

---

## User Flow

1. User clicks "Check Coverage" on Navio Dashboard
2. Edge function fetches Navio API and compares with production
3. Results show:
   - "215/215 Navio zones have production coverage"
   - "4,523/4,898 production areas are within Navio zones"
   - List of any gaps or orphaned areas
4. User can then run Geo Sync to fix any misalignments

---

## Technical Notes

### Why Spatial Comparison?

Simply counting records doesn't verify coverage because:
- 215 Navio zones expand into 4,898 neighborhoods
- The same Navio polygon may be shared by many production areas (as we saw with the duplicates)
- What matters is whether the **boundaries align**, not the counts

### Performance Considerations

- Spatial queries can be slow with many polygons
- We'll use `ST_Intersects` which is optimized with spatial indexes
- The `geofence` column in `areas` already has a spatial index

### Edge Cases

- Navio zones without polygons (null geofence) are skipped
- Production areas without polygons are not checked
- Very small overlaps (< 1%) could be flagged as potential issues

