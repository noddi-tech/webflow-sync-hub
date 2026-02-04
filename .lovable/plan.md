
# Fix: Database Query Timeouts in Production Data

## Problem Summary

After the Geo Sync successfully populated 4,898 areas with geofence data, the Production tab stopped loading. The database queries are timing out because they're fetching the full `geofence_json` JSONB field for thousands of areas.

| Query | Issue |
|-------|-------|
| `useProductionData` | Fetches `geofence_json` via nested join for ALL 4,898 areas just to check if it's not null |
| `useProduction` (Map) | Fetches `geofence_json` for display but still times out with 1000 limit |

Error: `code: 57014` - "canceling statement due to statement timeout"

## Root Cause

The `geofence_json` field contains large polygon data (hundreds of coordinates per area). A single area's geofence can be 50-100KB of JSON. Fetching 4,898 of them in one query exceeds the database's statement timeout.

## Solution

### 1. Optimize `useProductionData` - Don't fetch geofence_json at all

For the Production tab's city/district/area counts, we only need to know IF geofence exists, not the actual data. Change the query to use separate count queries:

**File: `src/hooks/useProductionData.ts`**

```typescript
// Instead of nested join with geofence_json, use separate efficient queries:
const [citiesResult, districtsResult, areasResult, areasWithGeoResult] = await Promise.all([
  supabase.from("cities").select("id, name, country_code, is_delivery").order("name"),
  supabase.from("districts").select("id, city_id"),
  supabase.from("areas").select("id, district_id"),
  supabase.from("areas").select("id", { count: "exact", head: true }).not("geofence_json", "is", null),
]);

// Then aggregate counts in JavaScript
```

This avoids fetching any geofence data - just counts.

### 2. Optimize `useProduction` (Map) - Paginate or use server-side aggregation

For the map, we need actual geofence data but should paginate or limit more strictly:

**File: `src/components/map/StagingAreaMap.tsx`**

Option A: Reduce limit to 200-300 areas (enough for visualization without timeout)
Option B: Add city-based filtering so users load one city at a time

```typescript
// Reduce limit to avoid timeout
.limit(300)

// Or add city filter
.eq("city_id", selectedCityId)
```

### 3. Create a database view for area counts (most robust)

Create a materialized view or simple view that pre-aggregates counts without loading geofence data:

```sql
CREATE VIEW area_geofence_stats AS
SELECT 
  district_id,
  COUNT(*) as total_areas,
  COUNT(*) FILTER (WHERE geofence_json IS NOT NULL) as areas_with_geofence
FROM areas
GROUP BY district_id;
```

Then join this lightweight view instead of loading all area data.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useProductionData.ts` | Replace nested join with separate count queries |
| `src/components/map/StagingAreaMap.tsx` | Reduce limit from 1000 to 300, or add city filter |
| Database migration (optional) | Create aggregation view for performance |

---

## Implementation Details

### `useProductionData.ts` - New Query Structure

```typescript
export function useProductionData() {
  return useQuery({
    queryKey: ["production-data"],
    queryFn: async () => {
      // Fetch cities (small table, fast)
      const { data: cities, error: citiesError } = await supabase
        .from("cities")
        .select("id, name, country_code, is_delivery")
        .order("name");
      if (citiesError) throw citiesError;

      // Fetch districts with city_id (no nested data)
      const { data: districts, error: districtsError } = await supabase
        .from("districts")
        .select("id, city_id");
      if (districtsError) throw districtsError;

      // Fetch areas with district_id and just check if geofence exists
      // Use a boolean expression instead of fetching the actual geofence
      const { data: areas, error: areasError } = await supabase
        .from("areas")
        .select("id, district_id, geofence_json");
      // NOTE: This still has the same issue!
      
      // BETTER: Fetch area counts per district using RPC or aggregation
    },
  });
}
```

### Even Better Approach - Use HEAD requests for counts

```typescript
// Count areas with geofence using HEAD request (no data transfer)
const { count: areasWithGeoCount } = await supabase
  .from("areas")
  .select("id", { count: "exact", head: true })
  .not("geofence_json", "is", null);

// Count all areas per district
const { data: districtCounts } = await supabase
  .rpc("get_district_area_counts"); // Create this function
```

---

## Expected Outcome

After these changes:
1. Production tab loads in under 1 second (no large data transfer)
2. Map loads a reasonable subset of polygons without timeout
3. Geofence coverage percentages are calculated efficiently via COUNT queries
4. No more 500 errors

---

## Technical Notes

- The `geofence_json` field is now populated for all 4,898 areas (confirmed in earlier query)
- PostgREST has a default statement timeout of 8-10 seconds
- Large JSONB fields should be fetched individually, not in bulk queries
- Using `{ count: "exact", head: true }` is the most efficient way to count rows
