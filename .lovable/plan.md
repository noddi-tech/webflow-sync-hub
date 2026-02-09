

# Clickable Operation Details + Real Spatial Validation

## Two Problems to Solve

### Problem 1: Operation History lacks detail
Clicking a Coverage Check entry in "Recent Operations" does nothing. You see a one-line summary but no explanation of WHY 105 areas should be deactivated, which zones were removed, or what cities are affected.

### Problem 2: No way to verify AI-discovered areas are real
The current spatial check is meaningless: every area inherits the exact same polygon as its parent Navio zone, so the center point is always inside the polygon by definition. There are only 188 unique center points across 4,898 areas.

**What we actually need**: geocode each AI-discovered area name independently (e.g., "is Grünerløkka actually inside Oslo's delivery zone?") and check if the resulting coordinates fall within the assigned Navio polygon.

---

## Solution

### Part 1: Clickable Operation Detail Dialog

Add a detail dialog that opens when clicking any operation row in Recent Operations.

**What it shows for Coverage Check:**
- Health status badge with explanation
- Orphaned areas section: lists removed Navio zone names, the affected production areas per zone, and WHY they should be deactivated ("Navio zone `Norway Oslo Bygdøy` is no longer active in the API")
- City breakdown table (same as in the Coverage Health Card)
- Navio linkage summary
- Deactivate button (if orphans exist) directly in the dialog

**What it shows for other operations (AI Import, Geo Sync, etc.):**
- All stored JSON details rendered as a readable summary
- Key metrics highlighted
- Error message (if failed)

### Part 2: Geocoding Validation in Coverage Check

Add a new validation step to the coverage check that:

1. Takes a sample of AI-discovered areas (e.g., 5 per city to stay within API limits)
2. Geocodes each area name using Nominatim (free, no API key needed): `"Grünerløkka, Oslo, Norway"`
3. Checks if the returned coordinates fall within the assigned Navio polygon using PostGIS `ST_Within`
4. Reports mismatches: "Grünerløkka geocodes to (59.92, 10.76) which is OUTSIDE its assigned zone"

This creates a new section in the coverage result: **"Location Verification"** showing validated vs mismatched areas.

---

## Technical Changes

### New File: `src/components/navio/OperationDetailDialog.tsx`

A dialog component that:
- Receives an `OperationLogEntry` and renders a detailed view
- For `coverage_check` operations: parses the stored JSON details to show orphaned zones with full context (zone name, city, area count, reason for deactivation)
- For `deactivate_orphans`: shows what was deactivated and cascading district changes
- For other operations: renders details as a formatted key-value list
- Includes action buttons where relevant (e.g., "Deactivate" for coverage checks with orphans)

### Modified: `src/components/navio/OperationHistoryTable.tsx`

- Make each operation row clickable (add cursor-pointer, hover state)
- On click, open `OperationDetailDialog` with the log entry
- Add a state variable for the selected log entry

### Modified: `supabase/functions/navio-import/index.ts`

In the `coverage_check` mode, add geocoding validation:

1. After building the city breakdown, select up to 5 AI-discovered areas per city (max ~90 total across 18 cities)
2. For each, call Nominatim: `https://nominatim.openstreetmap.org/search?q={areaName},{cityName},{country}&format=json&limit=1`
3. Rate-limit to 1 request per second (Nominatim policy)
4. For each successful geocode, run a PostGIS check: does the point fall within the assigned Navio polygon?
5. Add results to the response as `geocodeValidation`:

```typescript
geocodeValidation: {
  checked: number;        // e.g., 72
  verified: number;       // geocoded + falls within zone
  mismatched: number;     // geocoded but outside zone
  notFound: number;       // Nominatim returned no results
  mismatches: Array<{
    areaName: string;
    city: string;
    geocodedLat: number;
    geocodedLon: number;
    assignedZone: string;
  }>;
}
```

**Important**: This adds ~90 seconds to the coverage check (90 areas at 1/sec). To keep the current check fast, this will be a separate optional mode: `coverage_check_deep` that the user can trigger via a "Deep Verify" button.

### Modified: `src/components/navio/CoverageHealthCard.tsx`

- Store more detail in the operation log `details` JSON: include removed zone names (not just IDs), affected city names
- Add a "Deep Verify" button that runs geocoding validation
- Show geocode results section when available

### Modified: Operation Log Details Storage

Enrich the `details` JSON saved to `navio_operation_log` for coverage checks to include:
- `removedZoneNames`: array of zone display names that were removed
- `orphanedAreasByZone`: grouped by zone name for readable display
- `geocodeValidation` results (when deep check is run)

---

## Files to Create/Edit

| File | Change |
|------|--------|
| `src/components/navio/OperationDetailDialog.tsx` | NEW -- detail dialog for operation log entries |
| `src/components/navio/OperationHistoryTable.tsx` | Make rows clickable, open detail dialog |
| `supabase/functions/navio-import/index.ts` | Enrich coverage_check details, add `coverage_check_deep` mode with Nominatim geocoding |
| `src/components/navio/CoverageHealthCard.tsx` | Add "Deep Verify" button, show geocode results |

## Edge Cases Handled

- Nominatim rate limiting: 1 req/sec with retry on 429
- Nominatim returns wrong location: compare country code to filter obviously wrong results
- Edge function timeout: limit to 5 areas per city, abort if approaching 60s
- Coordinate order: Navio GeoJSON uses [lat, lon] format -- geocoded coordinates must be stored in the same order for PostGIS comparison
