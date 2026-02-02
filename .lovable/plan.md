

# Fix: Restructure AI Classification for Proper City → District → Area Hierarchy

## Problems Identified

Based on the staging data analysis, there are **three major classification issues**:

### 1. Districts Listed as Areas
The Navio data shows items like `"Norway Oslo Vester Aker 1"` being classified as:
- **Current**: City=Oslo, District=Vestre Aker, Area=Vester Aker 1
- **Problem**: Vestre Aker IS the district (bydel), and the areas within it (like Ris, Slemdal, Vinderen) aren't being identified

The raw data `"Norway Oslo Holmenkollen"` shows the correct area, but the AI is missing the district-level classification between Oslo and Holmenkollen.

### 2. Duplicate Cities from Spelling Variations
- `Bærum` (correct Norwegian) vs `Barum` (ASCII simplified)
- `Lillestrøm` vs `Lillestrom`
- `Lørenskog` vs `Lorenskog`
- `Göteborg` vs `Gotehburg` (misspelling)

These should be normalized to a single canonical spelling.

### 3. Internal Codes Without Area Expansion
For Trondheim, codes like `NO TRH 1` through `NO TRH 17` are classified as:
- District=Heimdal, Area=Heimdal (duplicate!)

The district is correctly identified from postal codes, but **no actual neighborhood/area names** are extracted. The areas like "Saupstad", "Kolstad", "Flatåsen" (neighborhoods within Heimdal) are never discovered.

---

## Root Cause Analysis

The current approach has a **fundamental flaw**: it only classifies **what Navio gives it**. But Navio returns:
1. Structured names like `"Norway Oslo Holmenkollen"` (3 levels already)
2. Internal codes like `"NO TRH 5"` (only gives city, no granularity)

The AI cannot invent areas that aren't in the input data. When Navio provides an internal code, the AI correctly maps it to a district using postal codes, but then **duplicates the district name as the area** because it has no finer-grained data.

---

## Solution: Three-Phase Hierarchical Classification

### Phase 1: Normalize and Deduplicate Cities

Before classification, apply spelling normalization:

```typescript
const citySpellingNormalizations: Record<string, string> = {
  // Norwegian with/without special characters
  'barum': 'Bærum',
  'baerum': 'Bærum',
  'lillestrom': 'Lillestrøm',
  'lorenskog': 'Lørenskog',
  'tonsberg': 'Tønsberg',
  // Common misspellings
  'gotehburg': 'Göteborg',
  'gotheburg': 'Göteborg',
};
```

### Phase 2: Enhanced District Detection with Hierarchy Awareness

Update the AI prompt to understand the proper Norwegian administrative structure:

```text
Norwegian Administrative Hierarchy:
- CITY (By/Kommune): Oslo, Bergen, Trondheim, Bærum, Asker
- DISTRICT (Bydel): Official city districts
  - Oslo bydeler: Frogner, Grünerløkka, Gamle Oslo, Sagene, St. Hanshaugen, 
    Nordre Aker, Vestre Aker, Ullern, Bjerke, Grorud, Stovner, Alna, 
    Østensjø, Nordstrand, Søndre Nordstrand
  - Bergen bydeler: Arna, Bergenhus, Fana, Fyllingsdalen, Laksevåg, 
    Årstad, Ytrebygda, Åsane
- AREA (Nabolag): Specific neighborhoods within districts
  - Vestre Aker areas: Ris, Slemdal, Vinderen, Holmenkollen, Røa, Bogstad
  - Frogner areas: Bygdøy, Frogner, Majorstuen, Skillebekk, Solli

CRITICAL: When input is "Norway Oslo Holmenkollen":
- Holmenkollen is a NEIGHBORHOOD (area) within Vestre Aker district
- city=Oslo, district=Vestre Aker, area=Holmenkollen
```

### Phase 3: For Internal Codes - Use AI to Expand Area Coverage

When an internal code is detected AND postal data is available, use a specialized prompt:

```text
Given internal logistics zone "NO TRH 5" covering postal codes 7013-7016 in Trondheim:

1. Identify the DISTRICT (bydel/stadsdel): Lerkendal
2. List all NEIGHBORHOODS within this district covered by these postal codes:
   - Nardo (7013)
   - Singsaker (7014)
   - Berg (7015)
   - Persaunet (7016)

Return each as separate area entries within the district.
```

This approach **expands** one internal code into multiple actual neighborhood entries.

---

## Technical Implementation

### File: `supabase/functions/navio-import/index.ts`

#### 1. Add City Spelling Normalization (after line 126)

```typescript
const citySpellingNormalizations: Record<string, string> = {
  // Norwegian ASCII to proper spelling
  'barum': 'Bærum', 'baerum': 'Bærum',
  'lillestrom': 'Lillestrøm', 'lillestroem': 'Lillestrøm',
  'lorenskog': 'Lørenskog', 'loerenskog': 'Lørenskog',
  'tonsberg': 'Tønsberg', 'toensberg': 'Tønsberg',
  'asane': 'Åsane', 'arstad': 'Årstad',
  // Common misspellings
  'gotehburg': 'Göteborg', 'gotheburg': 'Göteborg', 'gotenburg': 'Göteborg',
  // German cities
  'munich': 'München', 'cologne': 'Köln',
};
```

#### 2. Add Norwegian District → Area Reference Data

Include a reference table of known districts and their neighborhoods:

```typescript
const norwegianDistrictAreas: Record<string, Record<string, string[]>> = {
  'Oslo': {
    'Vestre Aker': ['Ris', 'Slemdal', 'Vinderen', 'Holmenkollen', 'Røa', 'Bogstad', 'Holmen'],
    'Frogner': ['Bygdøy', 'Frogner', 'Majorstuen', 'Skillebekk', 'Solli', 'Homansbyen'],
    'Nordre Aker': ['Nydalen', 'Ullevål', 'Korsvoll', 'Tåsen', 'Nordberg', 'Grefsen'],
    'Sagene': ['Torshov', 'Bjølsen', 'Sagene', 'Iladalen'],
    // ... etc for all 15 Oslo bydeler
  },
  'Bergen': {
    'Fana': ['Nesttun', 'Paradis', 'Skjold', 'Rådal'],
    'Åsane': ['Nyborg', 'Tertnes', 'Ulset', 'Eidsvåg'],
    // ... etc
  },
};
```

#### 3. Updated Classification Logic

When classifying an area like `"Norway Oslo Holmenkollen"`:
1. Parse: Country=Norway, City=Oslo, Raw=Holmenkollen
2. Look up Holmenkollen in Oslo area reference → Found in Vestre Aker
3. Output: City=Oslo, District=Vestre Aker, Area=Holmenkollen

When classifying internal code like `"NO TRH 5"`:
1. Parse: Internal code for Trondheim
2. Use postal codes to identify district: Lerkendal
3. Use AI with postal context to list actual neighborhoods
4. Create MULTIPLE area entries (one per neighborhood)

#### 4. Deduplication in saveToStaging

Before inserting, check for existing cities with normalized names:

```typescript
function normalizeForDedup(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9]/g, '');  // Remove non-alphanumeric
}

// When grouping: use normalized key for matching
const cityNormalizedKey = normalizeForDedup(area.city);
```

---

## Expected Results After Fix

### Oslo Structure

| Before | After |
|--------|-------|
| City=Oslo, District=Oslo, Area=Holmenkollen | City=Oslo, District=Vestre Aker, Area=Holmenkollen |
| City=Oslo, District=Vestre Aker, Area=Vestre Aker 1 | City=Oslo, District=Vestre Aker, Area=Ris |
| City=Oslo, District=Vestre Aker, Area=Vinderen-Taasen | City=Oslo, District=Vestre Aker, Area=Vinderen |

### Bærum/Barum Deduplication

| Before | After |
|--------|-------|
| City=Bærum (6 areas) + City=Barum (2 areas) | City=Bærum (8 areas) |

### Trondheim Area Expansion

| Before | After |
|--------|-------|
| District=Heimdal, Area=Heimdal (x4) | District=Heimdal, Areas=[Saupstad, Kolstad, Flatåsen, Hallset] |
| District=Lerkendal, Area=Lerkendal (x4) | District=Lerkendal, Areas=[Nardo, Singsaker, Berg, Persaunet] |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | 1. Add city spelling normalization map<br>2. Add Norwegian district-area reference data<br>3. Update AI prompt with hierarchy rules<br>4. Add area lookup function to map neighborhoods to districts<br>5. Add internal code expansion logic<br>6. Add deduplication in city grouping |

---

## Scalability

This approach scales because:
1. **Reference data** handles known Norwegian cities instantly
2. **AI fallback** handles unknown cities/countries with learned patterns
3. **Postal code expansion** generates granular areas from coarse codes
4. **Spelling normalization** prevents duplicate entries
5. **Hierarchy awareness** ensures correct nesting

