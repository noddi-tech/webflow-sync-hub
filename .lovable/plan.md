

# Scalable AI-Powered District Code Mapping

## Current Problem

The Navio API returns internal logistics zone codes like `NO BRG 6` instead of geographic names. Currently:
- **Area name saved**: `BRG 6` (meaningless to users)
- **District**: `Bergen` (correct city, but no subdivision)
- **Missing**: Real bydel names like Fana, Årstad, Åsane

## Solution: Use Postal Code Data for AI Context

The Navio API already provides **postal_code_cities** data for each service area:
```json
{
  "id": 123,
  "name": "NO BRG 6",
  "postal_code_cities": [
    {"postal_code": "5072", "city": "Bergen"},
    {"postal_code": "5073", "city": "Bergen"},
    {"postal_code": "5225", "city": "Nesttun"}
  ]
}
```

This postal code data gives the AI rich context to determine the actual geographic area. Norwegian postal codes map to specific districts:
- 5072-5073 = Fana area
- 5225 Nesttun = Also Fana bydel

**The AI can analyze these postal codes to determine the real district name!**

---

## Technical Implementation

### 1. Expand NavioServiceArea Interface

```typescript
interface NavioServiceArea {
  id: number;
  name: string;
  display_name?: string;
  is_active?: boolean;
  postal_code_cities?: Array<{ postal_code: string; city: string }>;
  geofence_geojson?: object; // Could also help with geo-based mapping
  service_department_names?: string[];
}
```

### 2. Enhanced AI Classification Prompt

When an internal code is detected, send the postal code data to the AI for intelligent mapping:

```typescript
const internalCodePrompt = `You are an expert in Norwegian administrative geography.

Given this internal logistics zone and its postal code data, determine the REAL district name (bydel):

Zone: "${area.name}"
City: "${identifiedCity}"
Postal codes and areas:
${JSON.stringify(area.postal_code_cities)}

Norwegian postal code patterns:
- Bergen (5xxx): 5003-5015=Bergenhus, 5031-5043=Laksevåg, 5072-5089=Fana, 5130-5148=Åsane
- Oslo (0xxx): 0150-0180=Frogner, 0182-0192=Gamle Oslo, 0350-0380=Sagene
- Kristiansand (46xx): Different neighborhoods

Based on the postal codes, what is the most likely official bydel/district name?
Return JSON: {"district": "Fana", "confidence": "high", "reasoning": "Postal codes 5072-5073 are in Fana bydel"}`;
```

### 3. Two-Pass Classification

```text
Pass 1: Pre-parse all areas
  ├─ Structured names (Germany Munich X) → Direct mapping
  ├─ Internal codes (NO BRG 6) → Flag for enhanced AI processing
  └─ Unknown → Standard AI classification

Pass 2: Enhanced AI for internal codes
  └─ Send postal_code_cities data to AI
  └─ AI determines real district from postal codes
  └─ High confidence → Auto-map
  └─ Low confidence → Flag as needs_mapping
```

### 4. Postal Code Reference Data (Optional Enhancement)

For even better accuracy, add a reference table of Norwegian postal code → bydel mappings:

```typescript
const norwegianPostalDistricts: Record<string, string> = {
  // Bergen bydeler by postal code range
  '5003': 'Bergenhus', '5004': 'Bergenhus', '5005': 'Bergenhus',
  '5031': 'Laksevåg', '5032': 'Laksevåg',
  '5072': 'Fana', '5073': 'Fana', '5081': 'Fana',
  '5130': 'Åsane', '5131': 'Åsane',
  '5200': 'Ytrebygda', '5201': 'Ytrebygda',
  // Oslo bydeler
  '0150': 'Frogner', '0151': 'Frogner', '0152': 'Frogner',
  '0182': 'Gamle Oslo', '0183': 'Gamle Oslo',
  '0350': 'Sagene', '0351': 'Sagene',
  // etc...
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | 1. Expand interface to include postal_code_cities<br>2. Add enhanced AI prompt for internal codes<br>3. Add postal code reference data for common Norwegian areas<br>4. Two-pass classification logic |

---

## Enhanced Classification Flow

```text
Fetch from Navio API
        │
        ▼
┌───────────────────┐
│ Parse area names  │
└───────────────────┘
        │
        ├──── Structured (Germany Munich X)
        │         → Direct: city=München, district=X
        │
        ├──── Internal Code (NO BRG 6)
        │         │
        │         ▼
        │    ┌──────────────────────────┐
        │    │ Has postal_code_cities?  │
        │    └──────────────────────────┘
        │         │
        │    Yes  │  No
        │         │   └─→ Flag needs_mapping
        │         ▼
        │    ┌──────────────────────────┐
        │    │ Enhanced AI with postal  │
        │    │ code context            │
        │    └──────────────────────────┘
        │         │
        │         ├─ High confidence → Auto-map to district
        │         └─ Low confidence → Flag needs_mapping
        │
        └──── Unknown
                  → Standard AI classification
                  
        │
        ▼
   Save to staging
```

---

## Expected Results

| Before | After |
|--------|-------|
| `BRG 6` under Bergen | `Fana` (bydel) under Bergen |
| `BRG 3` under Bergen | `Årstad` (bydel) under Bergen |
| `OSL 1` under Oslo | `Sentrum/Gamle Oslo` under Oslo |
| `KRS 4` under Kristiansand | `Vågsbygd` (or similar) under Kristiansand |

---

## Scalability

This approach is scalable because:
1. **No hardcoded mappings needed** - AI learns from postal code patterns
2. **Works for any country** - Postal codes provide geographic context everywhere
3. **Self-improving** - As AI sees more examples, classification improves
4. **Fallback safety** - Unknown cases get flagged for manual review
5. **Reusable reference data** - Postal code tables can be maintained separately

---

## Optional: Manual Override Table

For cases where AI confidence is low, add a `navio_code_mappings` table:

```sql
CREATE TABLE navio_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code TEXT NOT NULL UNIQUE,  -- e.g., "NO BRG 6"
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

When the import runs, it first checks this override table before using AI. Users can manually add mappings for problematic codes via the UI.

