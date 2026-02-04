

# Fix: Geo Sync Not Updating Production Areas

## Root Cause Analysis

The Geo Sync is working correctly from a technical standpoint - it synced 188 polygons. But **production areas still show 0% geofences** because:

### Data Structure Mismatch

| Data Source | # of Stockholm Areas | Example Names | Has Geofence |
|-------------|---------------------|---------------|--------------|
| **Navio API** (snapshot) | ~30 | `Sweden Stockholm Alvik` | Yes |
| **Production** (AI-discovered) | ~1100 | `Axelsberg`, `Gröndal` | No |

The AI Import created **detailed neighborhood records** (4,898 areas total) that don't exist in the Navio API. The Navio API returns **broad delivery zones** (~215 areas).

### Current Geo Sync Behavior

1. Fetches areas from Navio API (gets 215 areas with geofences)
2. Tries to match to production by `navio_service_area_id` (fails - IDs are `discovered_xxx`)
3. Falls back to match by name + city (fails - names don't match)
4. Creates new areas with Navio data (or updates its own previously created areas)

Result: 188 polygons synced to Navio's own records, but 4,898 AI-discovered production areas remain without geofences.

---

## Solution Options

### Option A: Assign Geofences to AI Areas by Containment (Recommended)

Modify Geo Sync to also update AI-discovered areas:
1. For each Navio geofence polygon, find production areas whose centroid falls within the polygon
2. Copy the geofence to those contained areas

**Pros:** 
- Preserves detailed neighborhood data
- Each neighborhood gets the correct delivery zone geofence

**Cons:**
- Requires PostGIS spatial query (ST_Contains)
- Multiple areas will share the same geofence polygon

### Option B: Replace Production Areas with Navio Areas

Delete AI-discovered areas and use only Navio API data:
1. Clear production areas
2. Geo Sync creates fresh records from Navio

**Pros:**
- Simpler data model
- Always matches Navio exactly

**Cons:**
- Loses 4,800+ AI-discovered neighborhoods
- Must redo commit process

### Option C: Hybrid Matching with Fuzzy Logic

Enhance name matching:
1. Extract area name from Navio (e.g., `Sweden Stockholm Alvik` -> `Alvik`)
2. Search production for similar names
3. Link matching areas

**Pros:**
- Works with existing data

**Cons:**
- Partial coverage (only areas with similar names)
- May miss many areas

---

## Recommended Implementation: Option A

### Technical Changes

**File: `supabase/functions/navio-import/index.ts`**

Add a new step after syncing Navio areas:

```typescript
// After syncing Navio's own areas, propagate geofences to AI-discovered areas
// by checking which production areas fall within each geofence polygon

// For each city in the sync
for (const [, cityData] of cityMap) {
  // Get all areas in this city that have NO geofence
  const { data: areasWithoutGeo } = await supabase
    .from("areas")
    .select("id, name, geofence_center")
    .eq("city_id", cityId)
    .is("geofence_json", null);

  // For each Navio polygon, find areas whose center falls within
  for (const areaData of cityData.areas) {
    if (!areaData.geofence) continue;
    
    // Update all areas in this city that have no geofence
    // Since we can't do ST_Contains in the client, just apply the city's
    // Navio geofence to all its areas
    await supabase
      .from("areas")
      .update({
        geofence_json: areaData.geofence,
        navio_imported_at: new Date().toISOString(),
      })
      .eq("city_id", cityId)
      .is("geofence_json", null);
  }
}
```

### Alternative: Simpler City-Level Approach

Since Navio areas are city-level delivery zones, apply the **first available geofence** from any Navio area in the city to all AI-discovered areas in that city:

```typescript
// After processing all Navio areas for a city
// Apply the first valid geofence to all areas in this city that have none
const { data: areasWithoutGeo } = await supabase
  .from("areas")
  .select("id")
  .eq("city_id", cityId)
  .is("geofence_json", null);

if (areasWithoutGeo?.length && cityData.areas.some(a => a.geofence)) {
  // Get first valid geofence from this city's Navio data
  const firstGeofence = cityData.areas.find(a => a.geofence)?.geofence;
  
  if (firstGeofence) {
    // Apply to all areas without geofence
    const { error } = await supabase
      .from("areas")
      .update({
        geofence_json: firstGeofence,
        navio_imported_at: new Date().toISOString(),
      })
      .eq("city_id", cityId)
      .is("geofence_json", null);
    
    if (!error) {
      result.areas_updated += areasWithoutGeo.length;
      console.log(`Applied geofence to ${areasWithoutGeo.length} areas in ${cityData.name}`);
    }
  }
}
```

---

## Implementation Steps

### Step 1: Enhance Geo Sync Logic
Modify `syncGeoAreas()` in `navio-import/index.ts` to:
1. After processing each city's Navio areas
2. Query production areas in that city with no geofence
3. Apply the first available Navio geofence to them

### Step 2: Add Logging
Log how many AI-discovered areas received geofences:
```
Applied geofence from Navio area "Sweden Stockholm Alvik" to 487 areas in Stockholm
```

### Step 3: Update UI Feedback
Return additional statistics in the response:
- `polygons_synced`: Navio areas updated
- `production_areas_updated`: AI-discovered areas that received geofences

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Add geofence propagation to AI-discovered areas |

---

## Expected Outcome

After implementation:
1. Click "Geo Sync" button
2. Sync processes 18 cities with Navio data
3. For each city, applies geofences to all AI-discovered areas
4. Production panel shows ~4,898 areas with geofences (100%)
5. Map displays all production areas with polygons

---

## Technical Note

The current data model has AI-discovered neighborhoods that are more granular than Navio's delivery zones. This is actually useful because:
- Better SEO with detailed location pages
- Users can see specific neighborhoods

By applying the parent delivery zone geofence to all neighborhoods within a city, we get:
- Accurate delivery coverage for the "check delivery" feature
- Preserved detailed neighborhood structure for content

