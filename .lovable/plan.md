

# Make Coverage Check Actually Useful

## The Real Problem

The current check says "100% geofence coverage" which is technically true but meaningless:
- All 4,898 areas have a `geofence_json` field -- but only because **geo-sync copies the parent Navio zone polygon** to every child area
- Hoksund has 84 areas that all share the exact same polygon (1 Navio zone)
- There are only **188 unique polygons** across 4,898 areas
- The check doesn't validate whether areas actually fall within correct delivery zones

**What the check SHOULD tell you:**
1. Per-city breakdown: "Oslo: 573 neighborhoods covered by 27 Navio zones"
2. Whether the Navio API has new zones we haven't imported yet
3. Which cities have the fewest zones relative to their area count (potential coverage gaps)
4. Whether any areas lack geofences entirely (currently 0, but good to verify)

---

## Solution: City-Level Coverage Breakdown

Replace the single "100%" metric with a per-city summary that gives real context.

### New Coverage Card Layout

```text
+------------------------------------------+
|  Data Alignment Check          [Healthy]  |
|  Verify production data completeness      |
+------------------------------------------+
|  Navio API: 215 zones (in sync)          |
|                                           |
|  City Coverage (18 cities):               |
|  Oslo       573 areas / 27 zones         |
|  Bergen     379 areas / 10 zones         |
|  Munchen    962 areas / 44 zones         |
|  Goteborg  1113 areas / 19 zones         |
|  Stockholm  508 areas / 30 zones         |
|  ...expand to see all                     |
|                                           |
|  188 unique geofences across 4,898 areas  |
|  All areas inherit parent zone polygons   |
|                                           |
|  [Recheck Coverage]                       |
+------------------------------------------+
```

---

## Technical Changes

### File: `supabase/functions/navio-import/index.ts`

**In the `coverage_check` mode, add city-level breakdown:**

1. Query areas grouped by city with distinct geofence count per city
2. Compare each city's zone count against snapshot zones for that city
3. Add a `cityBreakdown` array to the response:

```typescript
cityBreakdown: [
  { city: "Oslo", areas: 573, uniqueZones: 27, snapshotZones: 27, synced: true },
  { city: "Goteborg", areas: 1113, uniqueZones: 19, snapshotZones: 19, synced: true },
  ...
]
```

4. Also populate `geofence_hash` in snapshot (currently all null) using `md5(geofence_json::text)` so we can cross-reference

5. Health status logic update:
   - "Healthy" = all cities have zones matching snapshot, no stale data
   - "Warning" = snapshot is stale (new zones in API not imported)
   - "Needs Attention" = cities with 0 zones or areas with no geofence

### File: `src/components/navio/CoverageHealthCard.tsx`

**Redesign the display with city breakdown:**

1. Keep the API status row (zones count, stale indicator)
2. Replace the meaningless "100% progress bar" with a collapsible city-level table
3. Each city row shows: name, area count, unique zones, and a visual indicator
4. Bottom summary: "188 unique geofences across 4,898 areas -- all neighborhoods inherit their parent Navio zone polygon"
5. Remove the misleading "All areas have geofence coverage" success message

**Updated interface:**

```typescript
interface CoverageCheckResult {
  apiStatus: { ... };  // keep as-is
  geofenceCoverage: {
    totalAreas: number;
    withGeofence: number;
    missingGeofence: number;
    coveragePercent: number;
    uniquePolygons: number;
  };
  navioLinkage: { ... };  // keep as-is
  cityBreakdown: Array<{
    city: string;
    areas: number;
    uniqueZones: number;
    snapshotZones: number;
    synced: boolean;
  }>;
  healthStatus: "healthy" | "warning" | "needs_attention";
  areasNeedingAttention: Array<{ ... }>;
}
```

### File: `src/components/navio/OperationHistoryTable.tsx`

Update the coverage check log message to show city count:
- "18 cities verified -- 188 unique zones across 4,898 areas"

---

## Database: Populate Snapshot Geofence Hashes

Currently `geofence_hash` is null for all 215 snapshot records. Add a one-time update and ensure future snapshots populate this field.

**Migration:**
```sql
UPDATE navio_snapshot 
SET geofence_hash = md5(geofence_json::text) 
WHERE geofence_json IS NOT NULL AND geofence_hash IS NULL;
```

This enables cross-referencing production geofences against snapshot zones to verify they match.

---

## Summary

| File | Change |
|------|--------|
| Migration | Populate `geofence_hash` in `navio_snapshot` |
| `supabase/functions/navio-import/index.ts` | Add city-level breakdown query, update response structure |
| `src/components/navio/CoverageHealthCard.tsx` | Show per-city table instead of meaningless 100% bar |
| `src/components/navio/OperationHistoryTable.tsx` | Update log message format |

