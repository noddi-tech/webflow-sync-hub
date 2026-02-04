

# Fix: Production Map Not Showing All Areas

## Root Cause Analysis

I found two issues causing the Production tab to show only a few areas:

### Issue 1: Hardcoded Limit of 300 Rows
The `useProduction` hook in `StagingAreaMap.tsx` has a hardcoded `.limit(300)` (line 213) that restricts the query to only 300 areas, even though there are **4,898 areas** in the production database with geofence data.

### Issue 2: Double Coordinate Swapping
The `extractGeometry` function applies coordinate swapping (`[lat, lng]` → `[lng, lat]`) to all data sources. However:

- **Snapshot/Staging data** from Navio API is stored as `[lat, lng]` → needs swapping ✅
- **Production data** was already corrected to `[lng, lat]` by the database trigger during Geo Sync → should NOT be swapped ❌

The result: Production coordinates get double-swapped back to `[lat, lng]`, placing polygons in the wrong geographic location (they appear off the map or in completely wrong positions).

---

## What is Snapshot vs Production?

| Term | Definition | Table | Current Count |
|------|------------|-------|---------------|
| **Snapshot** | Last known state of Navio API service areas. The "source of truth" from the external Navio system. | `navio_snapshot` | 215 areas |
| **Production** | Your app's live geographic data used for delivery lookups and map display. | `areas` | 4,898 areas |
| **Staging** | Temporary holding area for AI-classified data pending review/approval. | `navio_import_queue` | 0 areas |

---

## Solution

### File: `src/components/map/StagingAreaMap.tsx`

### Change 1: Add Source Parameter to extractGeometry

Make the coordinate swapping conditional based on whether the data is from Navio (snapshot/staging) or production:

```tsx
// Helper to extract geometry from Feature-wrapped or raw GeoJSON
// needsSwap: true for Navio-sourced data (snapshot/staging), false for production
function extractGeometry(geofenceData: unknown, needsSwap: boolean = true): GeoJSON.Geometry | null {
  if (!geofenceData || typeof geofenceData !== 'object') return null;
  
  const geo = geofenceData as { type?: string; geometry?: GeoJSON.Geometry };
  
  // Handle Feature wrapper
  if (geo.type === "Feature" && geo.geometry) {
    return needsSwap ? swapCoordinates(geo.geometry) : geo.geometry;
  }
  
  // Handle direct Geometry
  if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
    return needsSwap ? swapCoordinates(geo as GeoJSON.Geometry) : geo as GeoJSON.Geometry;
  }
  
  return null;
}
```

### Change 2: Update useSnapshot and useStaging to Pass needsSwap = true

```tsx
// In useStaging (line 136):
const geofence = extractGeometry(area.geofence_geojson, true); // Navio data needs swap

// In useSnapshot (line 178):
const geofence = extractGeometry(entry.geofence_json, true); // Navio data needs swap
```

### Change 3: Update useProduction to Pass needsSwap = false

```tsx
// In useProduction (line 224):
const geofence = extractGeometry(entry.geofence_json, false); // Production data already correct
```

### Change 4: Remove the 300-Row Limit and Add Pagination

Replace the limited query with paginated fetching to handle all 4,898 areas:

```tsx
function useProduction() {
  return useQuery({
    queryKey: ["production-geofences"],
    queryFn: async () => {
      // Fetch all production areas with pagination
      const allAreas: any[] = [];
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
          .not("geofence_json", "is", null)
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allAreas.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      const areasWithGeo: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      for (const entry of allAreas) {
        const city = entry.city as { id: string; name: string; country_code: string } | null;
        const cityName = city?.name || "Unknown";
        cityNames.add(cityName);
        
        // Production data is already in correct [lng, lat] format - don't swap
        const geofence = extractGeometry(entry.geofence_json, false);
        if (geofence) {
          areasWithGeo.push({
            id: entry.id,
            name: entry.name,
            city: cityName,
            countryCode: city?.country_code || "XX",
            geofence,
          });
        }
      }
      
      return {
        areas: areasWithGeo,
        cities: Array.from(cityNames),
      };
    },
  });
}
```

---

## Expected Outcome

After these changes:

| Tab | Before | After |
|-----|--------|-------|
| **Snapshot** | 215 areas rendering correctly | No change (still works) |
| **Staging** | 0 areas | No change |
| **Production** | 300 areas (mostly off-map) | **4,898 areas** rendering correctly across all 18 cities |

The Production map will show:
- Göteborg (1,113 areas)
- München (962 areas)
- Oslo (573 areas)
- Stockholm (508 areas)
- Bergen (379 areas)
- And all other cities...

---

## Technical Details

### Why Production Data Doesn't Need Coordinate Swapping

The `sync_geofence_geometry` database trigger processes incoming GeoJSON during Geo Sync and stores it in the correct GeoJSON standard format (`[longitude, latitude]`). The Navio API returns non-standard `[latitude, longitude]`, but this is corrected at import time.

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Update `extractGeometry` signature, fix `useProduction` to not swap and add pagination |

