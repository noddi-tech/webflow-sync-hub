

# Fix: Complete Solution for 1000-Row Limit Issues

## Root Cause Analysis

Both issues stem from Supabase's **default 1000-row limit** on queries.

### Issue 1: Wrong City Counts (Tags show wrong numbers)

| City | Displayed | Actual | Why? |
|------|-----------|--------|------|
| Göteborg | 313 | 1,113 | First 1000 rows only contain 313 Göteborg areas |
| Oslo | 310 | 573 | Same - incomplete sample |
| Stockholm | 78 | 508 | Same - incomplete sample |
| **Tab Total** | **1000** | **4,898** | Sum of incomplete counts |

**Location**: `useCitiesWithCounts()` at line 222-225 fetches `city_id` from all areas but only gets 1000 rows.

### Issue 2: Missing Göteborg Polygons

When you select Göteborg + Oslo + Stockholm, there are **2,194 areas** total. But the `useProduction()` query at line 260 returns only the first 1000 rows (no pagination).

The query returns areas in default database order, which happens to be mostly Oslo and Stockholm rows first - **Göteborg areas come later and get cut off**.

---

## Solution

### Part 1: Fix City Counts with Pagination

Replace the single query with paginated fetching to count ALL 4,898 areas:

```typescript
function useCitiesWithCounts() {
  return useQuery({
    queryKey: ["cities-with-geofence-counts"],
    queryFn: async () => {
      // Fetch all cities first
      const { data: citiesData, error } = await supabase
        .from("cities")
        .select("id, name, country_code")
        .order("name");
      
      if (error) throw error;
      
      // Paginate through ALL areas to get accurate counts
      const countMap = new Map<string, number>();
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: areaPage, error: areaError } = await supabase
          .from("areas")
          .select("city_id")
          .not("geofence_json", "is", null)
          .range(from, from + pageSize - 1);
        
        if (areaError) throw areaError;
        if (!areaPage || areaPage.length === 0) break;
        
        for (const row of areaPage) {
          if (row.city_id) {
            countMap.set(row.city_id, (countMap.get(row.city_id) || 0) + 1);
          }
        }
        
        if (areaPage.length < pageSize) break;
        from += pageSize;
      }
      
      // Build city list with accurate counts
      const citiesWithCounts: CityWithCount[] = (citiesData || [])
        .map(city => ({
          ...city,
          area_count: countMap.get(city.id) || 0
        }))
        .filter(city => city.area_count > 0)
        .sort((a, b) => b.area_count - a.area_count);
      
      return citiesWithCounts;
    },
    staleTime: 60000,
  });
}
```

### Part 2: Fix Production Areas Fetch with Pagination

Add pagination to `useProduction()` to fetch all areas for selected cities:

```typescript
function useProduction(selectedCityIds: string[]) {
  return useQuery({
    queryKey: ["production-geofences", selectedCityIds],
    enabled: selectedCityIds.length > 0,
    queryFn: async () => {
      const allAreas: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      // Paginate to get ALL areas for selected cities
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("areas")
          .select(`
            id, 
            name, 
            geofence_json,
            city:cities!areas_city_id_fkey(id, name, country_code)
          `)
          .in("city_id", selectedCityIds)
          .not("geofence_json", "is", null)
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        for (const entry of data) {
          const city = entry.city as { id: string; name: string; country_code: string } | null;
          const cityName = city?.name || "Unknown";
          cityNames.add(cityName);
          
          const geofence = extractGeometry(entry.geofence_json, true);
          if (geofence) {
            allAreas.push({
              id: entry.id,
              name: entry.name,
              city: cityName,
              countryCode: city?.country_code || "XX",
              geofence,
            });
          }
        }
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      return {
        areas: allAreas,
        cities: Array.from(cityNames),
      };
    },
  });
}
```

---

## File to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Add pagination to `useCitiesWithCounts` and `useProduction` |

---

## Expected Results After Fix

### City Tags (Correct Counts)
| City | Before | After |
|------|--------|-------|
| Göteborg | 313 | **1,113** |
| München | 28 | **962** |
| Oslo | 310 | **573** |
| Stockholm | 78 | **508** |
| Bergen | 58 | **379** |
| ... | | |
| **Tab Total** | 1000 | **4,898** |

### Map Display
- Selecting Göteborg will show all 1,113 polygons (not cut off)
- Selecting all 3 top cities will show all 2,194 polygons
- Performance warning still triggers at 2,000+ areas

---

## Technical Notes

### Why Pagination is Required

Supabase/PostgREST has a **default row limit of 1000**. This is a silent truncation - no error is thrown. The solution uses `.range(from, to)` to fetch data in batches until all rows are retrieved.

### Performance Consideration

The paginated count query will make ~5 round trips (4898 areas / 1000 per page = 5 pages). This adds ~200ms to initial load but ensures accurate data. The result is cached for 1 minute.

