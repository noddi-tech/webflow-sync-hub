
# Fix Deep Verify: Check Against ALL Navio Zones, Not Just Assigned One

## Root Cause

The deep verify function compares each AI-discovered area's Nominatim polygon against the area's own `geofence` column -- which is the polygon inherited from whichever Navio zone the AI import assigned it to.

The problem: AI import assigned many areas to the **wrong** Navio zone. For example, "Boler" in Oslo was assigned to zone 130 (centroid ~10.50 lon) but actually belongs to zone 123 "Norway Oslo Boler" (centroid ~10.84 lon). The overlap is correctly calculated as 0% because the area genuinely doesn't overlap with zone 130.

**Proof from database:**
- Boler (lat 59.88, lon 10.84) was assigned to zone 130 (bbox lon 10.46-10.54) -- wrong zone
- Querying the navio_snapshot directly: Boler's coordinates fall within zone 123 "Norway Oslo Boler" -- the correct zone
- 22 out of 24 "mismatched" areas show 0% overlap, meaning they're in completely wrong zones

## The Fix

Instead of checking against the single assigned zone, check the Nominatim polygon against **all active Navio zones in the same city**. If the area overlaps >= 90% with ANY zone, it's verified. If it matches a different zone than assigned, reassign it.

## Changes

### 1. New PostGIS function: `check_area_best_navio_overlap`

Replaces per-area checking with a city-wide search:

```sql
-- Takes: Nominatim GeoJSON polygon + city name
-- Returns: best overlap %, matching zone ID, matching zone name
-- Logic:
--   1. Flip Nominatim coordinates to match stored Navio format
--   2. Check against ALL active navio_snapshot zones in that city  
--   3. Return the zone with highest overlap
```

This checks the navio_snapshot table directly (authoritative source) rather than the area's inherited geofence.

### 2. Edge function update (`supabase/functions/navio-import/index.ts`)

In `coverage_check_deep`:
- Call new `check_area_best_navio_overlap` instead of `check_area_navio_overlap`
- If a match is found in a different zone than currently assigned, update the area's `navio_service_area_id` and `geofence` to the correct zone
- For point-in-polygon fallback, also check against all zones via navio_snapshot

### 3. Reset existing verification results

Since the previous batch of 34 results was computed against wrong zones, reset `geo_verified_at`, `geo_verified_status`, and `geo_overlap_percent` to NULL for all areas that were checked, so they get re-verified correctly.

---

## Technical Detail

### New PostGIS function

```sql
CREATE OR REPLACE FUNCTION check_area_best_navio_overlap(
  area_geojson jsonb,
  p_city_name text
) RETURNS TABLE(overlap_percent numeric, zone_id integer, zone_name text)
AS $$
  -- Convert Nominatim polygon and flip coordinates
  -- Loop through navio_snapshot WHERE city_name matches
  -- Extract geometry from geofence_json->'geometry'
  -- Compute overlap for each zone
  -- Return the best match
$$;
```

### Point-in-polygon fallback

```sql
CREATE OR REPLACE FUNCTION check_point_best_navio_zone(
  p_lat float, p_lon float, p_city_name text
) RETURNS TABLE(zone_id integer, zone_name text)
-- Checks swapped point (p_lat, p_lon) against all zones in city
```

### Edge function changes

After getting the best overlap:
- If overlap >= 90%: mark verified, update area's zone assignment if different
- If overlap < 90% but > 0%: mark mismatched with actual percentage  
- If no overlap with any zone: mark mismatched with 0%

## Files to Edit

| File | Change |
|------|--------|
| New SQL migration | Create `check_area_best_navio_overlap` + `check_point_best_navio_zone` functions; reset bad verification data |
| `supabase/functions/navio-import/index.ts` | Use new city-wide overlap functions instead of per-area check |

## Expected Result

After re-running Deep Verify:
- Areas like "Boler" will match zone 123 at high overlap and be marked "verified"
- Areas that genuinely don't fall within any Navio zone will be correctly marked "mismatched"
- Wrongly-assigned zones get corrected automatically
