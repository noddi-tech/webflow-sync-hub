-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns to areas table
ALTER TABLE areas 
ADD COLUMN IF NOT EXISTS geofence geometry(Polygon, 4326),
ADD COLUMN IF NOT EXISTS geofence_center geometry(Point, 4326);

-- Create spatial index for fast point-in-polygon queries
CREATE INDEX IF NOT EXISTS areas_geofence_idx ON areas USING GIST (geofence);
CREATE INDEX IF NOT EXISTS areas_geofence_center_idx ON areas USING GIST (geofence_center);

-- Function to convert JSONB geofence to geometry (for migration of existing data)
CREATE OR REPLACE FUNCTION public.sync_geofence_geometry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- When geofence_json is updated, convert to geometry
  IF NEW.geofence_json IS NOT NULL AND NEW.geofence_json != '{}'::jsonb THEN
    NEW.geofence := ST_SetSRID(ST_GeomFromGeoJSON(NEW.geofence_json::text), 4326);
    NEW.geofence_center := ST_Centroid(NEW.geofence);
  ELSE
    NEW.geofence := NULL;
    NEW.geofence_center := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-sync geometry when JSONB is updated
DROP TRIGGER IF EXISTS sync_geofence_geometry_trigger ON areas;
CREATE TRIGGER sync_geofence_geometry_trigger
BEFORE INSERT OR UPDATE OF geofence_json ON areas
FOR EACH ROW
EXECUTE FUNCTION public.sync_geofence_geometry();

-- Migrate existing geofence_json data to geometry columns
UPDATE areas 
SET geofence = ST_SetSRID(ST_GeomFromGeoJSON(geofence_json::text), 4326),
    geofence_center = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(geofence_json::text), 4326))
WHERE geofence_json IS NOT NULL AND geofence_json != '{}'::jsonb;

-- Function to check if a point is within any delivery area
CREATE OR REPLACE FUNCTION public.find_delivery_areas(
  lng double precision,
  lat double precision
)
RETURNS TABLE (
  area_id uuid,
  area_name text,
  district_id uuid,
  district_name text,
  city_id uuid,
  city_name text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as area_id,
    a.name as area_name,
    d.id as district_id,
    d.name as district_name,
    c.id as city_id,
    c.name as city_name
  FROM areas a
  JOIN districts d ON a.district_id = d.id
  JOIN cities c ON d.city_id = c.id
  WHERE a.is_delivery = true
    AND a.geofence IS NOT NULL
    AND ST_Contains(a.geofence, ST_SetSRID(ST_MakePoint(lng, lat), 4326));
$$;