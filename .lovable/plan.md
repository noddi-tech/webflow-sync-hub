

# Fix: Solid-Fill Duplicate Polygons + Preserve All Areas

## Root Cause (Confirmed via Database Analysis)

The `geo-sync` propagation logic (lines 2061-2090 of `navio-import/index.ts`) copies the first valid geofence to all areas in a city that lack polygon data. This results in:

| City | Total Areas | Unique Polygons | Duplicates (same hash) |
|------|-------------|-----------------|------------------------|
| Oslo | 573 | 27 | 547 (all identical) |
| Stockholm | 508 | 30 | 479 (all identical) |

**What you see**: The 500+ identical polygons stack at the exact same position. With `fillOpacity: 0.2`, stacking 500 layers creates a solid-looking fill.

**What you want**: Keep all 573 Oslo areas in the database, but only show unique polygons on the map.

---

## Solution: Deduplicate at Render Time (No Data Deletion)

We won't remove any areas from the database. Instead, we'll deduplicate polygons before rendering.

### Strategy

1. **Group areas by their polygon hash** (MD5 of `geofence_json::text`)
2. **Render only ONE polygon per unique hash**
3. **Display a popup showing all areas that share that boundary**

### Implementation

**File**: `src/components/map/StagingAreaMap.tsx`

#### Change 1: Add Polygon Deduplication in `useProduction`

```typescript
function useProduction(selectedCityIds: string[]) {
  return useQuery({
    queryKey: ["production-geofences", selectedCityIds],
    enabled: selectedCityIds.length > 0,
    queryFn: async () => {
      const allAreas: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      // Paginate to get all areas
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("areas")
          .select(`
            id, name, geofence_json,
            city:cities!areas_city_id_fkey(id, name, country_code)
          `)
          .in("city_id", selectedCityIds)
          .not("geofence_json", "is", null)
          .order("id")
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
              // Store serialized geofence for deduplication
              _geoHash: JSON.stringify(entry.geofence_json),
            });
          }
        }
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      // DEDUPLICATE: Group by polygon hash, keep first, track all names
      const uniquePolygons = new Map<string, AreaWithGeo & { sharedWith: string[] }>();
      
      for (const area of allAreas) {
        const hash = area._geoHash;
        if (!uniquePolygons.has(hash)) {
          uniquePolygons.set(hash, { 
            ...area, 
            sharedWith: [area.name],
          });
        } else {
          uniquePolygons.get(hash)!.sharedWith.push(area.name);
        }
      }
      
      // Convert back to array
      const dedupedAreas = Array.from(uniquePolygons.values());
      
      return {
        areas: dedupedAreas,
        cities: Array.from(cityNames),
        totalBeforeDedup: allAreas.length,
      };
    },
  });
}
```

#### Change 2: Update Popup to Show All Shared Areas

```tsx
onEachFeature={(feature, layer) => {
  const props = feature.properties || {};
  const shared = props.sharedWith || [];
  
  let popupContent = `<div style="font-weight: 500;">${props.name || "Unknown"}</div>`;
  
  if (shared.length > 1) {
    popupContent += `
      <div style="font-size: 0.75rem; color: #f59e0b; margin-top: 4px;">
        ⚠️ Shared by ${shared.length} areas
      </div>
      <div style="font-size: 0.75rem; color: #6b7280; max-height: 100px; overflow: auto;">
        ${shared.slice(0, 10).join(", ")}${shared.length > 10 ? `, +${shared.length - 10} more` : ""}
      </div>
    `;
  }
  
  popupContent += `<div style="font-size: 0.875rem; color: #6b7280;">${props.city || "Unknown"}</div>`;
  
  layer.bindPopup(popupContent);
}}
```

#### Change 3: Show Deduplication Stats in UI

```tsx
<p className="text-xs text-muted-foreground text-center">
  Showing {areas.length} unique polygon{areas.length !== 1 ? "s" : ""} 
  {totalBeforeDedup > areas.length && (
    <span className="text-amber-500"> (from {totalBeforeDedup} areas)</span>
  )}
</p>
```

---

## Visual Result

| Before | After |
|--------|-------|
| 573 overlapping polygons → solid blue fill | 27 unique polygons with 0.2 opacity |
| Popup: "Aker Brygge (Oslo)" | Popup: "Aker Brygge ⚠️ Shared by 547 areas" |

---

## Technical Notes

### Why This Works
- All areas remain in the database for proper hierarchy and delivery checks
- The map only renders unique boundaries, eliminating visual stacking
- Popups clearly indicate when a polygon is shared by multiple areas
- Performance improves dramatically (27 layers vs 573 layers)

### No Data Deletion
- Areas are NOT removed from `public.areas`
- The deduplication happens purely at render time
- Future geo-sync can still update individual area polygons

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Add deduplication logic, update popup content, show stats |

