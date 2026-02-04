
# Plan: Fix Swapped Latitude/Longitude in GeoJSON Coordinates

## Root Cause

The geofence data stored in `navio_snapshot` has coordinates in the wrong order. GeoJSON specification requires `[longitude, latitude]`, but the data from Navio is stored as `[latitude, longitude]`:

| Area | Stored | Should Be |
|------|--------|-----------|
| Munich | `[48.06, 11.25]` | `[11.25, 48.06]` |
| Toronto | `[43.60, -79.49]` | `[-79.49, 43.60]` |

When Leaflet interprets `[48.06, 11.25]` as `[lng, lat]`, it places the point at longitude 48°, latitude 11° — which is in the Indian Ocean/Horn of Africa region.

---

## Solution

Add a coordinate-swapping utility function in the map component to correct the data at render time.

### Changes to `src/components/map/StagingAreaMap.tsx`

**Add a new helper function** to swap coordinates in any GeoJSON geometry:

```typescript
function swapCoordinates(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  const swap = (coords: number[]): number[] => [coords[1], coords[0]];
  
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(ring => 
        ring.map(coord => swap(coord))
      ),
    };
  }
  
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(polygon =>
        polygon.map(ring => ring.map(coord => swap(coord)))
      ),
    };
  }
  
  return geometry;
}
```

**Update the `extractGeometry` function** to apply the swap:

```typescript
function extractGeometry(geofenceData: unknown): GeoJSON.Geometry | null {
  // ... existing logic ...
  
  // At the end, swap coordinates before returning
  return swapCoordinates(geometry);
}
```

**Update bounds calculation** in `MapContent` to use corrected order since the geometry is now fixed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/map/StagingAreaMap.tsx` | Add `swapCoordinates` helper, apply it in `extractGeometry`, verify bounds calculation uses swapped data |

---

## Expected Result

After this fix:
- **Munich areas** will appear at ~48°N, 11°E (Germany)
- **Toronto areas** will appear at ~43°N, 79°W (Canada)
- All 215 snapshot areas will render in their correct geographic locations
- The map will auto-zoom to Norway/Europe region as expected

---

## Technical Notes

- The fix is applied at render time only — no database changes needed
- The `useStaging()` hook also needs the same fix applied (for when staging data is used)
- Both `Polygon` and `MultiPolygon` geometries are handled
