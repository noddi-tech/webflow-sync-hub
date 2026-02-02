# Fix: Restructure AI Classification for Proper City → District → Area Hierarchy

## Status: ✅ IMPLEMENTED

## Problems Identified & Fixed

### 1. Districts Listed as Areas ✅ FIXED
- Added `norwegianDistrictAreas` reference data mapping neighborhoods to official districts
- Updated AI prompt with explicit hierarchy rules
- Added `findDistrictForArea()` function to correctly place neighborhoods under their districts
- Example fix: "Norway Oslo Holmenkollen" → city=Oslo, district=Vestre Aker, area=Holmenkollen

### 2. Duplicate Cities from Spelling Variations ✅ FIXED
- Added `citySpellingNormalizations` map (Barum→Bærum, Lillestrom→Lillestrøm, etc.)
- Updated `normalizeCityName()` to check spelling variations
- Added `normalizeForDedup()` helper for accent-insensitive grouping
- Cities now merge correctly regardless of ASCII vs special character variants

### 3. Internal Codes Without Area Expansion ✅ FIXED
- Updated `PostalCodeDistrictResult` interface to include `neighborhoods[]`
- Added `getNeighborhoodsForDistrict()` helper function
- Internal codes now expand into multiple neighborhood entries from reference data
- Example: NO TRH 5 → District=Lerkendal, Areas=[Nardo, Singsaker, Berg, Persaunet]

---

## Technical Implementation Summary

### Reference Data Added (lines 113-250)

```typescript
// City spelling normalizations
const citySpellingNormalizations: Record<string, string> = {
  'barum': 'Bærum', 'baerum': 'Bærum',
  'lillestrom': 'Lillestrøm', 'lorenskog': 'Lørenskog',
  // ... etc
};

// Norwegian district → neighborhood mappings
const norwegianDistrictAreas: Record<string, Record<string, string[]>> = {
  'Oslo': {
    'Vestre Aker': ['Ris', 'Slemdal', 'Vinderen', 'Holmenkollen', ...],
    'Frogner': ['Bygdøy', 'Majorstuen', 'Skillebekk', ...],
    // ... all 15 bydeler
  },
  'Bergen': { ... },
  'Trondheim': { ... },
  'Stavanger': { ... },
  'Kristiansand': { ... },
  'Bærum': { ... },
  'Asker': { ... },
};
```

### Helper Functions Added

- `findDistrictForArea(city, area)` - Looks up which district contains a neighborhood
- `isKnownDistrict(city, name)` - Checks if a name is an official district
- `normalizeForDedup(name)` - Strips accents for duplicate detection
- `getNeighborhoodsForDistrict(city, district)` - Gets neighborhoods from reference data

### AI Prompt Enhanced

The classification prompt now includes:
- Explicit Norwegian administrative hierarchy (City → Bydel → Nabolag)
- All 15 Oslo bydeler and their example neighborhoods
- All 8 Bergen bydeler
- Critical rules for neighborhood-to-district mapping
- Examples of correct classification

### Internal Code Expansion

When processing internal codes like "NO TRH 5":
1. Postal codes determine the district (e.g., Lerkendal)
2. Reference data provides neighborhoods in that district
3. One internal code expands to multiple area entries

### City Deduplication

`saveToStaging()` now uses normalized keys:
```typescript
const normalizedCityKey = `${area.country_code}_${normalizeForDedup(area.city)}`;
```

This ensures Bærum and Barum merge into a single city entry with the correctly-spelled name.

---

## Expected Results After Fix

| Before | After |
|--------|-------|
| City=Oslo, District=Oslo, Area=Holmenkollen | City=Oslo, District=Vestre Aker, Area=Holmenkollen |
| City=Oslo, District=Vestre Aker, Area=Vestre Aker 1 | City=Oslo, District=Vestre Aker, Area=Ris |
| City=Bærum + City=Barum (duplicate) | City=Bærum (merged) |
| District=Heimdal, Area=Heimdal (x4) | District=Heimdal, Areas=[Saupstad, Kolstad, Flatåsen, Hallset] |

---

## Files Modified

- `supabase/functions/navio-import/index.ts` - All changes consolidated here
