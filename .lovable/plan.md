
# Add Missing SEO Fields to Partners

## Problem Identified

Comparing Webflow's expected fields, the database schema, and the Partner form UI reveals gaps:

### What Webflow Expects (Partners Collection)
| Field | Type | Purpose |
|-------|------|---------|
| seo-title | PlainText | Page title tag |
| seo-meta-description | PlainText | Meta description |
| client-information | RichText | Partner description |
| client-information-summary | PlainText | Short summary |
| primary-city | ItemRefSet | Cities where partner operates |
| service-areas-optional | ItemRefSet | Service areas |

### What Database Has vs Missing

| Category | Current State | Missing |
|----------|---------------|---------|
| SEO Fields | None | `seo_title`, `seo_title_en`, `seo_title_sv`, `seo_meta_description`, `seo_meta_description_en`, `seo_meta_description_sv`, `intro`, `intro_en`, `intro_sv` |
| Form Fields | Basic info only | SEO title input, meta description input, intro rich text |

### What UI Form Has vs Missing

| Current Form Fields | Missing Fields |
|---------------------|----------------|
| Logo URLs, Rating, Active | SEO Title (localized) |
| Email, Phone, Address | SEO Meta Description (localized) |
| Website, Instagram, Facebook | Intro Content (localized) |
| Heading Text, Description Summary | Primary Cities selector |
| Name, Slug, Description (localized) | Districts selector |
| Services, Areas selectors | |

## Solution Overview

### Phase 1: Database Migration
Add missing columns to the `partners` table to match other entities:

```sql
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_title_en text,
ADD COLUMN IF NOT EXISTS seo_title_sv text,
ADD COLUMN IF NOT EXISTS seo_meta_description text,
ADD COLUMN IF NOT EXISTS seo_meta_description_en text,
ADD COLUMN IF NOT EXISTS seo_meta_description_sv text,
ADD COLUMN IF NOT EXISTS intro text,
ADD COLUMN IF NOT EXISTS intro_en text,
ADD COLUMN IF NOT EXISTS intro_sv text;
```

### Phase 2: Update Partner Form UI
Update `src/pages/Partners.tsx` to include:

1. **SEO Section** (inside locale tabs)
   - SEO Title input
   - SEO Meta Description textarea
   - Intro Content textarea (rich text editor)

2. **Coverage Section**
   - Primary Cities multi-select
   - Districts multi-select (already have partner_cities, partner_districts tables)

### Phase 3: Update Form Data Types
Add new fields to `PartnerFormData` interface:

```typescript
interface PartnerFormData {
  // ... existing fields
  seo_title: string;
  seo_title_en: string;
  seo_title_sv: string;
  seo_meta_description: string;
  seo_meta_description_en: string;
  seo_meta_description_sv: string;
  intro: string;
  intro_en: string;
  intro_sv: string;
  city_ids: string[];     // for partner_cities junction
  district_ids: string[]; // for partner_districts junction
}
```

### Phase 4: Update Mutations
- Extend create/update mutations to handle new fields
- Add queries for partner_cities and partner_districts
- Add mutation logic for city/district junction tables

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add SEO columns to partners table |
| `src/pages/Partners.tsx` | Add SEO inputs, coverage selectors, update form data |
| `src/integrations/supabase/types.ts` | Auto-generated after migration |

## Visual Layout After Changes

```
+------------------------------------------+
| Create/Edit Partner                       |
+------------------------------------------+
| [Logo URL] [Noddi Logo] [Rating]         |
| [Active toggle]                          |
|                                          |
| [Email] [Phone]                          |
| [Address]                                |
| [Website] [Instagram] [Facebook]         |
| [Heading Text]                           |
| [Description Summary]                    |
+------------------------------------------+
| [Norwegian] [English] [Swedish]          |
| Name *          Slug *                   |
| Description                              |
| SEO Title                                |
| SEO Meta Description                     |
| Intro Content                            |
+------------------------------------------+
| Coverage                                 |
| Services (X selected)  Areas (X selected)|
| Cities (X selected)  Districts (X sel.)  |
+------------------------------------------+
```

## Outcome

After implementation:
1. Partners will have full SEO field parity with other entities (Cities, Districts, Areas, etc.)
2. The validation health check for Partners should show fewer missing mappings
3. Webflow sync can populate SEO fields for partner pages
4. Partner coverage (cities/districts) can be managed in the UI
