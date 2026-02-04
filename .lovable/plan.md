

# Complete Fix: Production Map Issues

## Issues Identified

### Issue 1: City Counts Still Wrong (e.g., Göteborg shows 313 instead of 1,113)

**Root Cause**: The pagination code was added, but either:
- The build hasn't refreshed with the new code, OR
- There's a logic bug where the first page returns exactly 1000 rows (triggering the `break` condition prematurely)

**Database Verification** (confirmed via SQL):
| City | Expected | Displayed |
|------|----------|-----------|
| Göteborg | 1,113 | 313 |
| Oslo | 573 | 310 |
| Stockholm | 508 | 78 |

### Issue 2: Map Shows "1000 areas" Instead of Correct Count

**Root Cause**: Same pagination issue - `useProduction` is only fetching the first 1000 rows instead of all ~2,194 for selected cities.

### Issue 3: Solid Filled Polygons (One per City)

**Root Cause**: React-Leaflet's GeoJSON component has a known behavior where it doesn't properly re-render when data changes. When switching between tabs or cities, old GeoJSON layers can persist with incorrect styling, causing visual artifacts like solid fills.

**Technical Detail**: The GeoJSON component creates a Leaflet layer when mounted. If the `key` doesn't change but the underlying `data` does, the layer may not update correctly.

---

## Solution

### Part 1: Verify Pagination Logic Works Correctly

The current code at lines 226-244 and 274-310 has a potential issue: if the first batch returns exactly 1000 rows, the loop continues. But if it returns fewer (like 999), it breaks early. The logic seems correct, but let me trace through:

```typescript
// Current logic:
if (!areaPage || areaPage.length === 0) break;  // Exit if no data
// ... process data ...
if (areaPage.length < pageSize) break;  // Exit if partial page
from += pageSize;  // Continue to next page
```

This logic is correct. The issue might be that the Supabase query is somehow being limited. Let me check if there's an implicit `.order()` that might help ensure consistent pagination.

**Fix**: Add explicit ordering to ensure consistent pagination results:

```typescript
// Line 227-231: Add .order('id') to ensure consistent pagination
const { data: areaPage, error: areaError } = await supabase
  .from("areas")
  .select("city_id")
  .not("geofence_json", "is", null)
  .order("id")  // ADD THIS
  .range(from, from + pageSize - 1);
```

Same for `useProduction`:

```typescript
// Line 275-285: Add .order('id')
const { data, error } = await supabase
  .from("areas")
  .select(`...`)
  .in("city_id", selectedCityIds)
  .not("geofence_json", "is", null)
  .order("id")  // ADD THIS
  .range(from, from + pageSize - 1);
```

### Part 2: Fix Solid Fill Issue (React-Leaflet GeoJSON Re-render Bug)

The solid fill is caused by React-Leaflet's GeoJSON component not properly cleaning up when data changes. 

**Solution Options**:

A) **Force remount by including data source in key** (Simplest):
```tsx
// Line 425: Add unique prefix to force remount on source change
<GeoJSON
  key={`${activeSource}-${area.id}`}  // Include source in key
  data={{...}}
  style={{...}}
/>
```

B) **Use a wrapper key on the entire MapContainer** to force remount when cities change:
```tsx
// Wrap map in a keyed div that changes when selection changes
<div key={selectedCityIds.sort().join(',')}>
  <MapContainer>...</MapContainer>
</div>
```

C) **Clear and recreate GeoJSON layers manually** (More complex, not recommended)

**Recommended**: Option A is cleanest - but the key needs to be even more unique since we're seeing issues within the same source. The real fix is to ensure the MapContainer remounts when the data set changes significantly.

**Best Fix**: Use a combined approach - unique key per area AND force remount when selected cities change:

```tsx
// In StagingAreaMap component, create a stable key based on selection
const mapKey = useMemo(() => 
  `${activeSource}-${selectedCityIds.sort().join('-')}`, 
  [activeSource, selectedCityIds]
);

// Use this key on the map container wrapper
<div key={mapKey} className="h-[500px] rounded-lg overflow-hidden border">
  <MapContainer>...</MapContainer>
</div>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/map/StagingAreaMap.tsx` | Add `.order('id')` to both pagination queries, add unique map key |

---

## Implementation Details

### Change 1: Add Ordering to useCitiesWithCounts Pagination

**Location**: Lines 227-231

```typescript
const { data: areaPage, error: areaError } = await supabase
  .from("areas")
  .select("city_id")
  .not("geofence_json", "is", null)
  .order("id")  // Ensures consistent pagination
  .range(from, from + pageSize - 1);
```

### Change 2: Add Ordering to useProduction Pagination

**Location**: Lines 275-285

```typescript
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
  .order("id")  // Ensures consistent pagination
  .range(from, from + pageSize - 1);
```

### Change 3: Fix React-Leaflet GeoJSON Re-render Issue

**Location**: MapContent component (around line 411-451)

Pass a unique key based on the current selection to the parent, and use it on the map container:

```tsx
// In StagingAreaMap, before return statement:
const mapKey = useMemo(() => 
  `map-${activeSource}-${selectedCityIds.sort().join('-')}`, 
  [activeSource, selectedCityIds]
);

// Pass to MapContent
<MapContent 
  mapKey={mapKey}  // NEW PROP
  areas={currentQuery.data?.areas ?? []}
  cities={currentQuery.data?.cities ?? []}
  isLoading={currentQuery.isLoading}
/>

// In MapContent, wrap the map container:
<div key={mapKey} className="h-[500px] rounded-lg overflow-hidden border">
  <MapContainer ...>
    ...
  </MapContainer>
</div>
```

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Göteborg tag count | 313 | 1,113 |
| Oslo tag count | 310 | 573 |
| Stockholm tag count | 78 | 508 |
| Areas displayed (3 cities) | 1,000 (limited) | 2,194 (all) |
| Solid fill polygons | 1-2 visible | None (transparent 0.2 fill) |

---

## Technical Notes

### Why Pagination Needs Ordering

Without explicit `.order()`, Postgres may return rows in different orders across paginated requests, especially when the data is large. This can cause:
- Duplicate rows across pages
- Missing rows between pages
- Inconsistent counts

Adding `.order('id')` ensures deterministic ordering across pagination.

### Why React-Leaflet GeoJSON Needs Key Reset

React-Leaflet's GeoJSON component internally creates a Leaflet layer when mounted. When React reconciles the component tree:
- If the `key` stays the same, React tries to update the existing component
- Leaflet's layer update logic may not handle style/data changes correctly
- This can leave "ghost" layers with old styles

By changing the key when the dataset changes significantly, we force React to unmount the old component and mount a fresh one, ensuring clean layer creation.

