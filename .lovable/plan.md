

# Plan: Fix Map Visibility and Geo Sync Matching Issue

## Current Situation

### Where is the map?
The map is located at: **Navio Preview page → "Map View" tab** (accessible via "Go to Preview" button)

### Why it shows empty
1. **StagingAreaMap** reads from `navio_import_queue` table - only populated during **AI Import**, not Geo Sync
2. **Geo Sync ran but polygons weren't applied** because of ID mismatch:
   - Existing areas have: `navio_service_area_id = 'discovered_6c55c8e7-...'` (AI-generated UUIDs)
   - Geo Sync looks for: `navio_service_area_id = '210'` (real Navio API IDs)
   - No matches found → no geofences updated

---

## Data State Summary

| Metric | Value |
|--------|-------|
| Total production areas | 4,865 |
| Areas with `discovered_*` IDs | 4,677 |
| Areas with real Navio IDs | 188 |
| Areas with geofence polygons | 0 |
| Snapshot areas | 215 |
| `navio_import_queue` rows | 18 (from AI Import) |

---

## Solution Options

### Option A: Add Production Map Tab (Quick Fix)
Add a second map option that shows production data from the `areas` table directly, even if geofences are missing.

### Option B: Fix Geo Sync Matching (Proper Fix)
Update the Geo Sync function to match areas by **name + city** instead of just `navio_service_area_id`, then update the `navio_service_area_id` to the real Navio ID while adding the geofence.

### Option C: Run AI Import First, Then Geo Sync (Workflow Fix)
The `navio_import_queue` table HAS geofence data from the last AI Import. The StagingAreaMap already reads from this. The issue is just that:
1. AI Import runs → populates `navio_import_queue` with geofences 
2. Commit creates areas but with `discovered_*` IDs and NO geofences (geofence wasn't carried over during commit)
3. Geo Sync can't match because IDs don't match

---

## Recommended Approach: Fix Both Issues

### Fix 1: Make StagingAreaMap also read from Snapshot
Since Geo Sync updates the snapshot with all current Navio areas including geofences, the Map View should also be able to read from `navio_snapshot` (not just `navio_import_queue`).

```text
File: src/components/map/StagingAreaMap.tsx

Add option to read from:
- navio_import_queue (current - for AI Import preview)
- navio_snapshot (new - for Geo Sync preview)
- Or both combined
```

### Fix 2: Fix Geo Sync Area Matching
Update the Geo Sync function to match areas by name+city+country when `navio_service_area_id` lookup fails, then update the ID.

```text
File: supabase/functions/navio-import/index.ts

In syncGeoAreas function:
1. First try: match by navio_service_area_id
2. Fallback: match by name + district_id + city_id
3. If fallback match found, update the navio_service_area_id to real Navio ID
4. Then apply the geofence
```

### Fix 3: Carry Geofence During Commit
The commit function should retrieve geofences from `navio_import_queue` and apply them when creating areas.

---

## Implementation Plan

### Task 1: Add Snapshot-Based Map Source
**File:** `src/components/map/StagingAreaMap.tsx`

Add a `source` prop that can be:
- `"staging"` - reads from `navio_import_queue` (current behavior)
- `"snapshot"` - reads from `navio_snapshot` (new)
- `"production"` - reads from `areas` table (for committed data)

The map on NavioPreview should show snapshot data after Geo Sync since that's what was just fetched.

### Task 2: Fix Geo Sync Area Matching
**File:** `supabase/functions/navio-import/index.ts`

In `syncGeoAreas()` function around line 1964:
```typescript
// Current: Only matches by navio_service_area_id
const { data: existingArea } = await supabase
  .from("areas")
  .select("id")
  .eq("navio_service_area_id", String(areaData.navioId))
  .maybeSingle();

// New: Add fallback matching by name + city
if (!existingArea) {
  // Try matching by name in the same city
  const { data: matchByName } = await supabase
    .from("areas")
    .select("id")
    .eq("city_id", cityId)
    .ilike("name", areaData.displayName || areaData.name)
    .maybeSingle();
  
  if (matchByName) {
    // Update with real Navio ID and geofence
    await supabase.from("areas").update({
      navio_service_area_id: String(areaData.navioId),
      geofence_json: areaData.geofence,
      navio_imported_at: new Date().toISOString(),
    }).eq("id", matchByName.id);
    result.areas_updated++;
    if (areaData.geofence) result.polygons_synced++;
    continue; // Skip the rest of this iteration
  }
}
```

### Task 3: Show Map Based on Last Operation
**File:** `src/pages/NavioPreview.tsx`

After Geo Sync, pass the appropriate source to StagingAreaMap:
```typescript
<StagingAreaMap 
  batchId={selectedBatch} 
  source={lastOperation === 'geo_sync' ? 'snapshot' : 'staging'}
/>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Add `source` prop, support reading from snapshot |
| `src/pages/NavioPreview.tsx` | Pass source based on operation type |
| `supabase/functions/navio-import/index.ts` | Add fallback name+city matching in Geo Sync |
| `src/pages/NavioOperations.tsx` | Track last operation type |

---

## Immediate Workaround

While these fixes are being implemented, you can see the map with geofences by:
1. Going to **Navio Preview** page
2. The 18 entries in `navio_import_queue` from the AI Import HAVE geofence data
3. Select the batch from the dropdown
4. Click "Map View" tab

The AI Import batch should show polygons if there are any areas with `geofence_geojson` in the queue data.

