

# Add Field Descriptions with Info Icons

## Problem Statement

Users need to understand what each field is for when viewing collection health status. Webflow already has descriptions (`helpText`) on all fields that we can fetch via the API, but we're not currently capturing or displaying them.

## Current State

- The `WebflowField` interface captures `slug`, `type`, `isRequired`, and `displayName`
- The Webflow API returns additional `helpText` property for each field
- Fields are displayed without any explanation of their purpose
- Users have to guess what fields like `is-delivery`, `noindex`, or `service-locations-reverse` are for

## Solution Overview

1. **Update backend** to capture `helpText` from Webflow API
2. **Add local descriptions** for expected fields (as fallback when Webflow description is empty)
3. **Update UI** to show info icons with tooltips on all fields

## Implementation Details

### Phase 1: Update Backend

**Modify `supabase/functions/webflow-validate/index.ts`:**

1. Add `helpText` to `WebflowField` interface:
```typescript
interface WebflowField {
  slug: string;
  type: string;
  isRequired: boolean;
  displayName: string;
  helpText?: string;  // Add this
}
```

2. Update `EXPECTED_FIELDS` to include descriptions:
```typescript
const EXPECTED_FIELDS: Record<string, Array<{
  slug: string;
  type: string;
  required: boolean;
  description: string;  // Add this
}>> = {
  cities: [
    { slug: "name", type: "PlainText", required: true, description: "The city's display name (localized). Used in page titles and headers." },
    { slug: "slug", type: "PlainText", required: true, description: "URL fragment for the city page. Used in canonical URLs." },
    { slug: "is-delivery", type: "Switch", required: false, description: "UI flag to control visibility in selection filters." },
    { slug: "noindex", type: "Switch", required: false, description: "Signals pages that should NOT be indexed by search engines." },
    // ... etc for all fields
  ],
  // ... other collections
};
```

3. Update `MissingFieldInfo` interface:
```typescript
interface MissingFieldInfo {
  slug: string;
  type: string;
  required: boolean;
  description: string;  // Add this
}
```

4. Include description in response for missing fields

5. Add new response field for all found fields with their descriptions:
```typescript
interface CollectionValidationResult {
  // ... existing fields
  found_fields_detailed: Array<{
    slug: string;
    type: string;
    displayName: string;
    helpText: string;
  }>;
}
```

### Phase 2: Update UI Components

**Modify `src/components/health/CollectionHealthCard.tsx`:**

1. Update interfaces to include descriptions
2. Add info icons next to each field badge
3. Show description in tooltip when hovering

**Visual Design:**

```
┌─────────────────────────────────────────────────┐
│ Cities                           Ready ✓        │
│ 11 fields mapped                                │
├─────────────────────────────────────────────────┤
│ Mapped Fields:                                  │
│ [name ℹ️] [slug ℹ️] [is-delivery ℹ️] [noindex ℹ️] │
│                                                 │
│ Hover on ℹ️ shows:                              │
│ ┌───────────────────────────────────────┐      │
│ │ is-delivery (Switch)                  │      │
│ │ UI flag to control visibility in      │      │
│ │ selection filters.                    │      │
│ └───────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### Phase 3: Add Expand/Collapse for Found Fields

Add a "Show all fields" toggle in the card that displays all mapped fields with their descriptions, not just missing ones.

## Field Descriptions Reference

| Collection | Field | Description |
|------------|-------|-------------|
| **Cities** | name | The city's display name (localized). Used in page titles and headers. |
| | slug | URL fragment for the city page. Used in canonical URLs. |
| | shared-key-city | Internal stable identifier for sync matching across locales. |
| | seo-title | The `<title>` tag for this city page (localized). |
| | seo-meta-description | Meta description tag (localized) for search engines. |
| | intro-content | Rich text description of the city for SEO. |
| | sitemap-priority | Control over sitemap importance for search engines. |
| | is-delivery | UI flag to control visibility in selection filters. |
| | noindex | Signals pages that should NOT be indexed by search engines. |
| | districts | Child districts for navigation and internal linking. |
| | areas | Child areas for navigational context. |
| **Districts** | city | Parent city reference for breadcrumb and hierarchy. |
| | areas | Child areas for navigation. |
| **Areas** | district | Parent district reference for hierarchy. |
| | city-2 | Denormalized city reference for simpler querying. |
| | service-locations-reverse | Reverse reference listing Service Location pages in this area. |
| **Service Categories** | icon | Visual categorization in UI. |
| | sort-order | Controls display order in menus/filters. |
| | active | Toggle visibility for unpublished categories. |
| | services | Associated services in this category. |
| **Services** | service-category | Parent category for navigation & filtering. |
| | description | Rich text explaining the service. |
| | active | Whether the service is currently offered/shown. |
| **Partners** | client-information | Rich text describing the partner. |
| | client-information-summary | Short summary for service cards. |
| | partner-active | Toggles whether partner shows in service lists. |
| | services-provided | Services the partner offers. |
| **Service Locations** | name | Internal label (e.g., "Dekkskift i Oslo"). |
| | partners-2 | Partners that deliver this service in this location. |
| | hero-intro-content-2 | Rich text with unique on-page content (~200 words). |
| | json-ld-structured-data-2 | Schema.org JSON-LD for rich results. |
| | canonical-path-2 | The canonical URL as computed by Lovable. |
| | noindex-2 | Instructs search engines not to index (for sparse combos). |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Add descriptions to EXPECTED_FIELDS, capture helpText from API, include in response |
| `src/components/health/CollectionHealthCard.tsx` | Add info icons with tooltips for all fields, show descriptions |
| `src/components/health/SystemHealthPanel.tsx` | Update interfaces for new response structure |

## Benefits

1. **Self-documenting UI**: Users understand each field's purpose without external documentation
2. **Leverages existing data**: Uses `helpText` from Webflow when available
3. **Complete coverage**: Falls back to our descriptions when Webflow description is empty
4. **Consistency**: Same descriptions shown for both mapped and missing fields

