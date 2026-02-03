

# Comprehensive Fix for Navio Import Issues

## Issues Identified

### Issue 1: Two Stockholm Entries (NO and SE)
**Root Cause**: There's a Navio entry `"Stockholm Sweden Bredang"` where the parsing regex `^(\S+)\s+(.+)$` matches "Stockholm" as the city with no country detected, defaulting to Norway (NO). This creates a separate `Stockholm (NO)` entry alongside the legitimate `Stockholm (SE)` entries.

**The problematic data:**
```
name: "Stockholm Sweden Bredang"
parsed: { city: "Stockholm", countryCode: null (defaults to NO), area: "Sweden Bredang" }
```

The correct parse should have detected "Sweden" and set countryCode to "SE".

### Issue 2: "Rådyrvegen" as a City (It's a Street Address)
**Root Cause**: Navio has a test entry: `"Rådyrvegen 49, Porsgrunn (Hurtigruta TEST)"`. The parsing regex sees "Rådyrvegen" as the first word and treats it as a city name.

**The data:**
```
name: "Rådyrvegen 49, Porsgrunn (Hurtigruta TEST)"
parsed: { city: "Rådyrvegen", area: "49, Porsgrunn (Hurtigruta TEST)" }
```

This should be filtered out as test data or properly parsed with Porsgrunn as the city.

### Issue 3: "Norway" as a City
**Root Cause**: Entries like `"Norway Kolbotn"` and `"Norway Ski"` are being parsed incorrectly. The regex `^(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(\S+)\s+(.+)$` requires THREE parts after the country name, but these only have TWO parts (country + area).

**The data:**
```
name: "Norway Kolbotn"
Expected: { countryCode: "NO", city: "Kolbotn", area: null } 
Actual: Falls through to simple match, gets city: "Norway"
```

### Issue 4: Asker & Bærum as Separate Entries with 1 District Each
**Root Cause**: This is actually correct behavior - Asker and Bærum are separate municipalities in Norway. However, the AI is discovering only 1 district for each because they are small municipalities without official "bydeler" (districts). The AI is returning the city name as the single district, which is correct per the instructions.

**Status**: Working as designed. Both municipalities are correctly parsed as separate cities.

### Issue 5: Edge Function Timeout ("Failed to send a request to the edge function")
**Root Cause**: The "finalize" mode was called but the function failed. Looking at the database, there are TWO batches (19 cities each = 38 total entries). The cleanup query in `initializeImport()` is supposed to delete old batches but clearly isn't working properly.

**The duplicate batch issue:**
- Batch `1d40adbd-...`: Created 2026-02-02 20:56
- Batch `56ab6c3c-...`: Created 2026-02-03 08:10

Both batches have 19 cities each, meaning the cleanup `.or("status.eq.pending,status.eq.processing")` only deletes pending/processing entries, but NOT already "completed" entries from previous batches.

---

## Solution

### Fix 1: Enhanced Parsing Logic for Edge Cases

Add pattern matching for:
1. `"Country Area"` format (only 2 parts after country)
2. `"Stockholm Sweden Bredang"` format (city + country + area)
3. Filter out test data containing "TEST" or street addresses

```typescript
function parseNavioName(name: string): ParsedNavioName {
  // NEW: Filter out test data
  if (/test/i.test(name) || /^\d+,/.test(name.split(' ')[1] || '')) {
    return { countryCode: null, city: null, district: null, area: name, isInternalCode: false };
  }

  // NEW: Handle "Country Area" format (e.g., "Norway Kolbotn")
  const countryAreaOnlyMatch = name.match(/^(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(\S+)$/i);
  if (countryAreaOnlyMatch) {
    const countryMap = { 'germany': 'DE', 'norway': 'NO', 'sweden': 'SE', 'canada': 'CA', 'denmark': 'DK', 'finland': 'FI' };
    const rawCity = countryAreaOnlyMatch[2];
    return {
      countryCode: countryMap[countryAreaOnlyMatch[1].toLowerCase()],
      city: normalizeCityName(rawCity),
      district: null,
      area: rawCity, // The area IS the city in this case
      isInternalCode: false,
    };
  }

  // NEW: Handle "City Country Area" format (e.g., "Stockholm Sweden Bredang")
  const cityCountryAreaMatch = name.match(/^(\S+)\s+(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(.+)$/i);
  if (cityCountryAreaMatch) {
    const countryMap = { 'germany': 'DE', 'norway': 'NO', 'sweden': 'SE', 'canada': 'CA', 'denmark': 'DK', 'finland': 'FI' };
    return {
      countryCode: countryMap[cityCountryAreaMatch[2].toLowerCase()],
      city: normalizeCityName(cityCountryAreaMatch[1]),
      district: null,
      area: cityCountryAreaMatch[3],
      isInternalCode: false,
    };
  }

  // ... existing patterns continue ...
}
```

### Fix 2: Add Known City Mapping for Norwegian Areas

Add a mapping for Norwegian areas that are actually cities:

```typescript
const norwegianCityAreas: Record<string, string> = {
  'kolbotn': 'Nordre Follo',
  'ski': 'Nordre Follo',
  // Add more as needed
};
```

### Fix 3: Better Batch Cleanup

Change the cleanup logic to delete ALL old batches, not just pending/processing:

```typescript
// In initializeImport():
// Clear ALL entries from ALL previous batches (keeping only the current one)
await supabase
  .from("navio_import_queue")
  .delete()
  .neq("batch_id", batchId); // Delete everything except current batch

// Also delete any existing entries for current batch (fresh start)
await supabase
  .from("navio_import_queue")
  .delete()
  .eq("batch_id", batchId);
```

### Fix 4: Add Street Address Detection

Skip entries that look like street addresses:

```typescript
function isLikelyStreetAddress(name: string): boolean {
  // Matches patterns like "Rådyrvegen 49" or "Street 123"
  const streetPatterns = [
    /vegen\s+\d+/i,  // Norwegian: "vegen 49"
    /veien\s+\d+/i,  // Norwegian: "veien 49"
    /gata\s+\d+/i,   // Swedish: "gatan 49"
    /gatan\s+\d+/i,
    /straße\s+\d+/i, // German
    /street\s+\d+/i,
    /road\s+\d+/i,
    /ave\s+\d+/i,
    /\d+[,\s]+\w+\s+\(/i, // "49, Porsgrunn ("
  ];
  return streetPatterns.some(pattern => pattern.test(name));
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | 1. Add `countryAreaOnlyMatch` pattern for "Norway Kolbotn" format<br>2. Add `cityCountryAreaMatch` pattern for "Stockholm Sweden Bredang" format<br>3. Add test data filter (skip entries with "TEST")<br>4. Add street address detection<br>5. Fix batch cleanup to delete ALL old batches, not just pending/processing |

---

## Technical Details

### parseNavioName() Changes

The function will be updated with this priority order:

1. **Filter**: Skip test data and street addresses
2. **Pattern 1**: `"Country City Area"` - e.g., "Norway Asker Center"
3. **Pattern 2**: `"Country Area"` - e.g., "Norway Kolbotn" (NEW)
4. **Pattern 3**: `"City Country Area"` - e.g., "Stockholm Sweden Bredang" (NEW)
5. **Pattern 4**: Internal codes - e.g., "NO BRG 6"
6. **Pattern 5**: Simple `"City Area"` - e.g., "Oslo Frogner"

### Batch Cleanup Changes

```typescript
// Before (buggy - only deletes pending/processing):
await supabase
  .from("navio_import_queue")
  .delete()
  .or("status.eq.pending,status.eq.processing");

// After (deletes ALL old batches):
await supabase
  .from("navio_import_queue")
  .delete()
  .neq("batch_id", batchId);
```

---

## Expected Results After Fix

| Issue | Before | After |
|-------|--------|-------|
| Two Stockholms | Stockholm (NO) + Stockholm (SE) | Only Stockholm (SE) |
| Rådyrvegen | Shows as city | Filtered out (test data) |
| Norway as city | Norway (NO) with 28 districts | Kolbotn and Ski parsed as cities in Nordre Follo |
| Asker & Bærum | Separate with 1 district | Same (correct behavior) |
| Edge function timeout | Fails on finalize with 38 entries | Works with 19 entries after cleanup |

---

## Validation Strategy

After deploying the fix:
1. Clear the `navio_import_queue` table
2. Run import and verify:
   - No "Rådyrvegen" entry
   - No "Norway" as a city
   - Only one Stockholm (SE)
   - No duplicate batch entries
   - Import completes successfully

