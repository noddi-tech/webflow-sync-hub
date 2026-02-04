
# Plan: Fix Map Not Displaying Geofences

## Root Cause

The map component filters geofences by checking:
```javascript
if (geofence.type === "Polygon" || geofence.type === "MultiPolygon")
```

But the actual data in `navio_snapshot` is stored as a **GeoJSON Feature**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [...]
  }
}
```

The code expects a raw Geometry but receives a Feature wrapper, so all 215 areas fail the type check and are skipped.

---

## Database State

| Source | Total | With Geofence | Geofence Format |
|--------|-------|---------------|-----------------|
| Snapshot | 215 | 215 | Feature → geometry.MultiPolygon |
| Production | 4,865 | 0 | No geofences yet |
| Staging | 0 | - | Empty |

---

## Solution

Update the `useSnapshot()` and `useProduction()` query handlers to extract the geometry from Feature-wrapped geofences.

### Changes to `src/components/map/StagingAreaMap.tsx`

**In `useSnapshot()` (lines 127-139):**

```typescript
// Current (broken):
const geofence = entry.geofence_json as unknown as GeoJSON.Geometry | null;
if (geofence && geofence.type && (geofence.type === "Polygon" || geofence.type === "MultiPolygon")) {

// Fixed:
let geofence = entry.geofence_json as unknown as GeoJSON.Geometry | GeoJSON.Feature | null;

// Extract geometry if it's a Feature wrapper
if (geofence && geofence.type === "Feature" && (geofence as GeoJSON.Feature).geometry) {
  geofence = (geofence as GeoJSON.Feature).geometry;
}

if (geofence && (geofence.type === "Polygon" || geofence.type === "MultiPolygon")) {
```

**In `useProduction()` (lines 172-185):**

Apply the same fix to handle production areas once they have geofences.

### Create a Helper Function

To avoid code duplication, extract a reusable helper:

```typescript
function extractGeometry(geofenceData: unknown): GeoJSON.Geometry | null {
  if (!geofenceData || typeof geofenceData !== 'object') return null;
  
  const geo = geofenceData as { type?: string; geometry?: GeoJSON.Geometry };
  
  // Handle Feature wrapper
  if (geo.type === "Feature" && geo.geometry) {
    return geo.geometry;
  }
  
  // Handle direct Geometry
  if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
    return geo as GeoJSON.Geometry;
  }
  
  return null;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Add `extractGeometry` helper, update snapshot and production query handlers |

---

## Expected Result

After this fix:
- **Snapshot tab**: Will show 215 areas with geofences
- **Staging tab**: Will remain at 0 (no queue data)
- **Production tab**: Will remain at 0 until geofences are synced to production `areas` table

The map will render the 215 geofence polygons from the snapshot data with city-based color coding.
