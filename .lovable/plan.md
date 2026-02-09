

# Fix: Coverage Check Only Processing 1,000 of 4,898 Areas

## Problem

The query on line 2290 of the edge function:
```typescript
const { data: allProductionAreas } = await supabase
  .from("areas")
  .select("id, name, navio_service_area_id, geofence_json, city:cities!areas_city_id_fkey(name)");
```

...hits the default 1,000-row limit. Supabase silently returns only the first 1,000 rows without any error, which is why the card shows "1000/1000 areas" instead of "4898/4898".

The same issue likely affects the `navio_snapshot` query on line 2265.

## Fix

Replace the single query with paginated fetching using `.range()` to retrieve all rows in batches of 1,000.

### File: `supabase/functions/navio-import/index.ts`

**1. Add a paginated fetch helper** (near the top of the file, with other helpers):

```typescript
async function fetchAllRows<T>(
  query: () => any,
  batchSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query()
      .range(offset, offset + batchSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }
  return allData;
}
```

**2. Replace the production areas query** (line ~2290):

Before:
```typescript
const { data: allProductionAreas, error: prodError } = await supabase
  .from("areas")
  .select("id, name, navio_service_area_id, geofence_json, city:cities!areas_city_id_fkey(name)");
```

After:
```typescript
const allProductionAreas = await fetchAllRows(() =>
  supabase
    .from("areas")
    .select("id, name, navio_service_area_id, geofence_json, city:cities!areas_city_id_fkey(name)")
    .order("id")
);
```

**3. Replace the snapshot query** (line ~2265):

Before:
```typescript
const { data: snapshotData } = await supabase
  .from("navio_snapshot")
  .select("navio_service_area_id, name, city_name, is_active")
  .eq("is_active", true);
```

After:
```typescript
const snapshotData = await fetchAllRows(() =>
  supabase
    .from("navio_snapshot")
    .select("navio_service_area_id, name, city_name, is_active")
    .eq("is_active", true)
    .order("id")
);
```

**4. Optimize: exclude large geofence payloads from the hash query**

The `geofence_json` column contains large polygon data. Fetching it for 4,898 rows could be slow or cause memory issues. Split into two queries:

- First query: fetch metadata (id, name, navio_service_area_id) to count linkage -- no geofence needed
- Second query: fetch only areas with geofence_json for the hash calculation, but use a lightweight check (`geofence_json IS NOT NULL`) via a count query instead of fetching the actual JSON

```typescript
// Count areas with geofence (no need to fetch the actual JSON)
const { count: withGeofenceCount } = await supabase
  .from("areas")
  .select("id", { count: "exact", head: true })
  .not("geofence_json", "is", null);

const { count: totalCount } = await supabase
  .from("areas")
  .select("id", { count: "exact", head: true });
```

This avoids fetching 4,898 large polygon objects just to count them.

## Summary of Changes

| What | Change |
|------|--------|
| Add `fetchAllRows` helper | Paginated fetch to bypass 1,000-row limit |
| Production areas query | Use pagination with `.order("id")` |
| Snapshot query | Use pagination with `.order("id")` |
| Geofence counting | Use `count: "exact"` HEAD query instead of fetching all JSON |
| Unique polygon hashing | Fetch geofence_json in batches only for the hash step |

## Expected Result

After fix, the coverage check will show the real numbers:
- "100% geofence coverage (4,898/4,898 areas)" instead of "(1000/1000 areas)"
- Accurate unique polygon count
- Correct Navio linkage numbers (188 real, 4,710 AI-discovered)

