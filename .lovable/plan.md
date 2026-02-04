
# Fix: Geo Sync Not Updating Production Areas

## Problem Summary

The Geo Sync completes successfully for Navio's own records (188 polygons synced), but **fails silently** when trying to apply geofences to your ~4,800 AI-discovered production areas.

Every city fails with:
```
Failed to apply geofence to areas in [city]: invalid GeoJson representation
```

## Root Cause

The database has a trigger (`sync_geofence_geometry`) that converts `geofence_json` to PostGIS geometry. It fails because:

| Issue | Expected | Received from Navio |
|-------|----------|---------------------|
| GeoJSON type | Geometry object | Feature object |
| Polygon type | Polygon | MultiPolygon |

The trigger calls:
```sql
ST_GeomFromGeoJSON(NEW.geofence_json::text)
```

This fails because:
- `ST_GeomFromGeoJSON` expects `{type: "Polygon", coordinates: [...]}` 
- Navio sends `{type: "Feature", geometry: {type: "MultiPolygon", ...}}`

## Solution

### 1. Database Migration

**Alter the geometry column type:**
```sql
ALTER TABLE public.areas 
  ALTER COLUMN geofence TYPE geometry(MultiPolygon, 4326)
  USING ST_Multi(geofence);
```

**Update the trigger function to handle Feature objects:**
```sql
CREATE OR REPLACE FUNCTION public.sync_geofence_geometry()
RETURNS TRIGGER AS $$
DECLARE
  geom_json jsonb;
BEGIN
  IF NEW.geofence_json IS NULL THEN
    NEW.geofence := NULL;
    NEW.geofence_center := NULL;
    RETURN NEW;
  END IF;

  -- Extract geometry from Feature/FeatureCollection if needed
  IF NEW.geofence_json->>'type' = 'Feature' THEN
    geom_json := NEW.geofence_json->'geometry';
  ELSIF NEW.geofence_json->>'type' = 'FeatureCollection' THEN
    geom_json := NEW.geofence_json->'features'->0->'geometry';
  ELSE
    geom_json := NEW.geofence_json;
  END IF;

  -- Convert to MultiPolygon geometry
  NEW.geofence := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom_json::text), 4326));
  NEW.geofence_center := ST_PointOnSurface(NEW.geofence);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't block the update
  RAISE WARNING 'Failed to convert geofence_json: %', SQLERRM;
  NEW.geofence := NULL;
  NEW.geofence_center := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. UI Fix: Show production_areas_updated in toast

**File: `src/hooks/useNavioImport.ts`**

Update the toast message to include the production areas count:

```typescript
toast({
  title: "Geo Sync Complete",
  description: `${result.production_areas_updated?.toLocaleString() || 0} production areas updated, ${result.polygons_synced} polygons synced`,
});
```

### 3. UI Fix: Invalidate queries after sync

**File: `src/hooks/useNavioImport.ts`**

Add query invalidation in `onSuccess` for `geoSyncMutation`:

```typescript
onSuccess: (result) => {
  queryClient.invalidateQueries({ queryKey: ["production-data"] });
  queryClient.invalidateQueries({ queryKey: ["production-geofences"] });
  queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
  // ... existing toast
},
```

This ensures the Production tab and pipeline banner update immediately without manual refresh.

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration (new) | Alter geofence column type, update trigger function |
| `src/hooks/useNavioImport.ts` | Add query invalidation, improve toast message |

---

## Expected Outcome

After this fix:
1. Geo Sync will successfully write geofences to all ~4,800 production areas
2. Toast will show: "4,800+ production areas updated, 188 polygons synced"
3. Production tab will show ~100% geofence coverage
4. Map will display all production areas with polygons
5. Delivery checker will work (valid geometry for ST_Contains queries)

---

## Technical Details

**Why ST_PointOnSurface instead of ST_Centroid?**
For concave polygons, the centroid can fall outside the polygon. `ST_PointOnSurface` guarantees a point inside the polygon, which is better for display/queries.

**Why wrap in EXCEPTION handler?**
If any geofence has malformed data, we don't want to block the entire row update. The handler logs a warning and leaves the geometry columns null.

**Why ST_Multi?**
This ensures all geometries are stored as MultiPolygon, even if Navio sends a simple Polygon. This makes querying consistent.
