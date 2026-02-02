

# Navio API Integration for Geographic Data with AI Classification

## Overview

This plan integrates the Navio API (`/v1/service-areas/for-landing-pages/`) to fetch delivery areas and uses AI (via Lovable AI's supported models) to intelligently classify these areas into the app's hierarchy of Cities, Districts, and Areas.

## Current Architecture Understanding

The app has a three-level geographic hierarchy:
- **Cities** - Top level (e.g., Oslo, Bergen)
- **Districts** - Belong to a city (e.g., Frogner in Oslo)
- **Areas** - Belong to a district (e.g., Skillebekk in Frogner)

Data flows:
1. Manual entry via UI forms
2. Import from Webflow CMS
3. **NEW: Import from Navio API with AI classification**

---

## Implementation Plan

### Phase 1: Store Navio API Token as Secret

Since you've provided the API token (`cab563f8f1adb36c0665f30739ad5d60de4c1f002296a074463316ca84535259`), we'll store it as a backend secret.

**Action:** Add secret `NAVIO_API_TOKEN` using the Lovable Cloud secrets mechanism.

---

### Phase 2: Create Edge Function `navio-import`

**File:** `supabase/functions/navio-import/index.ts`

This edge function will:

1. **Fetch Navio Service Areas**
   - Call `GET https://api.noddi.co/v1/service-areas/for-landing-pages/`
   - Header: `Authorization: Token {NAVIO_API_TOKEN}`
   - Parse the response to extract area names and geographic data

2. **Use AI to Classify Areas**
   - Send area names to Lovable AI (using `google/gemini-2.5-flash` for speed/cost efficiency)
   - Prompt the AI to classify each area into City → District → Area hierarchy
   - AI will use Norwegian geographic knowledge to determine proper groupings

3. **Create/Update Database Records**
   - Insert cities that don't exist
   - Insert districts linked to cities
   - Insert areas linked to districts
   - Set `is_delivery: true` for all imported areas (since they're from Navio delivery zones)
   - Track import source with a `navio_service_area_id` field

4. **Progress Logging**
   - Use the existing `sync_logs` table for progress tracking
   - Report progress using batch_id pattern (same as Webflow import)

**Edge Function Structure:**

```typescript
// Pseudocode structure
Deno.serve(async (req) => {
  // 1. Auth check (admin required)
  // 2. Parse batch_id from request
  // 3. Fetch Navio API
  const navioData = await fetch("https://api.noddi.co/v1/service-areas/for-landing-pages/", {
    headers: { Authorization: `Token ${NAVIO_API_TOKEN}` }
  });
  
  // 4. Log initial progress
  await logSync(supabase, "navio", "progress", "in_progress", null, "Starting...", batchId, 0, areas.length);
  
  // 5. Batch areas and send to AI for classification
  const classificationPrompt = `
    You are a Norwegian geography expert. Classify these delivery area names into:
    - City (kommune/by level)
    - District (bydel/område level) 
    - Area (specific neighborhood)
    
    Return JSON array with structure:
    [{ "original_name": "...", "city": "...", "district": "...", "area": "..." }]
    
    Areas: ${JSON.stringify(areaNames)}
  `;
  
  // 6. Process AI response and create/update records
  // 7. Log completion
});
```

---

### Phase 3: Add Database Tracking Columns

**Migration:** Add columns to track Navio source

```sql
-- Add navio tracking to areas table
ALTER TABLE areas ADD COLUMN IF NOT EXISTS navio_service_area_id text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS navio_imported_at timestamptz;

-- Add navio tracking to districts table  
ALTER TABLE districts ADD COLUMN IF NOT EXISTS navio_district_key text;

-- Add navio tracking to cities table
ALTER TABLE cities ADD COLUMN IF NOT EXISTS navio_city_key text;
```

This allows:
- Detecting duplicates on re-import
- Tracking which records came from Navio
- Preserving the relationship between app records and Navio data

---

### Phase 4: Update Settings UI

**File:** `src/pages/Settings.tsx`

Add a new card for Navio API configuration (even though the token is stored as a secret, we'll show status):

```typescript
// Add to SETTING_KEYS or create separate Navio section
{ key: "navio_api_enabled", label: "Navio API Enabled", group: "navio" }
```

Show:
- Status indicator (configured/not configured based on secret presence)
- Last import timestamp
- Count of areas imported from Navio

---

### Phase 5: Add Navio Import to Dashboard

**File:** `src/pages/Dashboard.tsx`

Add a new card similar to "Import from Webflow":

```typescript
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <MapPin className="h-5 w-5" />
      Import from Navio
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground mb-4">
      Fetch delivery areas from Navio and use AI to organize them into Cities, Districts, and Areas.
    </p>
    <Button onClick={() => navioImportMutation.mutate()}>
      <Download className="mr-2 h-4 w-4" />
      Import Delivery Areas
    </Button>
  </CardContent>
</Card>
```

The import will:
1. Open the same `SyncProgressDialog` component
2. Show AI classification progress
3. Report created/updated counts on completion

---

### Phase 6: AI Classification Logic

**AI Model:** `google/gemini-2.5-flash` (fast, cost-effective, good for structured output)

**Classification Strategy:**

1. **Batch Processing:** Send 20-50 areas at a time to AI
2. **Structured Output:** Request JSON format for easy parsing
3. **Norwegian Context:** Provide context about Norwegian geography in the prompt
4. **Fallback Logic:** If AI can't classify, create as standalone area under "Ukjent" district

**AI Prompt Template:**

```
You are an expert in Norwegian geography and administrative divisions.

Given these delivery area names from a service provider, classify each into:
1. **City** (kommune or major city - e.g., Oslo, Bergen, Trondheim)
2. **District** (bydel, administrative area, or neighborhood group)
3. **Area** (specific neighborhood or postal area)

Rules:
- For Oslo, use official bydeler (Frogner, Grünerløkka, etc.)
- For other cities, group logically by geography
- If unsure of district, use the city name as district
- Preserve the original name as the Area name

Input areas:
${JSON.stringify(areaNames)}

Return ONLY valid JSON array:
[
  {"original": "Skillebekk", "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Majorstuen", "city": "Oslo", "district": "Frogner", "area": "Majorstuen"},
  ...
]
```

---

### Phase 7: Update Supabase Config

**File:** `supabase/config.toml`

Add function configuration:

```toml
[functions.navio-import]
verify_jwt = false
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/navio-import/index.ts` | Create | Edge function to fetch Navio data and classify with AI |
| `supabase/config.toml` | Modify | Add navio-import function config |
| Database Migration | Create | Add navio tracking columns |
| `src/pages/Dashboard.tsx` | Modify | Add "Import from Navio" card |
| `src/pages/Settings.tsx` | Modify | Add Navio API status section |
| `src/integrations/supabase/types.ts` | Auto-update | Will reflect new columns |

---

## Data Flow Diagram

```text
                    ┌─────────────────┐
                    │  Navio API      │
                    │  /v1/service-   │
                    │  areas/for-     │
                    │  landing-pages/ │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ navio-import    │
                    │ Edge Function   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ Raw Area │   │ Raw Area │   │ Raw Area │
       │ Names    │   │ Names    │   │ Names    │
       └──────────┘   └──────────┘   └──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Lovable AI     │
                    │  (Gemini 2.5    │
                    │   Flash)        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Classified      │
                    │ Hierarchy:      │
                    │ City→District   │
                    │ →Area           │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Cities  │  │ Districts│  │  Areas   │
        │  Table   │  │  Table   │  │  Table   │
        └──────────┘  └──────────┘  └──────────┘
```

---

## Expected API Response Structure

Based on similar delivery APIs, the Navio endpoint likely returns something like:

```json
{
  "results": [
    {
      "id": 123,
      "name": "Skillebekk",
      "display_name": "Skillebekk, Oslo",
      "is_active": true,
      "coordinates": { ... }
    },
    ...
  ]
}
```

The edge function will handle the actual response structure once we can see it.

---

## Technical Considerations

### Rate Limiting
- Navio API: Unknown limits - implement conservative delays
- Lovable AI: Batch requests to minimize API calls

### Error Handling
- If Navio API fails: Log error and abort
- If AI classification fails: Use fallback classification (area name as-is, "Ukjent" district)
- If database insert fails: Log and continue with next record

### Deduplication
- Match by `navio_service_area_id` for areas
- Match by `slug` + `city_id` for districts
- Match by `slug` for cities
- Update existing records rather than creating duplicates

---

## Secret Required

Before implementation, we need to add the Navio API token as a secret:

**Secret Name:** `NAVIO_API_TOKEN`
**Value:** `cab563f8f1adb36c0665f30739ad5d60de4c1f002296a074463316ca84535259`

---

## Testing Plan

1. Call Navio API directly to verify response structure
2. Test AI classification with sample area names
3. Run full import on test data
4. Verify City → District → Area hierarchy in database
5. Test re-import to verify deduplication works

