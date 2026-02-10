

# Fix Deep Verify: Two Critical Bugs

## Root Cause Analysis

### Bug 1: `ROUND(double precision, integer)` does not exist (CRITICAL)

The PostGIS function `check_area_best_navio_overlap` silently fails on **every single zone** because PostgreSQL's `ROUND()` with a precision argument only accepts `numeric`, not `double precision`. Since `ST_Area()` returns `double precision`, the call `ROUND(ST_Area(...) * 100, 1)` throws an error.

The function has `EXCEPTION WHEN OTHERS THEN CONTINUE` around each zone check, so it swallows this error and skips to the next zone -- meaning **zero zones are ever successfully compared**. The function always returns `overlap_percent=0, zone_id=NULL`.

**This is why every area shows 0% overlap and zone "null".**

**Fix**: Cast the expression to `numeric` before rounding:
```sql
ROUND(
  ((ST_Area(...)::numeric / NULLIF(ST_Area(...)::numeric, 0)) * 100),
  1
)
```

### Bug 2: Edge function timeout after ~22 areas

The function processes 45 areas per batch but the time budget check uses `48000ms` (48s). With Nominatim's 1.1s delay per area plus PostGIS RPC calls plus geocoding fetch time, each area takes ~2-3 seconds. The function only gets through ~22 areas before hitting the wall clock timeout and being killed.

The "Failed to fetch" console errors are the client-side symptom -- the edge function is killed by the runtime before it can return a response.

**Fix**: Reduce batch size to 25 and lower the time guard to 40s to ensure the function always completes and returns a response.

### Bug 3: `check_point_best_navio_zone` same ROUND issue (secondary)

While this function doesn't use ROUND, checking for consistency -- actually it doesn't calculate overlap, just containment. But it does have the same pattern of silently swallowing errors. No fix needed here but worth noting.

## Changes

### 1. SQL Migration: Fix the PostGIS function

Replace `check_area_best_navio_overlap` with a corrected version that casts `ST_Area` results to `numeric` before calling `ROUND`:

```sql
CREATE OR REPLACE FUNCTION check_area_best_navio_overlap(
  area_geojson jsonb,
  p_city_name text
) RETURNS TABLE(overlap_percent numeric, zone_id integer, zone_name text)
...
  -- Fix: cast to numeric
  cur_overlap := ROUND(
    (ST_Area(ST_Intersection(area_geom, zone_geom)::geography)::numeric / 
     NULLIF(ST_Area(area_geom::geography)::numeric, 0)) * 100,
    1
  );
```

Also reset all existing verification results (since they were all computed with the broken function):

```sql
UPDATE areas
SET geo_verified_at = NULL,
    geo_verified_status = NULL,
    geo_overlap_percent = NULL
WHERE geo_verified_at IS NOT NULL
  AND navio_service_area_id LIKE 'discovered_%';
```

### 2. Edge function: Reduce batch size and time guard

In `supabase/functions/navio-import/index.ts`, change:

- `BATCH_SIZE` from `45` to `25` -- ensures each batch completes within timeout
- Time guard from `48000` to `40000` -- leaves 20s buffer for finalization (cascade, stats, response)

### 3. Edge function: Add error logging in PostGIS calls

Currently if the RPC call to `check_area_best_navio_overlap` returns an error, it logs the message but falls through to the point fallback without context. Add the actual error to the log so debugging is easier.

## Files to Edit

| File | Change |
|------|--------|
| New SQL migration | Fix `ROUND()` cast bug in `check_area_best_navio_overlap`; reset bad verification data |
| `supabase/functions/navio-import/index.ts` | Reduce batch size to 25, lower time guard to 40s |

## Expected Result

After applying:
- Each batch processes ~25 areas and completes within the timeout
- Areas in Drammen will actually match zones 140/141/142 with real overlap percentages
- No more "Failed to fetch" errors -- the function always returns before timeout
- Progress will advance steadily: ~25 areas per click of "Continue Verification"

