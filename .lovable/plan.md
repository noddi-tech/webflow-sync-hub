

# Fix: Finalization Timeout Due to Sequential Database Writes

## Root Cause Analysis

The import found 18 cities but only 6 made it to staging because the **finalization timed out**. Here's what happened:

| Time | Event |
|------|-------|
| 11:44:52 | Finalization started |
| 11:44:53 | Drammen saved to staging |
| 11:45:33 | Tønsberg saved (40 second gap!) |
| 11:45:49 | Stockholm saved |
| ~11:45:52 | **Function killed by 60s timeout** |

**The Problem**: The `saveToStaging` function performs **individual sequential inserts** for every city, district, and area. With 5000+ areas to save, this takes far too long:

```typescript
// Current code - SLOW (5000+ sequential operations)
for (const area of districtData.areas) {
  await supabase.from("navio_staging_areas").insert({...});  // 1 call per area
}
```

With ~5400 areas total, that's ~5400 individual database calls, each taking ~5-10ms. That alone is 27-54 seconds, leaving no room for cities and districts.

---

## Solution: Batch Inserts

Replace sequential inserts with **batch inserts** that handle hundreds of records in a single database call.

### Technical Changes

**File: `supabase/functions/navio-import/index.ts`**

1. **Batch area inserts** - Insert up to 500 areas at once instead of one at a time:

```typescript
// NEW: Batch insert areas (500 at a time)
const BATCH_SIZE = 500;
const allAreas = [...];  // Collect all areas first

for (let i = 0; i < allAreas.length; i += BATCH_SIZE) {
  const batch = allAreas.slice(i, i + BATCH_SIZE);
  await supabase.from("navio_staging_areas").insert(batch);
}
```

2. **Batch district inserts** - Insert all districts for a city in one call:

```typescript
// NEW: Insert all districts at once, then bulk-insert their areas
const allDistricts = [...cityData.districts.values()];
const { data: insertedDistricts } = await supabase
  .from("navio_staging_districts")
  .insert(allDistricts.map(...))
  .select("id, name");
```

3. **Alternative: Incremental finalization** - If batching is still too slow, add a `finalize_city` mode that saves one city at a time (following the same pattern as `process_city`):

```typescript
case "finalize_city": {
  // Save one city to staging per call
  // Return needsMoreFinalization: true until all cities are saved
}
```

---

## Implementation Details

### Option A: Bulk Insert (Recommended - Simpler)

Transform the nested loops into a two-phase approach:

**Phase 1: Build all records in memory**
```typescript
const cityRecords: CityRecord[] = [];
const districtRecords: DistrictRecord[] = [];  
const areaRecords: AreaRecord[] = [];

for (const [, cityData] of cityMap) {
  const tempCityId = crypto.randomUUID();  // Temporary ID for linking
  cityRecords.push({ temp_id: tempCityId, ... });
  
  for (const [, districtData] of cityData.districts) {
    const tempDistrictId = crypto.randomUUID();
    districtRecords.push({ temp_city_id: tempCityId, temp_id: tempDistrictId, ... });
    
    for (const area of districtData.areas) {
      areaRecords.push({ temp_district_id: tempDistrictId, ... });
    }
  }
}
```

**Phase 2: Bulk insert with ID mapping**
```typescript
// Insert all cities in one call
const { data: cities } = await supabase
  .from("navio_staging_cities")
  .insert(cityRecords.map(r => ({ ...r, temp_id: undefined })))
  .select("id, name");

// Create temp_id -> real_id map
const cityIdMap = new Map(cities.map((c, i) => [cityRecords[i].temp_id, c.id]));

// Insert all districts with real city IDs
const { data: districts } = await supabase
  .from("navio_staging_districts")
  .insert(districtRecords.map(r => ({
    ...r,
    staging_city_id: cityIdMap.get(r.temp_city_id),
    temp_city_id: undefined,
    temp_id: undefined
  })))
  .select("id, name");

// Insert all areas with real district IDs (in batches of 500)
const districtIdMap = new Map(districts.map((d, i) => [districtRecords[i].temp_id, d.id]));
for (let i = 0; i < areaRecords.length; i += 500) {
  await supabase.from("navio_staging_areas").insert(
    areaRecords.slice(i, i + 500).map(r => ({
      ...r,
      staging_district_id: districtIdMap.get(r.temp_district_id),
      temp_district_id: undefined
    }))
  );
}
```

### Option B: Incremental Finalization (Backup if A still times out)

Add a new mode that finalizes one city per call:

```typescript
case "finalize_city": {
  const { data: nextCity } = await supabase
    .from("navio_import_queue")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "completed")
    .not("finalized_at", "is.not", null)  // Not yet finalized
    .limit(1)
    .single();
  
  if (!nextCity) {
    return { completed: true };
  }
  
  await saveOneCityToStaging(supabase, batchId, nextCity);
  
  // Mark as finalized
  await supabase.from("navio_import_queue")
    .update({ finalized_at: new Date().toISOString() })
    .eq("id", nextCity.id);
  
  return { 
    needsMoreFinalization: true,
    finalized: nextCity.city_name,
    progress: { ... }
  };
}
```

---

## Performance Comparison

| Approach | DB Calls | Estimated Time |
|----------|----------|----------------|
| **Current (sequential)** | ~5500 | 50-60s (timeout) |
| **Option A (bulk)** | ~15-20 | 3-5s |
| **Option B (incremental)** | ~300/city | ~1s/city (18 calls total) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Replace `saveToStaging()` sequential inserts with bulk insert pattern |

---

## Expected Result

After this fix:
- Finalization completes in 5-10 seconds instead of timing out
- All 18 cities are saved to staging
- Preview shows complete data (18 cities, 42 districts, 5000+ areas)

