

# Fix: Improve Navio AI Classification Quality

## Problems Identified

Looking at the staging data and raw Navio API responses, I identified three classification issues:

### Issue 1: Bergen Districts Showing Internal Codes ("BRG 6")
**Root cause**: Navio API returns internal logistics codes like `NO BRG 1`, `NO BRG 6` instead of real neighborhood names (Arna, Bergenhus, Fana, etc.). The AI cannot determine that "BRG 6" corresponds to "Fana" or any specific Bergen bydel without additional mapping data.

**Evidence**: `original_name: "NO BRG 6"` - this is an internal Navio logistics zone, not a geographic name.

### Issue 2: Munich vs München Duplicates
**Root cause**: Different AI classification batches used inconsistent naming - one batch returned "Munich" (English), another returned "München" (German), creating duplicate city entries.

### Issue 3: Munich Suburbs as Separate Cities
**Root cause**: The AI incorrectly classified "Unterföhring", "Unterhaching", "Vaterstetten" as separate top-level cities instead of recognizing them as districts/suburbs of Munich. The raw Navio data shows `"Germany Munich Unterföhring"` - the city hierarchy is already provided!

---

## Solution

### Part 1: Parse Existing Hierarchy from Navio Names

The Navio API already provides structured names like:
- `"Germany Munich Unterföhring"` = Country → City → Area
- `"Norway Oslo Grorud"` = Country → City → Area
- `"NO BRG 6"` = Internal code (needs special handling)

**Update the edge function** to first parse these structured names before using AI classification:

```text
Pattern: "{Country} {City} {Area}" or "{CountryCode} {CityCode} {AreaCode}"

Parse:
- "Germany Munich Unterföhring" → city=Munich, district=Munich, area=Unterföhring
- "Norway Oslo Grorud" → city=Oslo, district=Oslo, area=Grorud  
- "NO BRG 6" → Marked as "internal code", requires manual mapping
```

### Part 2: Force Consistent City Naming

Update the AI classification prompt to require:
- Always use **local language** city names (München, not Munich)
- Normalize variations of the same city to a canonical form
- Include explicit examples of preferred naming

### Part 3: Flag Internal Codes for Manual Review

When the Navio area name matches an internal code pattern (like `XX YYY #`), automatically flag it in the staging table for manual review with status `"needs_mapping"`.

---

## Technical Changes

### File: `supabase/functions/navio-import/index.ts`

#### 1. Add pre-parsing of structured Navio names

```typescript
// New function to parse structured Navio names
function parseNavioName(name: string): { 
  countryCode: string | null; 
  city: string | null; 
  area: string; 
  isInternalCode: boolean;
} {
  // Pattern 1: "Country City Area" format (e.g., "Germany Munich Unterföhring")
  const countryMatch = name.match(/^(Germany|Norway|Sweden|Canada)\s+(\S+)\s+(.+)$/i);
  if (countryMatch) {
    const countryMap: Record<string, string> = {
      'germany': 'DE', 'norway': 'NO', 'sweden': 'SE', 'canada': 'CA'
    };
    return {
      countryCode: countryMap[countryMatch[1].toLowerCase()],
      city: countryMatch[2],
      area: countryMatch[3],
      isInternalCode: false,
    };
  }
  
  // Pattern 2: Internal codes like "NO BRG 6", "NO OSL 1"
  const codeMatch = name.match(/^([A-Z]{2})\s+([A-Z]{3})\s+(\d+)$/);
  if (codeMatch) {
    return {
      countryCode: codeMatch[1],
      city: null, // Unknown, needs AI or manual mapping
      area: name,
      isInternalCode: true,
    };
  }
  
  // Pattern 3: "Norway City Area" without proper structure
  const norwayMatch = name.match(/^Norway\s+(\S+)\s+(.+)$/i);
  if (norwayMatch) {
    return {
      countryCode: 'NO',
      city: norwayMatch[1],
      area: norwayMatch[2],
      isInternalCode: false,
    };
  }
  
  // Fallback: Use AI classification
  return { countryCode: null, city: null, area: name, isInternalCode: false };
}
```

#### 2. Update classification prompt for consistency

Add to the AI prompt:
```
IMPORTANT RULES:
1. Use LOCAL LANGUAGE city names (München not Munich, Göteborg not Gothenburg)
2. Areas named like "Germany Munich X" - Munich is the city, X is the area
3. Internal codes like "NO BRG 6" should be flagged - these need manual mapping
4. For German cities, prefer: München, Berlin, Hamburg, Frankfurt, Köln
5. For suburbs around a major city, classify as city=MainCity, district=SuburbName
```

#### 3. Add city name normalization

```typescript
// Normalize city names to consistent local-language versions
const cityNormalizations: Record<string, string> = {
  'munich': 'München',
  'munich': 'München',  
  'cologne': 'Köln',
  'gothenburg': 'Göteborg',
  'copenhagen': 'København',
};
```

#### 4. Flag internal codes in staging

When saving to staging, set `status: "needs_mapping"` for internal code areas and add a metadata field explaining why.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Add `parseNavioName()` function, update AI prompt for consistency, add city normalization, flag internal codes |
| `src/pages/NavioPreview.tsx` | Add visual indicator for "needs_mapping" status |

---

## Expected Results After Fix

| Before | After |
|--------|-------|
| Munich (DE) + München (DE) separate cities | München (DE) single city |
| Unterföhring as separate city | Unterföhring as district of München |
| BRG 6 with no context | BRG 6 flagged as "needs_mapping" with warning |

---

## About "BRG 6" and Internal Codes

The Navio API uses internal logistics zone codes for some Norwegian cities:
- `NO BRG 1-10` = Bergen logistics zones
- `NO KRS 1-9` = Kristiansand logistics zones  
- `NO TNS 1-2` = Tønsberg logistics zones

These do NOT map 1:1 to official city districts (bydeler). Without a mapping table from Navio or manual configuration, the system cannot know that "BRG 3" corresponds to "Årstad" or any other specific bydel.

**Recommendation**: Flag these as "needs_mapping" and allow manual assignment in the preview UI, OR request a mapping table from Navio support.

