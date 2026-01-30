

# Webflow Collection Field Validation & Data Population Strategy

## Current Situation

Your system has field mappings defined in the edge functions, but before populating data you're right that we should verify these match your actual Webflow collections. There are two approaches:

---

## Recommended Approach: Add a "Validate Collections" Feature

### What It Does
Create a new edge function that fetches the actual field schema from each Webflow collection and compares it against what we expect. This gives you a clear report before importing/syncing.

### How It Works
1. Call Webflow API endpoint `GET /collections/{collection_id}` for each configured collection
2. Extract the `fields` array which contains all field slugs, types, and whether they're required
3. Compare against our expected field mappings
4. Return a report showing:
   - Fields we expect that exist in Webflow (ready)
   - Fields we expect that are MISSING in Webflow (need to add in Webflow)
   - Fields in Webflow we don't map (optional/unused)

---

## Implementation Plan

### Step 1: Create New Edge Function - `webflow-validate`
A new function that fetches collection schemas from Webflow and validates field mappings.

```text
Expected output format:
{
  "collections": {
    "cities": {
      "webflow_collection_name": "Cities",
      "status": "ok" | "missing_fields" | "not_configured",
      "expected_fields": ["name", "slug", "seo-title", ...],
      "found_fields": ["name", "slug", ...],
      "missing_in_webflow": ["seo-title"],
      "extra_in_webflow": ["legacy-field"]
    },
    ...
  }
}
```

### Step 2: Add Validation UI to Settings Page
- Add a "Validate Webflow Collections" button
- Shows a dialog with validation results per collection
- Color-coded: green (all good), yellow (extra fields), red (missing required fields)

### Step 3: Expected Field Mappings Reference

Based on current edge function code, here's what each collection needs:

**Cities Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| shared-key | PlainText | No | No |
| short-description | PlainText | No | No |
| is-delivery | Switch | No | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| intro | RichText | Yes | No |
| sitemap-priority | Number | No | No |

**Districts Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| city | ItemRef (Cities) | No | Yes |
| shared-key | PlainText | No | No |
| short-description | PlainText | No | No |
| is-delivery | Switch | No | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| intro | RichText | Yes | No |
| sitemap-priority | Number | No | No |

**Areas Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| district | ItemRef (Districts) | No | Yes |
| city | ItemRef (Cities) | No | No |
| shared-key | PlainText | No | No |
| short-description | PlainText | No | No |
| is-delivery | Switch | No | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| intro | RichText | Yes | No |
| sitemap-priority | Number | No | No |

**Service Categories Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| shared-key | PlainText | No | No |
| description | RichText | Yes | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| intro | RichText | Yes | No |
| icon-url | PlainText | No | No |
| sort-order | Number | No | No |
| active | Switch | No | No |

**Services Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| service-category | ItemRef (Service Categories) | No | No |
| shared-key | PlainText | No | No |
| description | RichText | Yes | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| intro | RichText | Yes | No |
| icon-url | PlainText | No | No |
| sort-order | Number | No | No |
| active | Switch | No | No |

**Partners Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| name | PlainText | Yes | Yes |
| slug | PlainText | Yes | Yes |
| shared-key | PlainText | No | No |
| email | PlainText | No | No |
| phone | PlainText | No | No |
| address | PlainText | No | No |
| description | RichText | Yes | No |
| description-summary | PlainText | No | No |
| heading-text | PlainText | No | No |
| logo-url | PlainText | No | No |
| noddi-logo-url | PlainText | No | No |
| website-url | PlainText | No | No |
| instagram-url | PlainText | No | No |
| facebook-url | PlainText | No | No |
| rating | Number | No | No |
| active | Switch | No | No |
| areas | ItemRefSet (Areas) | No | No |
| cities | ItemRefSet (Cities) | No | No |
| districts | ItemRefSet (Districts) | No | No |
| services | ItemRefSet (Services) | No | No |

**Service Locations Collection**
| Webflow Field Slug | Type | Localized | Required |
|--------------------|------|-----------|----------|
| slug | PlainText | Yes | Yes |
| service | ItemRef (Services) | No | Yes |
| city | ItemRef (Cities) | No | Yes |
| district | ItemRef (Districts) | No | No |
| area | ItemRef (Areas) | No | No |
| seo-title | PlainText | Yes | No |
| seo-meta-description | PlainText | Yes | No |
| hero-content | RichText | Yes | No |
| canonical-url | PlainText | Yes | No |
| structured-data-json | PlainText | Yes | No |
| sitemap-priority | Number | No | No |
| noindex | Switch | No | No |
| partners | ItemRefSet (Partners) | No | No |

---

## Suggested Workflow for Data Population

### Phase 1: Validation (Before Any Data)
1. Configure all Collection IDs in Settings
2. Run the new "Validate Collections" feature
3. Fix any missing fields in Webflow CMS
4. Re-validate until all green

### Phase 2: Import Existing Webflow Data
1. Start with base entities: **Cities** first
2. Then **Districts** (depends on Cities)
3. Then **Areas** (depends on Districts)
4. Then **Service Categories**
5. Then **Services** (depends on Service Categories)
6. Then **Partners** (imports junction table relationships)

### Phase 3: Set Up Partner Coverage
1. Go to Partner Service Locations page
2. Add coverage entries for each partner (what services they offer, where)
3. This is manual initially, or could be imported if you have a source

### Phase 4: Generate & Sync Service Locations
1. Click "Regenerate All" on Service Locations page
2. This computes all unique service+location combos from partner coverage
3. Then run "Sync to Webflow" to push to Webflow

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/webflow-validate/index.ts` | Create | New edge function for schema validation |
| `src/pages/Settings.tsx` | Modify | Add "Validate Collections" button and results dialog |
| `src/components/settings/ValidationResultsDialog.tsx` | Create | Display validation results |

---

## Questions Before Implementation

1. **Do all your Webflow collections already exist?** If some are new, you'll need to create them in Webflow first with the fields listed above.

2. **Is Service Locations a new collection?** This appears to be for SEO pages - if it doesn't exist yet, you'll need to create it in Webflow with all the fields listed.

3. **Do you want to start with just validation, or implement the full workflow?**

