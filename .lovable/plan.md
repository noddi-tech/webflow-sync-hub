
# Add Missing Webflow Fields to App Database & UI

## Problem Statement

The System Health panel shows "Missing Fields" and "Extra Webflow Fields" for several collections. The current UI messaging incorrectly tells users to "Create these fields in Webflow CMS Designer" - but since this app is the **source of truth**, we need to:

1. **Add database columns** for all Webflow fields that we're not currently storing
2. **Add UI form inputs** so users can edit these values in the app
3. **Fix the Health Card messaging** to reflect that fields should be added to our app, not Webflow
4. **Update sync functions** to push these new fields to Webflow

## Analysis of Missing Fields

### Services Collection (Most Gaps)

| Field in Webflow | Type | Status | Action |
|-----------------|------|--------|--------|
| `shared-key` | PlainText | In DB, NOT in EXPECTED_FIELDS | Fix validation config |
| `description` | PlainText | Already in DB + UI | Fix validation config |
| `active` | Switch | Already in DB + UI | Map to Webflow Draft, fix validation |
| `short-description` | PlainText | NOT in DB | Add column + UI |
| `price` | PlainText | NOT in DB | Add column + UI |
| `price-from` | PlainText | NOT in DB | Add column + UI |
| `service-includes` | RichText | NOT in DB | Add column + UI |
| `step-1---text` | PlainText | NOT in DB | Add column + UI |
| `step-1---illustration` | PlainText | NOT in DB | Add column + UI |
| `step-2---text` | PlainText | NOT in DB | Add column + UI |
| `step-2---illustration` | PlainText | NOT in DB | Add column + UI |
| `step-3---text` | PlainText | NOT in DB | Add column + UI |
| `step-3---illustration` | PlainText | NOT in DB | Add column + UI |
| `price---first-column-description` | RichText | NOT in DB | Add column + UI |
| `price---second-column-description` | RichText | NOT in DB | Add column + UI |
| `price---third-column-description` | RichText | NOT in DB | Add column + UI |
| `season-product` | Switch | NOT in DB | Add column + UI |
| `service-type-schema` | PlainText | NOT in DB | Add column + UI |

### Service Categories Collection

| Field in Webflow | Type | Status | Action |
|-----------------|------|--------|--------|
| `services` | Multi-Reference | Cannot store/sync directly | Computed from services table |
| `associated-services` | Multi-Reference | Same as above | Computed, reverse reference |

### Service Locations Collection

| Field in Webflow | Type | Status | Action |
|-----------------|------|--------|--------|
| `shared-key-service-location` | PlainText | In DB as computed | Add to sync function |
| `shared-key-service-location-2` | PlainText | Duplicate? | Ignore or add to validation |

## Implementation Plan

### Phase 1: Database Migration - Add Missing Service Fields

```sql
-- Add all missing fields to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS short_description text,
ADD COLUMN IF NOT EXISTS short_description_en text,
ADD COLUMN IF NOT EXISTS short_description_sv text,
ADD COLUMN IF NOT EXISTS price text,
ADD COLUMN IF NOT EXISTS price_from text,
ADD COLUMN IF NOT EXISTS service_includes text,
ADD COLUMN IF NOT EXISTS service_includes_en text,
ADD COLUMN IF NOT EXISTS service_includes_sv text,
ADD COLUMN IF NOT EXISTS step_1_text text,
ADD COLUMN IF NOT EXISTS step_1_text_en text,
ADD COLUMN IF NOT EXISTS step_1_text_sv text,
ADD COLUMN IF NOT EXISTS step_1_illustration text,
ADD COLUMN IF NOT EXISTS step_2_text text,
ADD COLUMN IF NOT EXISTS step_2_text_en text,
ADD COLUMN IF NOT EXISTS step_2_text_sv text,
ADD COLUMN IF NOT EXISTS step_2_illustration text,
ADD COLUMN IF NOT EXISTS step_3_text text,
ADD COLUMN IF NOT EXISTS step_3_text_en text,
ADD COLUMN IF NOT EXISTS step_3_text_sv text,
ADD COLUMN IF NOT EXISTS step_3_illustration text,
ADD COLUMN IF NOT EXISTS price_first_column text,
ADD COLUMN IF NOT EXISTS price_first_column_en text,
ADD COLUMN IF NOT EXISTS price_first_column_sv text,
ADD COLUMN IF NOT EXISTS price_second_column text,
ADD COLUMN IF NOT EXISTS price_second_column_en text,
ADD COLUMN IF NOT EXISTS price_second_column_sv text,
ADD COLUMN IF NOT EXISTS price_third_column text,
ADD COLUMN IF NOT EXISTS price_third_column_en text,
ADD COLUMN IF NOT EXISTS price_third_column_sv text,
ADD COLUMN IF NOT EXISTS season_product boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS service_type_schema text;
```

### Phase 2: Update Services Form UI

Update `src/pages/Services.tsx` to add form inputs for:
- Short Description (localized)
- Price, Price From
- Service Includes (rich text, localized)
- 3 Steps (text + illustration for each, localized text)
- 3 Price Columns (rich text, localized)
- Season Product toggle
- Service Type Schema

Group these in collapsible sections for better UX:
- **Pricing Section**: price, price_from, price columns
- **Steps Section**: step 1/2/3 text + illustrations
- **Content Section**: short_description, service_includes
- **Control Section**: season_product, service_type_schema

### Phase 3: Update webflow-validate EXPECTED_FIELDS

Update `supabase/functions/webflow-validate/index.ts` to include ALL Webflow fields:

```typescript
services: [
  // Core + existing fields...
  { slug: "shared-key", type: "PlainText", required: false, description: "..." },
  { slug: "description", type: "PlainText", required: false, description: "..." },
  { slug: "active", type: "Switch", required: false, description: "..." },
  // New fields
  { slug: "short-description", type: "PlainText", required: false, description: "..." },
  { slug: "price", type: "PlainText", required: false, description: "..." },
  { slug: "price-from", type: "PlainText", required: false, description: "..." },
  { slug: "service-includes", type: "RichText", required: false, description: "..." },
  { slug: "step-1---text", type: "PlainText", required: false, description: "..." },
  { slug: "step-1---illustration", type: "PlainText", required: false, description: "..." },
  // ... all step fields
  { slug: "price---first-column-description", type: "RichText", required: false, description: "..." },
  // ... all price column fields
  { slug: "season-product", type: "Switch", required: false, description: "..." },
  { slug: "service-type-schema", type: "PlainText", required: false, description: "..." },
]
```

### Phase 4: Update webflow-sync for Services

Update `supabase/functions/webflow-sync/index.ts` to:
1. Include all new fields in the sync payload
2. Map `active: false` to `isDraft: true` (instead of requiring a Webflow field)
3. Add field mappings for localized content

### Phase 5: Update webflow-import for Services

Update `supabase/functions/webflow-import/index.ts` to import all the new fields from Webflow into the database.

### Phase 6: Fix Health Card Messaging

Update `src/components/health/CollectionHealthCard.tsx` to:
- Change "Create these fields in Webflow CMS Designer" to "Add these fields to the app"
- Add an "Adopt Field" action button that shows what needs to be added to the database/UI
- Clarify that "Extra Webflow Fields" = fields in Webflow we're not yet syncing

### Phase 7: Update Service Categories Validation

For Service Categories, the `services` multi-reference is **computed** from the services table (services that have `service_category_id` set). Update validation to mark this as "computed, not synced" rather than "missing".

### Phase 8: Update Service Locations Sync

Add `shared-key-service-location` to the sync payload (computed as `{service_slug}-{city_slug}-{district_slug}-{area_slug}`).

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add 20+ columns to services table |
| `src/pages/Services.tsx` | Add form sections for all new fields |
| `supabase/functions/webflow-validate/index.ts` | Add all new fields to EXPECTED_FIELDS |
| `supabase/functions/webflow-sync/index.ts` | Add field mappings, implement Draft mode for inactive |
| `supabase/functions/webflow-import/index.ts` | Import all new fields |
| `src/components/health/CollectionHealthCard.tsx` | Fix messaging direction |

---

## UI Layout for Services Form (After Changes)

```
+----------------------------------------------------------+
| Create/Edit Service                                        |
+----------------------------------------------------------+
| Category: [Dropdown]    Icon URL: [Input]                 |
| Sort Order: [Number]    Active: [Toggle]                  |
|                         Season Product: [Toggle]          |
+----------------------------------------------------------+
| [Norwegian] [English] [Swedish]                           |
| Name *: [Input]          Slug *: [Input]                  |
| Description: [Textarea]                                   |
| Short Description: [Input]                                |
| SEO Title: [Input]                                        |
| SEO Meta Description: [Textarea]                          |
| Intro Content: [Textarea]                                 |
| Service Includes: [Rich Text Editor]                      |
+----------------------------------------------------------+
| [> Pricing (collapsed by default)]                        |
|   Price: [Input]    Price From: [Input]                   |
|   First Column Description: [Rich Text]                   |
|   Second Column Description: [Rich Text]                  |
|   Third Column Description: [Rich Text]                   |
+----------------------------------------------------------+
| [> Steps (collapsed by default)]                          |
|   Step 1 Text: [Textarea]   Illustration URL: [Input]     |
|   Step 2 Text: [Textarea]   Illustration URL: [Input]     |
|   Step 3 Text: [Textarea]   Illustration URL: [Input]     |
+----------------------------------------------------------+
| [> Advanced (collapsed by default)]                       |
|   Service Type Schema: [Input]                            |
+----------------------------------------------------------+
```

---

## Expected Outcome

After implementation:
1. All 7 collections will show "Ready" status in System Health
2. No "Missing Fields" or "Extra Webflow Fields" warnings
3. Users can edit ALL Webflow content fields directly in this app
4. Sync will push all content to Webflow correctly
5. Import will pull all content from Webflow correctly
6. The app is truly the single source of truth for Webflow CMS
