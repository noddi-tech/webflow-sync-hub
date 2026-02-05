

# Complete Fix: Solid Fill Bug, Performance Optimization & Production Map Purpose

## Issue Summary

### Issue 1: Solid Fill Polygon (Always Same Areas)
The screenshot shows one polygon in Oslo and one in Göteborg always rendering with 100% solid fill instead of 20% transparency. This happens because:

1. **React-Leaflet GeoJSON has immutable props** - the `style` prop is only applied on first mount
2. The current `key` is on the wrapper `div`, but the `MapContainer` itself doesn't remount
3. When React reuses GeoJSON components, old Leaflet layers persist with incorrect styles

**Root Cause Confirmed**: The `mapKey` must be on the `MapContainer` component itself, not just a wrapper div. The GeoJSON components also need unique keys that include both the data source AND the area ID.

### Issue 2: Slow Loading
Currently, the map loads all 1,686+ polygons synchronously. Improvements:
- Show map immediately with skeleton overlay
- Load city counts first (fast)
- Load polygons in background
- Show progressive loading indicator

### Issue 3: Why Keep Production Map?
The production map serves as the **authoritative source** for delivery coverage - it shows what customers will actually experience. The staging/snapshot views are for reviewing changes before they go live.

---

## Solution Plan

### Part 1: Fix Solid Fill (Key on MapContainer)

Move the `key` directly to `MapContainer` instead of the wrapper div, and include the data reference:

**File**: `src/components/map/StagingAreaMap.tsx`

**Current (broken)**:
```tsx
<div key={mapKey} className="h-[500px] rounded-lg overflow-hidden border">
  <MapContainer ...>
```

**Fixed**:
```tsx
<div className="h-[500px] rounded-lg overflow-hidden border">
  <MapContainer
    key={mapKey}  // Key on MapContainer forces complete remount
    center={[59.9, 10.75]}
    zoom={5}
    className="h-full w-full"
  >
```

Additionally, include the areas array length in the key to ensure remount when data changes:

```tsx
const mapKey = useMemo(() => 
  `map-${activeSource}-${selectedCityIds.sort().join('-')}-${areas?.length ?? 0}`, 
  [activeSource, selectedCityIds, areas?.length]
);
```

But there's a problem: `areas` comes from the query, which is in the parent. So the key needs to be computed in `MapContent` where we have access to the areas. Let me restructure:

```tsx
function MapContent({ 
  areas, 
  cities, 
  isLoading,
  activeSource,
  selectedCityIds,
}: { 
  areas: AreaWithGeo[]; 
  cities: string[]; 
  isLoading: boolean;
  activeSource: string;
  selectedCityIds: string[];
}) {
  // Compute key inside MapContent where we have areas
  const mapKey = useMemo(() => 
    `map-${activeSource}-${selectedCityIds.sort().join('-')}-${areas.length}`, 
    [activeSource, selectedCityIds, areas.length]
  );
  
  // ... rest of component
  
  return (
    <div className="space-y-4">
      {/* Legend */}
      ...
      
      {/* Map - key on MapContainer */}
      <div className="h-[500px] rounded-lg overflow-hidden border">
        <MapContainer
          key={mapKey}
          center={[59.9, 10.75]}
          zoom={5}
          className="h-full w-full"
        >
          ...
        </MapContainer>
      </div>
    </div>
  );
}
```

### Part 2: Faster Perceived Loading

**Strategy**: Show the map immediately with a loading overlay, then render polygons once data arrives.

1. **Keep the map visible during loading** (don't replace with skeleton)
2. **Add overlay loading indicator** over the map
3. **Keep city counts cached** for instant tag display

**Changes**:

```tsx
function MapContent({ ... }) {
  // Instead of showing skeleton, show map with overlay
  return (
    <div className="space-y-4">
      {/* Legend - always show, use cached counts */}
      <div className="flex flex-wrap gap-3 text-sm">
        ...
      </div>

      {/* Map with loading overlay */}
      <div className="h-[500px] rounded-lg overflow-hidden border relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 z-[1000] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading areas...</span>
            </div>
          </div>
        )}
        
        <MapContainer
          key={mapKey}
          center={[59.9, 10.75]}
          zoom={5}
          className="h-full w-full"
        >
          <TileLayer ... />
          {!isLoading && areas.map((area) => (
            <GeoJSON key={area.id} ... />
          ))}
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
    </div>
  );
}
```

### Part 3: Optimize Data Fetching

**Current Problem**: Fetching 1,686 areas with full `geofence_json` is slow because JSONB columns are large.

**Optimization Options**:

A) **Parallel fetching** (recommended): Split into metadata query (fast) and geometry query (slower)
B) **Server-side simplification**: Create a view with simplified polygons (requires DB changes)
C) **Lazy loading by viewport**: Only load visible areas (complex, overkill for admin tool)

For now, implement option A: separate the city count query from the geometry query so counts appear instantly.

```tsx
// useCitiesWithCounts - already separate and fast
// useProduction - fetches geometry, takes longer

// In the UI, show city tags immediately with counts
// Show "Loading X areas..." in the map overlay
```

---

## File Changes

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Move `key` to MapContainer, add loading overlay, restructure MapContent props |

---

## Implementation Details

### Change 1: Update MapContent Interface

Remove `mapKey` prop, add `activeSource` and `selectedCityIds`:

```tsx
interface MapContentProps {
  areas: AreaWithGeo[];
  cities: string[];
  isLoading: boolean;
  activeSource: MapSource;
  selectedCityIds: string[];
}
```

### Change 2: Compute mapKey Inside MapContent

```tsx
function MapContent({ 
  areas, 
  cities, 
  isLoading,
  activeSource,
  selectedCityIds,
}: MapContentProps) {
  // Compute key based on all inputs including areas length
  const mapKey = useMemo(() => 
    `map-${activeSource}-${selectedCityIds.sort().join('-')}-${areas.length}`, 
    [activeSource, selectedCityIds, areas.length]
  );
```

### Change 3: Add Loading Overlay (Perceived Performance)

```tsx
import { Loader2 } from "lucide-react";

// In MapContent return:
<div className="h-[500px] rounded-lg overflow-hidden border relative">
  {isLoading && (
    <div className="absolute inset-0 bg-background/80 z-[1000] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading delivery areas...</span>
      </div>
    </div>
  )}
  
  <MapContainer key={mapKey} ...>
    ...
    {/* Only render GeoJSON when not loading to prevent partial render */}
    {!isLoading && areas.map((area) => (
      <GeoJSON key={`${activeSource}-${area.id}`} ... />
    ))}
  </MapContainer>
</div>
```

### Change 4: Update Parent Component Call

```tsx
<MapContent 
  areas={currentQuery.data?.areas ?? []}
  cities={currentQuery.data?.cities ?? []}
  isLoading={currentQuery.isLoading}
  activeSource={activeSource}
  selectedCityIds={selectedCityIds}
/>
```

### Change 5: Remove mapKey from Parent

Remove the `mapKey` useMemo from the parent `StagingAreaMap` component.

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Solid fill polygons | 1-2 always solid | All transparent (0.2 fillOpacity) |
| Initial load | Skeleton blocks map | Map visible with loading overlay |
| City tags | Delayed until all data loads | Instant (cached query) |
| Data loading | All-or-nothing | Progressive with visual feedback |

---

## Technical Notes

### Why Key on MapContainer Works

React-Leaflet's `MapContainer` internally creates a Leaflet map instance when mounted. Child components like `GeoJSON` are added as layers. When the `key` changes:

1. React unmounts the entire `MapContainer`
2. Leaflet cleans up the map instance and all layers
3. A new `MapContainer` mounts with fresh layers
4. All `GeoJSON` components render with current styles

Putting the key on a wrapper `div` doesn't trigger this cleanup because `MapContainer` remains mounted.

### Why Loading Overlay Improves Perceived Performance

Instead of replacing the entire map with a skeleton (which feels like a blank page), showing the map tiles with a semi-transparent overlay:
- Provides visual continuity
- Shows something useful immediately
- Indicates loading is in progress
- Feels faster even if actual load time is the same

