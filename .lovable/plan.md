
# Comprehensive AI-Powered District and Neighborhood Discovery

## Current Issues Identified from Data

1. **Districts Combined**: "Årstad and Fana" should be two separate districts
2. **Missing Districts**: Oslo has 14 districts, should have 15. Bergen has 7, should have 8.
3. **Too Few Areas**: Oslo only has 26 areas across 14 districts (~2 per district), but each district should have 10-30 neighborhoods
4. **Unknown City**: 114 areas classified under "Unknown" city
5. **München**: 44 areas but only 1 generic district

## Solution: Three-Phase AI Discovery System

### Phase 1: Identify Cities from Delivery Areas
Use Navio data to get list of cities we deliver to (this works well already).

### Phase 2: Discover ALL Districts Within Each City
For each city, use AI to **actively discover** all official districts - not just what Navio mentions.

Native language prompts:
- Norwegian: "List alle bydeler i Oslo" 
- Swedish: "Lista alla stadsdelar i Stockholm"
- German: "Liste alle Stadtbezirke in München"

### Phase 3: Discover ALL Neighborhoods Within Each District
For each district, use AI to **actively discover** all neighborhoods using native search terms.

Native language prompts:
- Norwegian: "List alle nabolag, strøk og områder i Vestre Aker bydel i Oslo"
- Swedish: "Lista alla grannskap och kvarter i Södermalm stadsdel i Stockholm"
- German: "Liste alle Viertel und Nachbarschaften im Stadtbezirk Schwabing-Freimann in München"

---

## Technical Implementation

### File: `supabase/functions/navio-import/index.ts`

#### 1. Add Native Terminology Reference

```typescript
const neighborhoodTerminology: Record<string, {
  languageName: string;
  district: { singular: string; plural: string; };
  neighborhood: { singular: string; plural: string; searchTerms: string[] };
}> = {
  'NO': {
    languageName: 'Norwegian',
    district: { singular: 'bydel', plural: 'bydeler' },
    neighborhood: { singular: 'nabolag', plural: 'nabolag', searchTerms: ['nabolag', 'strøk', 'områder', 'grend'] }
  },
  'SE': {
    languageName: 'Swedish',  
    district: { singular: 'stadsdel', plural: 'stadsdelar' },
    neighborhood: { singular: 'grannskap', plural: 'grannskap', searchTerms: ['grannskap', 'kvarter', 'områden'] }
  },
  'DE': {
    languageName: 'German',
    district: { singular: 'Stadtbezirk', plural: 'Stadtbezirke' },
    neighborhood: { singular: 'Nachbarschaft', plural: 'Nachbarschaften', searchTerms: ['Nachbarschaft', 'Viertel', 'Gegend', 'Kiez'] }
  },
  'DK': {
    languageName: 'Danish',
    district: { singular: 'bydel', plural: 'bydele' },
    neighborhood: { singular: 'kvarter', plural: 'kvarterer', searchTerms: ['kvarter', 'område', 'nabolag'] }
  },
  'FI': {
    languageName: 'Finnish',
    district: { singular: 'kaupunginosa', plural: 'kaupunginosat' },
    neighborhood: { singular: 'naapurusto', plural: 'naapurustot', searchTerms: ['naapurusto', 'alue', 'lähiö'] }
  },
  'CA': {
    languageName: 'English',
    district: { singular: 'district', plural: 'districts' },
    neighborhood: { singular: 'neighborhood', plural: 'neighborhoods', searchTerms: ['neighborhood', 'area', 'community'] }
  }
};
```

#### 2. New Function: `discoverDistrictsForCity()`

```typescript
async function discoverDistrictsForCity(
  cityName: string,
  countryCode: string,
  apiKey: string,
  openAIKey?: string  // Optional OpenAI for cross-validation
): Promise<string[]> {
  const terms = neighborhoodTerminology[countryCode] || neighborhoodTerminology['NO'];
  
  const prompt = `You are an expert in ${terms.languageName} geography and administrative divisions.

List ALL official administrative districts (${terms.district.plural} / ${terms.district.singular}) for the city of ${cityName}.

IMPORTANT RULES:
1. Return ONLY officially recognized administrative districts
2. Use the local ${terms.languageName} names with proper characters (æ, ø, å, ä, ö, ü, etc.)
3. Do NOT include neighborhoods - only the district/bydel level
4. For cities without official districts, return the city name as the single district

Example for Oslo: Frogner, Grünerløkka, Gamle Oslo, Sagene, St. Hanshaugen, Nordre Aker, Vestre Aker, Ullern, Bjerke, Grorud, Stovner, Alna, Østensjø, Nordstrand, Søndre Nordstrand

Return ONLY a valid JSON array of district names:
["District1", "District2", "District3"]`;

  // Call AI (Gemini or OpenAI)
  const response = await callAI(prompt, apiKey, openAIKey);
  return parseJsonArray(response);
}
```

#### 3. New Function: `discoverNeighborhoodsForDistrict()`

```typescript
async function discoverNeighborhoodsForDistrict(
  cityName: string,
  districtName: string,
  countryCode: string,
  apiKey: string,
  openAIKey?: string
): Promise<string[]> {
  const terms = neighborhoodTerminology[countryCode] || neighborhoodTerminology['NO'];
  
  const prompt = `You are an expert in ${terms.languageName} geography.

List ALL neighborhoods, areas, and localities (${terms.neighborhood.searchTerms.join(' / ')}) within the ${districtName} ${terms.district.singular} in ${cityName}.

BE COMPREHENSIVE - search for:
- ${terms.neighborhood.searchTerms.map(t => `"${t}"`).join(', ')}
- Residential areas with established names
- Well-known localities and places
- Named streets and squares that define areas
- Both popular and lesser-known neighborhoods

IMPORTANT:
1. Use local ${terms.languageName} spelling with proper characters
2. Include 15-30 neighborhoods per district (large districts may have more)
3. Do NOT include sub-neighborhoods or street addresses
4. Do NOT repeat the district name as a neighborhood unless it's also a distinct area

Return ONLY a valid JSON array of neighborhood names:
["Neighborhood1", "Neighborhood2", "Neighborhood3"]`;

  const response = await callAI(prompt, apiKey, openAIKey);
  return parseJsonArray(response);
}
```

#### 4. New Function: Multi-Model AI Caller

```typescript
async function callAI(
  prompt: string, 
  lovableKey: string, 
  openAIKey?: string
): Promise<string> {
  // Try Gemini first (faster, included)
  const geminiResponse = await callGemini(prompt, lovableKey);
  
  if (!openAIKey) return geminiResponse;
  
  // If OpenAI key provided, use it for cross-validation on important queries
  const openAIResponse = await callOpenAI(prompt, openAIKey);
  
  // Merge results - combine unique items from both
  return mergeAIResponses(geminiResponse, openAIResponse);
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a geography expert. Return only valid JSON arrays." },
        { role: "user", content: prompt },
      ],
    }),
  });
  // Parse and return
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a geography expert. Return only valid JSON arrays." },
        { role: "user", content: prompt },
      ],
    }),
  });
  // Parse and return
}
```

#### 5. Refactored Main Classification Flow

```text
STEP 1: Fetch Navio delivery areas
        → Extract unique cities from area names
        → Identify country codes

STEP 2: For each unique city:
        └─→ Call discoverDistrictsForCity()
            └─→ Get complete list of official districts
            └─→ Not limited to what Navio mentions!

STEP 3: For each discovered district:
        └─→ Call discoverNeighborhoodsForDistrict()
            └─→ Get 15-30 neighborhoods per district
            └─→ Uses native language search terms

STEP 4: Match Navio data to discovered hierarchy:
        └─→ "NO BRG 6" → Map postal codes to districts
        └─→ "Norway Oslo Holmenkollen" → Find in discovered data
        └─→ Flag discovered items not in Navio as "discovered"

STEP 5: Save to staging:
        └─→ All discovered districts (not just Navio-provided)
        └─→ All discovered neighborhoods
        └─→ Mark items with source: "navio" or "discovered"
```

---

## Database Schema Update

Add a `source` column to track where data came from:

```sql
ALTER TABLE navio_staging_areas ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'navio';
-- Values: 'navio' (from API), 'discovered' (AI-discovered), 'expanded' (from internal code expansion)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | 1. Add `neighborhoodTerminology` reference<br>2. Add `discoverDistrictsForCity()` function<br>3. Add `discoverNeighborhoodsForDistrict()` function<br>4. Add multi-model AI caller (Gemini + OpenAI)<br>5. Refactor main flow to use discovery<br>6. Update staging save to include source |

---

## Expected Results

### Before (Current State)

| City | Districts | Total Areas |
|------|-----------|-------------|
| Oslo | 14 | 26 |
| Bergen | 7 | 60 |
| Trondheim | 4 | 31 |
| München | 1 | 44 |

### After (With Discovery)

| City | Districts | Total Areas |
|------|-----------|-------------|
| Oslo | 15 | 200-300 |
| Bergen | 8 | 80-120 |
| Trondheim | 4 | 60-80 |
| München | 25 | 200-300 |

### Oslo Example (Vestre Aker bydel)

```
Oslo
└── Vestre Aker (bydel)
    ├── Holmenkollen ✓ (from Navio)
    ├── Ris ● (AI-discovered)
    ├── Slemdal ● (AI-discovered)
    ├── Vinderen ● (AI-discovered)
    ├── Røa ● (AI-discovered)
    ├── Sørkedalen ● (AI-discovered)
    ├── Smestad ● (AI-discovered)
    ├── Voksen ● (AI-discovered)
    ├── Hovseter ● (AI-discovered)
    ├── Holmen ● (AI-discovered)
    ├── Voksenlia ● (AI-discovered)
    ├── Voksenkollen ● (AI-discovered)
    ├── Bogstad ● (AI-discovered)
    ├── Huseby ● (AI-discovered)
    ├── Montebello ● (AI-discovered)
    ├── Ullernåsen ● (AI-discovered)
    ├── Frognerseteren ● (AI-discovered)
    ├── Besserud ● (AI-discovered)
    ├── Midtstuen ● (AI-discovered)
    ├── Grini ● (AI-discovered)
    └── Husebyskogen ● (AI-discovered)
```

---

## OpenAI Integration

To add OpenAI support:

1. Add `OPENAI_API_KEY` as a Supabase secret
2. The system will use **both** Gemini and GPT-4o-mini for discovery
3. Results are merged and deduplicated for comprehensive coverage
4. Gemini remains the primary model (faster, included in Lovable)
5. OpenAI provides cross-validation and fills gaps

---

## Key Improvements

1. **Active Discovery**: AI proactively finds ALL districts and neighborhoods, not just what Navio provides
2. **Native Language Search**: Uses "nabolag", "bydeler", "Nachbarschaft" etc. for comprehensive results
3. **Multi-Model Support**: Gemini + OpenAI for better coverage
4. **Source Tracking**: Know what came from Navio vs AI discovery
5. **Scalable**: Adding new countries only requires terminology mapping
6. **Fix Combined Districts**: "Årstad and Fana" will be split into separate districts
