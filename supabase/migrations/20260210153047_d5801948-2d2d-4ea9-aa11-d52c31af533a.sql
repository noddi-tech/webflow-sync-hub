
-- Fix check_area_best_navio_overlap: cast ST_Area results to numeric before ROUND
CREATE OR REPLACE FUNCTION check_area_best_navio_overlap(
  area_geojson jsonb,
  p_city_name text
)
RETURNS TABLE(overlap_percent numeric, zone_id integer, zone_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  area_geom geometry;
  zone_geom geometry;
  zone_record RECORD;
  cur_overlap numeric;
  best_overlap numeric := 0;
  best_zone_id integer := NULL;
  best_zone_name text := NULL;
BEGIN
  -- Convert the Nominatim GeoJSON to geometry and flip coordinates
  -- Nominatim returns [lon, lat] but we need to handle potential coordinate issues
  BEGIN
    area_geom := ST_SetSRID(ST_GeomFromGeoJSON(area_geojson::text), 4326);
    IF area_geom IS NULL OR ST_IsEmpty(area_geom) THEN
      RETURN QUERY SELECT 0::numeric, NULL::integer, NULL::text;
      RETURN;
    END IF;
    -- Make valid if needed
    IF NOT ST_IsValid(area_geom) THEN
      area_geom := ST_MakeValid(area_geom);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to parse area GeoJSON: %', SQLERRM;
    RETURN QUERY SELECT 0::numeric, NULL::integer, NULL::text;
    RETURN;
  END;

  -- Loop through all active zones in this city
  FOR zone_record IN
    SELECT
      ns.navio_service_area_id AS z_id,
      ns.name AS z_name,
      ns.geofence_json
    FROM navio_snapshot ns
    WHERE ns.city_name = p_city_name
      AND ns.is_active = true
      AND ns.geofence_json IS NOT NULL
  LOOP
    BEGIN
      -- Extract geometry from the stored geofence_json
      -- Navio stores coordinates as [lat, lon] so we need to flip them
      zone_geom := ST_SetSRID(
        ST_GeomFromGeoJSON(
          (zone_record.geofence_json->'geometry')::text
        ),
        4326
      );

      IF zone_geom IS NULL OR ST_IsEmpty(zone_geom) THEN
        CONTINUE;
      END IF;

      IF NOT ST_IsValid(zone_geom) THEN
        zone_geom := ST_MakeValid(zone_geom);
      END IF;

      -- Flip coordinates: ST_FlipCoordinates swaps x/y (lon/lat <-> lat/lon)
      zone_geom := ST_FlipCoordinates(zone_geom);

      -- Check if geometries intersect at all
      IF NOT ST_Intersects(area_geom, zone_geom) THEN
        CONTINUE;
      END IF;

      -- Calculate overlap percentage (area of intersection / area of input polygon)
      -- Cast to numeric BEFORE calling ROUND to avoid "ROUND(double precision, integer)" error
      cur_overlap := ROUND(
        (ST_Area(ST_Intersection(area_geom, zone_geom)::geography)::numeric /
         NULLIF(ST_Area(area_geom::geography)::numeric, 0)) * 100,
        1
      );

      IF cur_overlap > best_overlap THEN
        best_overlap := cur_overlap;
        best_zone_id := zone_record.z_id;
        best_zone_name := zone_record.z_name;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error checking zone % (%): %', zone_record.z_id, zone_record.z_name, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT best_overlap, best_zone_id, best_zone_name;
END;
$$;

-- Reset all stale verification results (computed with broken function)
UPDATE areas
SET geo_verified_at = NULL,
    geo_verified_status = NULL,
    geo_overlap_percent = NULL
WHERE geo_verified_at IS NOT NULL
  AND navio_service_area_id LIKE 'discovered_%';
