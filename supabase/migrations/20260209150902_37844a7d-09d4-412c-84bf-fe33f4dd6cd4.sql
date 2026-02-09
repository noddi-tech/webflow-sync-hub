
-- Add geo verification tracking columns to areas table
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS geo_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_verified_status text,
  ADD COLUMN IF NOT EXISTS geo_overlap_percent numeric,
  ADD COLUMN IF NOT EXISTS geo_verified_point geometry(Point, 4326);

-- Create index for efficient batch queries (unverified areas)
CREATE INDEX IF NOT EXISTS idx_areas_geo_unverified
  ON public.areas (geo_verified_at)
  WHERE geo_verified_at IS NULL AND navio_service_area_id LIKE 'discovered_%';

-- PostGIS function: compute overlap % between a Nominatim polygon and the stored Navio zone
-- The Navio polygons are stored with swapped coordinates [lat,lon] as [x,y].
-- The Nominatim polygons use standard [lon,lat] GeoJSON.
-- So we must swap the Nominatim polygon coords to match the stored space.
CREATE OR REPLACE FUNCTION public.check_area_navio_overlap(
  area_geojson jsonb,
  zone_area_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  area_geom geometry;
  zone_geom geometry;
  swapped_geom geometry;
  intersection_area numeric;
  total_area numeric;
BEGIN
  -- Convert Nominatim GeoJSON to geometry (standard lon,lat)
  area_geom := ST_GeomFromGeoJSON(area_geojson::text);
  area_geom := ST_SetSRID(area_geom, 4326);

  -- Swap the Nominatim polygon coordinates to match Navio's [lat,lon] storage
  -- ST_FlipCoordinates swaps X and Y
  swapped_geom := ST_FlipCoordinates(area_geom);

  -- Get the zone polygon from the areas table
  SELECT geofence INTO zone_geom
  FROM areas
  WHERE id = zone_area_id AND geofence IS NOT NULL;

  IF zone_geom IS NULL THEN
    RETURN NULL;
  END IF;

  -- Make geometries valid
  swapped_geom := ST_MakeValid(swapped_geom);
  zone_geom := ST_MakeValid(zone_geom);

  -- Compute overlap
  total_area := ST_Area(swapped_geom::geography);
  IF total_area = 0 THEN
    RETURN NULL;
  END IF;

  intersection_area := ST_Area(ST_Intersection(swapped_geom, zone_geom)::geography);
  RETURN ROUND((intersection_area / total_area * 100)::numeric, 1);
END;
$$;

-- Also create a simpler function for point-in-polygon fallback with swapped coords
CREATE OR REPLACE FUNCTION public.check_point_in_zone(
  p_lat double precision,
  p_lon double precision,
  zone_area_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  zone_geom geometry;
  -- Swap to match Navio's stored coordinate space
  test_point geometry := ST_SetSRID(ST_MakePoint(p_lat, p_lon), 4326);
BEGIN
  SELECT geofence INTO zone_geom
  FROM areas
  WHERE id = zone_area_id AND geofence IS NOT NULL;

  IF zone_geom IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN ST_Within(test_point, zone_geom);
END;
$$;

-- Cascade function: update district and city is_delivery based on child areas
CREATE OR REPLACE FUNCTION public.cascade_delivery_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update districts: is_delivery = true if ANY child area has is_delivery = true
  UPDATE districts d
  SET is_delivery = EXISTS (
    SELECT 1 FROM areas a WHERE a.district_id = d.id AND a.is_delivery = true
  ),
  updated_at = now();

  -- Update cities: is_delivery = true if ANY child district has is_delivery = true
  UPDATE cities c
  SET is_delivery = EXISTS (
    SELECT 1 FROM districts d WHERE d.city_id = c.id AND d.is_delivery = true
  ),
  updated_at = now();
END;
$$;
