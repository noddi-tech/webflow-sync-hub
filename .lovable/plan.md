

# Make Navio Import Country-Agnostic with Dynamic AI Classification

## Problem Statement

The current `navio-import` Edge Function is hardcoded for Norwegian geography:
- AI prompt mentions specific Norwegian cities (Oslo, Bergen, Trondheim)
- District examples are Oslo-specific (Frogner, Grünerløkka)
- System prompt says "You are a Norwegian geography expert"
- Fallback uses "Ukjent" (Norwegian for "Unknown")

This needs to be scalable for any country (Sweden, Denmark, Germany, etc.) while maintaining the three-level hierarchy:
- **Cities** (Byer) - Top level municipalities/cities
- **Districts** (Bydeler) - Intermediate administrative divisions
- **Areas** (Områder) - Specific neighborhoods

## Solution: Two-Phase AI Classification

### Phase 1: Country Detection and Structure Analysis

Before classifying areas, first send the raw area names to AI to:
1. **Detect the country** based on area name patterns
2. **Understand that country's administrative structure**
3. **Map it to our City → District → Area hierarchy**

Example prompt:
```
Analyze these delivery area names and determine:
1. What country are these areas from?
2. What is the administrative hierarchy in that country?
3. How should we map their structure to: City (top level), District (middle), Area (local)?

Areas: ["Skillebekk", "Majorstuen", "Grünerløkka", "Södermalm", "Vasastan"]
```

AI Response:
```json
{
  "detected_country": "Mixed (Norway and Sweden)",
  "countries": {
    "Norway": {
      "hierarchy": "Kommune → Bydel → Område",
      "mapping": {
        "city_level": "Kommune or major city",
        "district_level": "Bydel (official districts)",
        "area_level": "Neighborhood/postal area"
      },
      "examples": {
        "cities": ["Oslo", "Bergen", "Trondheim"],
        "districts": ["Frogner", "Grünerløkka", "Gamle Oslo"]
      }
    },
    "Sweden": {
      "hierarchy": "Kommun → Stadsdel → Område",
      "mapping": {
        "city_level": "Kommun or major city",
        "district_level": "Stadsdel (city districts)",
        "area_level": "Neighborhood"
      },
      "examples": {
        "cities": ["Stockholm", "Göteborg", "Malmö"],
        "districts": ["Södermalm", "Kungsholmen", "Östermalm"]
      }
    }
  }
}
```

### Phase 2: Classify Areas Using Country Context

Use the country context from Phase 1 to classify each area:

```
You are an expert in {country} geography and administrative divisions.

In {country}, the administrative structure is:
- {city_level_description}
- {district_level_description}  
- {area_level_description}

Classify each delivery area into our three-level hierarchy:
1. **City** - {city_level_description}
2. **District** - {district_level_description}
3. **Area** - {area_level_description}

[areas to classify]
```

---

## Implementation Plan

### 1. Add Country Column to Cities Table

Add a `country_code` column to track which country a city belongs to:

```sql
ALTER TABLE cities ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'NO';
```

This allows:
- Filtering by country in the UI
- Country-specific SEO and content
- Future multi-country support

### 2. Update navio-import Edge Function

Modify the AI classification logic to be country-agnostic:

**Step 1: Analyze Areas for Country Detection**
```typescript
// First, sample 20 area names and ask AI to identify countries
const sampleAreas = areaNames.slice(0, 20).map(a => a.name);

const analysisPrompt = `Analyze these delivery area names from a logistics API.

Areas: ${JSON.stringify(sampleAreas)}

Determine:
1. What country/countries are these areas from?
2. For each detected country, describe:
   - The administrative hierarchy (e.g., Kommune → Bydel → Område)
   - What level corresponds to "City" (top municipality/city)
   - What level corresponds to "District" (middle administrative area)
   - What level corresponds to "Area" (local neighborhood)

Return JSON:
{
  "countries": {
    "NO": {
      "name": "Norway",
      "city_description": "Kommune or major city",
      "district_description": "Bydel (official city districts)",
      "area_description": "Specific neighborhood",
      "example_cities": ["Oslo", "Bergen"],
      "example_districts": ["Frogner", "Grünerløkka"]
    }
  }
}`;
```

**Step 2: Use Country Context for Classification**
```typescript
const classificationPrompt = `You are an expert in geography and administrative divisions.

${countryContext}

Given these delivery area names, classify each into:
1. **City** - The top-level city/municipality
2. **District** - The middle-level administrative division
3. **Area** - The specific local neighborhood (usually keep the original name)

Rules:
- Use official district names where they exist
- If district is unknown, use the city name as district
- Preserve the original name as the Area
- Include the country_code for each area

Input areas:
${JSON.stringify(batch)}

Return JSON array:
[
  {"original": "Skillebekk", "navio_id": 123, "country_code": "NO", "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Södermalm", "navio_id": 456, "country_code": "SE", "city": "Stockholm", "district": "Södermalm", "area": "Södermalm"}
]`;
```

**Step 3: Store Country Code**
```typescript
// When creating cities
const { data: newCity } = await supabase
  .from("cities")
  .insert({
    name: classified.city,
    slug: cityKey,
    is_delivery: true,
    navio_city_key: cityKey,
    country_code: classified.country_code || 'NO', // Default to Norway for backward compatibility
  });
```

### 3. Update Fallback Handling

Change fallback from Norwegian-specific to generic:
```typescript
// Before (Norwegian-specific)
city: "Ukjent",
district: "Ukjent",

// After (generic, works for any country)
city: "Unknown",
district: "Unknown",
country_code: "XX", // ISO code for unknown
```

### 4. Add Country Filter to UI (Optional Enhancement)

Add a country selector in the Dashboard when importing:
```typescript
<Select value={selectedCountry} onValueChange={setSelectedCountry}>
  <SelectTrigger>
    <SelectValue placeholder="All Countries" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Countries</SelectItem>
    <SelectItem value="NO">Norway</SelectItem>
    <SelectItem value="SE">Sweden</SelectItem>
    <SelectItem value="DK">Denmark</SelectItem>
  </SelectContent>
</Select>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `country_code` column to `cities` table |
| `supabase/functions/navio-import/index.ts` | Implement two-phase AI classification with country detection |
| `src/integrations/supabase/types.ts` | Auto-updated with new column |

---

## AI Prompt Flow

```text
┌─────────────────────────────────────────────────────────┐
│                    Raw Area Names                        │
│    ["Skillebekk", "Majorstuen", "Södermalm", ...]       │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│          PHASE 1: Country & Structure Analysis           │
│                                                          │
│  "Analyze these areas and determine what countries       │
│   they belong to, and how each country structures        │
│   its administrative divisions."                         │
│                                                          │
│  Output: Country context with hierarchy descriptions     │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│          PHASE 2: Classification with Context            │
│                                                          │
│  "Using this country context, classify each area         │
│   into City → District → Area with country_code"         │
│                                                          │
│  Output: Classified areas with country codes             │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              Database: Cities with Countries             │
│                                                          │
│  Oslo (NO), Stockholm (SE), Copenhagen (DK), etc.       │
└─────────────────────────────────────────────────────────┘
```

---

## Example: Multi-Country Classification

**Input areas from Navio:**
```json
["Skillebekk", "Majorstuen", "Södermalm", "Vasastan", "Nørrebro", "Vesterbro"]
```

**Phase 1 AI Response:**
```json
{
  "countries": {
    "NO": {
      "name": "Norway", 
      "areas_detected": ["Skillebekk", "Majorstuen"],
      "city_level": "Kommune (municipality)",
      "district_level": "Bydel (official city districts - Oslo has 15)"
    },
    "SE": {
      "name": "Sweden",
      "areas_detected": ["Södermalm", "Vasastan"],
      "city_level": "Kommun (municipality)", 
      "district_level": "Stadsdel (city district - Stockholm has ~26)"
    },
    "DK": {
      "name": "Denmark",
      "areas_detected": ["Nørrebro", "Vesterbro"],
      "city_level": "Kommune (municipality)",
      "district_level": "Bydel (city district - Copenhagen has 10)"
    }
  }
}
```

**Phase 2 Classification:**
```json
[
  {"original": "Skillebekk", "navio_id": 1, "country_code": "NO", "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Majorstuen", "navio_id": 2, "country_code": "NO", "city": "Oslo", "district": "Frogner", "area": "Majorstuen"},
  {"original": "Södermalm", "navio_id": 3, "country_code": "SE", "city": "Stockholm", "district": "Södermalm", "area": "Södermalm"},
  {"original": "Vasastan", "navio_id": 4, "country_code": "SE", "city": "Stockholm", "district": "Norrmalm", "area": "Vasastan"},
  {"original": "Nørrebro", "navio_id": 5, "country_code": "DK", "city": "København", "district": "Nørrebro", "area": "Nørrebro"},
  {"original": "Vesterbro", "navio_id": 6, "country_code": "DK", "city": "København", "district": "Vesterbro-Kongens Enghave", "area": "Vesterbro"}
]
```

---

## Technical Considerations

### Caching Country Analysis
- Store the country analysis result for the session
- Only re-analyze if area names change significantly
- This reduces AI API calls

### Handling Unknown Countries
- Default to generic classification if country cannot be determined
- Log unknown patterns for manual review
- Fallback: Use original name as area, parent as both city and district

### ISO Country Codes
Use standard ISO 3166-1 alpha-2 codes:
- NO = Norway
- SE = Sweden  
- DK = Denmark
- FI = Finland
- DE = Germany
- etc.

---

## Expected Results

After this change:
1. **Navio import works for any country** - AI detects and adapts automatically
2. **Cities table includes country_code** - Enables filtering and country-specific features
3. **No hardcoded Norwegian references** - Fully dynamic classification
4. **Backward compatible** - Existing Norwegian data gets `country_code: 'NO'`

