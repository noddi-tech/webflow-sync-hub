-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.sync_geofence_geometry()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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