

# Granular Per-Area Deep Verify with Polygon Overlap

## The Problem

Currently, deep verify only checks if a single geocoded **point** falls inside a Navio delivery zone. That's too crude -- a neighborhood like "Frogner" has actual boundaries, not just a center point. A point might land just outside a polygon edge while 95% of the neighborhood is inside.

You need: **"Does the actual boundary of this AI-discovered area overlap with the Navio delivery zone by at least 90%?"**

And you need this for **all 4,710 AI-discovered areas**, not just a sample.

## The Delivery Logic

```text
Area is verified    -> is_delivery = true for area
Area NOT verified   -> is_delivery = false for area

Any area in district verified -> is_delivery = true for district
No areas in district verified -> is_delivery = false for district

Any district in city verified -> is_delivery = true for city
No districts in city verified -> is_delivery = false for city
```

## Solution Design

### Why batching is necessary

4,710 areas at 1 request/second (Nominatim rate limit) = ~78 minutes. A single edge function times out at 60 seconds. So we need:

1. **Persistent per-area verification status** stored in the database
2. **Batch processing** -- each run verifies ~45 areas (45 seconds of geocoding + overhead)
3. **Progress tracking** -- UI shows "1,200 / 4,710 verified" and a "Continue" button
4. **Automatic cascading** -- after verification, update district and city `is_delivery` flags based on child results

### Step 1: Database migration

Add columns to the `areas` table to track verification:

- `geo_verified_at` (timestamptz, nullable) -- when this area was last verified
- `geo_verified_status` (text, nullable) -- "verified", "mismatched", "not_found", "error"
- `geo_overlap_percent` (numeric, nullable) -- 0-100, the actual overlap percentage
- `geo_verified_point` (geometry, nullable) -- the geocoded center point from Nominatim

This lets us track progress across multiple runs and avoids re-verifying areas that are already done.

### Step 2: Edge function changes (`supabase/functions/navio-import/index.ts`)

Rewrite `coverage_check_deep` to:

1. Query areas WHERE `geo_verified_at IS NULL` and `navio_service_area_id LIKE 'discovered_%'` -- only unverified areas
2. Take the first 45 (sorted by city for locality)
3. For each area:
   a. Call Nominatim with `polygon_geojson=1` to get the actual neighborhood boundary
   b. If polygon returned: use a new PostGIS function to compute overlap % with the Navio delivery zone
   c. If only point returned: fall back to point-in-polygon check (treat as 100% or 0%)
   d. Store results in the area row (`geo_verified_status`, `geo_overlap_percent`, `geo_verified_at`)
4. Apply the 90% threshold: areas with >= 90% overlap are "verified", below are "mismatched"
5. Return progress: `{ verified: X, remaining: Y, total: Z }`

### Step 3: New PostGIS function

Create `check_area_navio_overlap(area_geojson jsonb, navio_zone_id text)` that:

1. Converts the Nominatim GeoJSON polygon to a PostGIS geometry
2. Finds the Navio zone polygon from the `areas` table (the parent zone polygon assigned to this area)
3. Computes `ST_Area(ST_Intersection(area_poly, zone_poly)) / ST_Area(area_poly) * 100`
4. Returns the overlap percentage

Note: Since Navio polygons are stored with swapped coordinates, the function must handle coordinate consistency.

### Step 4: Cascade `is_delivery` flags

After each batch completes, run cascading updates:

```text
For each area with geo_overlap_percent < 90:
  -> SET is_delivery = false

For each district:
  -> SET is_delivery = (any child area has is_delivery = true)

For each city:
  -> SET is_delivery = (any child district has is_delivery = true)
```

This ensures the CMS accurately reflects where you actually deliver.

### Step 5: UI updates

**CoverageHealthCard.tsx:**
- Replace the current "Deep Verify" button with a progress-aware version
- Show: "Verified: 1,200 / 4,710 areas (25%)" with a progress bar
- Button text changes: "Start Deep Verify" -> "Continue Verification (3,510 remaining)" -> "All Verified"
- Show summary stats: X verified, Y mismatched, Z not found

**OperationDetailDialog.tsx:**
- Update deep verify details to show per-area results with overlap percentages
- Show mismatched areas with their actual overlap % (e.g., "Frogner: 42% overlap -- below 90% threshold")
- Include the cascade impact: "Setting is_delivery=false for 23 areas, 2 districts"

## Files to Edit

| File | Change |
|------|--------|
| New migration | Add `geo_verified_at`, `geo_verified_status`, `geo_overlap_percent`, `geo_verified_point` columns to `areas`; create `check_area_navio_overlap` PostGIS function |
| `supabase/functions/navio-import/index.ts` | Rewrite `coverage_check_deep` for batched processing with polygon overlap + cascading |
| `src/components/navio/CoverageHealthCard.tsx` | Add progress bar, batch continuation, summary stats |
| `src/components/navio/OperationDetailDialog.tsx` | Show per-area overlap percentages and cascade impact |

## Expected Result

After running Deep Verify several times (or letting it auto-continue):
- Every AI-discovered area has a verified overlap percentage
- Areas below 90% overlap are automatically set to `is_delivery = false`
- Districts and cities cascade accordingly
- The UI shows exactly which areas passed/failed and by how much
- You can re-run verification at any time (it only processes unverified areas)

