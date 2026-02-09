
-- New function: check area polygon against ALL active navio zones in a city
-- Returns the best matching zone (highest overlap)
CREATE OR REPLACE FUNCTION check_area_best_navio_overlap(
  area_geojson jsonb,
  p_city_name text
) RETURNS TABLE(overlap_percent numeric, zone_id integer, zone_name text)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  area_geom geometry;
  best_overlap numeric := 0;
  best_zone_id integer := NULL;
  best_zone_name text := NULL;
  zone_geom geometry;
  cur_overlap numeric;
  r record;
BEGIN
  -- Convert Nominatim GeoJSON to geometry
  -- Nominatim returns [lon, lat] which is standard GeoJSON, so no flip needed
  BEGIN
    area_geom := ST_SetSRID(ST_GeomFromGeoJSON(area_geojson::text), 4326);
    IF NOT ST_IsValid(area_geom) THEN
      area_geom := ST_MakeValid(area_geom);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 0::numeric, NULL::integer, NULL::text;
    RETURN;
  END;

  -- Loop through all active navio_snapshot zones in this city
  FOR r IN
    SELECT ns.navio_service_area_id, ns.name AS sname, ns.geofence_json
    FROM navio_snapshot ns
    WHERE ns.city_name = p_city_name
      AND ns.is_active = true
      AND ns.geofence_json IS NOT NULL
  LOOP
    BEGIN
      -- navio_snapshot stores coordinates as [lat, lon] -- need to flip
      -- Extract geometry from geofence_json->'geometry' and flip coordinates
      zone_geom := ST_SetSRID(
        ST_GeomFromGeoJSON((r.geofence_json->'geometry')::text),
        4326
      );
      -- Flip coordinates: navio stores [lat,lon] but GeoJSON expects [lon,lat]
      zone_geom := ST_FlipCoordinates(zone_geom);
      
      IF NOT ST_IsValid(zone_geom) THEN
        zone_geom := ST_MakeValid(zone_geom);
      END IF;

      -- Compute overlap: what % of area_geom is inside zone_geom
      IF ST_Intersects(area_geom, zone_geom) THEN
        cur_overlap := ROUND(
          (ST_Area(ST_Intersection(area_geom, zone_geom)::geography) / 
           NULLIF(ST_Area(area_geom::geography), 0)) * 100,
          1
        );
        IF cur_overlap > best_overlap THEN
          best_overlap := cur_overlap;
          best_zone_id := r.navio_service_area_id;
          best_zone_name := r.sname;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip invalid geometries
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT best_overlap, best_zone_id, best_zone_name;
  RETURN;
END;
$$;

-- New function: point-in-polygon check against ALL zones in a city
CREATE OR REPLACE FUNCTION check_point_best_navio_zone(
  p_lat float,
  p_lon float,
  p_city_name text
) RETURNS TABLE(zone_id integer, zone_name text)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  point_geom geometry;
  zone_geom geometry;
  r record;
BEGIN
  -- Create point as [lon, lat] (standard)
  point_geom := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

  FOR r IN
    SELECT ns.navio_service_area_id, ns.name AS sname, ns.geofence_json
    FROM navio_snapshot ns
    WHERE ns.city_name = p_city_name
      AND ns.is_active = true
      AND ns.geofence_json IS NOT NULL
  LOOP
    BEGIN
      zone_geom := ST_SetSRID(
        ST_GeomFromGeoJSON((r.geofence_json->'geometry')::text),
        4326
      );
      zone_geom := ST_FlipCoordinates(zone_geom);
      
      IF NOT ST_IsValid(zone_geom) THEN
        zone_geom := ST_MakeValid(zone_geom);
      END IF;

      IF ST_Contains(zone_geom, point_geom) THEN
        RETURN QUERY SELECT r.navio_service_area_id, r.sname;
        RETURN;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  -- No match found
  RETURN QUERY SELECT NULL::integer, NULL::text;
  RETURN;
END;
$$;

-- Reset stale verification results so they get re-verified with the new logic
UPDATE areas
SET geo_verified_at = NULL,
    geo_verified_status = NULL,
    geo_overlap_percent = NULL
WHERE geo_verified_at IS NOT NULL;
