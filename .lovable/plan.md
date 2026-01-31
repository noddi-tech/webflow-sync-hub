
# Fix Field Mappings: Complete Webflow Field Definitions

## Problem Statement

The current `EXPECTED_FIELDS` configuration in `webflow-validate/index.ts` is incomplete, causing legitimate Webflow fields to be incorrectly displayed as "Extra Webflow Fields (safe to ignore)". Based on the comprehensive SEO architecture documentation, **every field in Webflow exists for a specific purpose** - there are no "extra" fields.

The fields being incorrectly flagged include:
- `is-delivery` - UI flag for controlling visibility in selection filters
- `noindex` - Signals pages that should NOT be indexed by search engines
- `service-locations-reverse` - Reverse multi-reference for Areas to list their Service Location pages
- Multi-reference fields for navigation (`districts`, `areas`, `services`)

## Root Cause

The `EXPECTED_FIELDS` constant was created with an incomplete understanding of the Webflow CMS structure. It only included fields that were being actively used in the sync/import functions, not the full set of fields needed for the complete SEO architecture.

## Solution Overview

Update the `EXPECTED_FIELDS` configuration to include ALL fields from each Webflow collection, organized by purpose:

### Phase 1: Update Field Definitions

Add all missing fields to `supabase/functions/webflow-validate/index.ts`:

```text
CITIES:
  - Core: name, slug
  - Identity: shared-key-city
  - SEO: seo-title, seo-meta-description, intro-content, sitemap-priority
  - Control: is-delivery, noindex
  - Navigation: districts (multi-ref), areas (multi-ref)

DISTRICTS:
  - Core: name, slug
  - Identity: shared-key-district
  - Reference: city
  - SEO: seo-title, seo-meta-description, intro-content, sitemap-priority
  - Control: is-delivery, noindex
  - Navigation: areas (multi-ref)

AREAS:
  - Core: name, slug
  - Identity: shared-key-area
  - References: district, city-2
  - SEO: seo-title, seo-meta-description, intro-content, sitemap-priority
  - Control: is-delivery, noindex
  - Reverse Reference: service-locations-reverse (ItemRefSet)

SERVICE CATEGORIES:
  - Core: name, slug
  - Identity: shared-key-service-category
  - SEO: seo-title, seo-meta-description, intro-content
  - Control: icon, sort-order, active
  - Navigation: services (multi-ref for associated services)

SERVICES:
  - Core: name, slug
  - Identity: shared-key (not shared-key-service)
  - Reference: service-category
  - SEO: seo-title, seo-meta-description, service-intro-seo
  - Control: icon, sort-order, active
  - Content: description

PARTNERS:
  - Core: name, slug
  - Identity: shared-key-partner
  - Contact: email, phone-number, website-link, facebook-link, instagram-link
  - Content: client-information, client-information-summary, heading-text
  - Branding: client-logo, noddi-logo
  - Control: partner-active
  - References: primary-city (multi-ref), service-areas-optional (multi-ref), services-provided (multi-ref)
  - SEO: seo-title, seo-meta-description

SERVICE LOCATIONS:
  - Core: name, slug
  - Identity: shared-key-service-location
  - References: service, city-2, district-2, area-2, partners-2 (multi-ref)
  - SEO: seo-title-2, seo-meta-description-2, hero-intro-content-2
  - Technical: canonical-path-2, json-ld-structured-data-2, sitemap-priority-2
  - Control: noindex-2
```

### Phase 2: Update Import Function

Update `supabase/functions/webflow-import/index.ts` to read the missing fields from Webflow:

**For Cities, Districts, Areas:**
- Read `is-delivery` field: `is_delivery: getBoolean(noData["is-delivery"])`
- Read `noindex` field (if present for geographic entities)

**For Partners:**
- Read `seo-title` and `seo-meta-description` if needed for partner profile SEO

**For Services:**
- Add `active` field mapping: `active: getBoolean(noData["active"]) ?? true`
- Add `description` field for service descriptions

### Phase 3: Update Sync Function

Update `supabase/functions/webflow-sync/index.ts` to write the additional fields:

**For Cities/Districts/Areas:**
- Include `is-delivery` field in sync payload
- Include `noindex` field if applicable

**For Service Locations:**
- Ensure `name` field is populated (e.g., "Dekkskift i Oslo")

### Phase 4: Update UI Messaging

Update `src/components/health/CollectionHealthCard.tsx` to remove the "safe to ignore" language since all fields should be intentionally mapped:

**Current:**
> "These fields exist in Webflow but are not mapped to your database. They are safe to ignore..."

**Updated:**
> "These fields exist in Webflow but are not yet mapped to your database. They may need to be added to the field mappings for full sync support."

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Add all missing fields to EXPECTED_FIELDS (lines 11-95) |
| `supabase/functions/webflow-import/index.ts` | Add missing field mappings (is-delivery, noindex, etc.) |
| `supabase/functions/webflow-sync/index.ts` | Add missing fields to sync payloads |
| `src/components/health/CollectionHealthCard.tsx` | Update tooltip text (lines 159-162) |

## Complete Field Definitions

### Cities Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Display name (localized) |
| slug | PlainText | Yes | URL fragment |
| shared-key-city | PlainText | No | Sync identifier |
| seo-title | PlainText | No | Page title tag |
| seo-meta-description | PlainText | No | Meta description |
| intro-content | RichText | No | Rich text description |
| sitemap-priority | Number | No | Sitemap weight |
| is-delivery | Switch | No | UI filter control |
| noindex | Switch | No | Search engine control |
| districts | ItemRefSet | No | Child districts navigation |
| areas | ItemRefSet | No | Child areas navigation |

### Districts Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Display name |
| slug | PlainText | Yes | URL fragment |
| city | ItemRef | Yes | Parent city |
| shared-key-district | PlainText | No | Sync identifier |
| seo-title | PlainText | No | Page title |
| seo-meta-description | PlainText | No | Meta description |
| intro-content | RichText | No | Rich text content |
| sitemap-priority | Number | No | Sitemap weight |
| is-delivery | Switch | No | UI filter control |
| noindex | Switch | No | Search control |
| areas | ItemRefSet | No | Child areas |

### Areas Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Display name |
| slug | PlainText | Yes | URL fragment |
| district | ItemRef | Yes | Parent district |
| city-2 | ItemRef | No | Denormalized city reference |
| shared-key-area | PlainText | No | Sync identifier |
| seo-title | PlainText | No | Page title |
| seo-meta-description | PlainText | No | Meta description |
| intro-content | RichText | No | Rich text content |
| sitemap-priority | Number | No | Sitemap weight |
| is-delivery | Switch | No | UI filter control |
| noindex | Switch | No | Search control |
| service-locations-reverse | ItemRefSet | No | Reverse reference to Service Locations |

### Service Categories Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Category name |
| slug | PlainText | Yes | URL fragment |
| shared-key-service-category | PlainText | No | Sync identifier |
| seo-title | PlainText | No | Page title |
| seo-meta-description | PlainText | No | Meta description |
| intro-content | RichText | No | Category description |
| icon | PlainText | No | Visual icon |
| sort-order | Number | No | Display ordering |
| active | Switch | No | Visibility toggle |
| services | ItemRefSet | No | Associated services |

### Services Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Service name |
| slug | PlainText | Yes | URL fragment |
| service-category | ItemRef | No | Parent category |
| shared-key | PlainText | No | Sync identifier |
| seo-title | PlainText | No | Page title |
| seo-meta-description | PlainText | No | Meta description |
| service-intro-seo | RichText | No | Service intro content |
| description | PlainText | No | Service description |
| icon | PlainText | No | Visual icon |
| sort-order | Number | No | Display ordering |
| active | Switch | No | Visibility toggle |

### Partners Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | Yes | Partner name |
| slug | PlainText | Yes | URL fragment |
| shared-key-partner | PlainText | No | Sync identifier |
| email | PlainText | No | Contact email |
| phone-number | PlainText | No | Contact phone |
| client-information | RichText | No | Partner description |
| client-information-summary | PlainText | No | Short summary |
| heading-text | PlainText | No | Custom heading |
| client-logo | PlainText | No | Logo URL |
| noddi-logo | PlainText | No | Noddi branding |
| website-link | PlainText | No | External website |
| facebook-link | PlainText | No | Facebook URL |
| instagram-link | PlainText | No | Instagram URL |
| partner-active | Switch | No | Visibility toggle |
| primary-city | ItemRefSet | No | Primary city reference |
| service-areas-optional | ItemRefSet | No | Service areas |
| services-provided | ItemRefSet | No | Services offered |
| seo-title | PlainText | No | Partner page SEO |
| seo-meta-description | PlainText | No | Meta description |

### Service Locations Collection
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | PlainText | No | Item label (e.g., "Dekkskift i Oslo") |
| slug | PlainText | Yes | URL fragment |
| service | ItemRef | Yes | Service reference |
| city-2 | ItemRef | Yes | City reference |
| district-2 | ItemRef | No | District reference |
| area-2 | ItemRef | No | Area reference |
| partners-2 | ItemRefSet | No | Partners serving this location |
| seo-title-2 | PlainText | No | Page title |
| seo-meta-description-2 | PlainText | No | Meta description |
| hero-intro-content-2 | RichText | No | Hero content (~200+ words) |
| canonical-path-2 | PlainText | No | Canonical URL |
| json-ld-structured-data-2 | PlainText | No | Schema.org JSON-LD |
| sitemap-priority-2 | Number | No | Sitemap weight |
| noindex-2 | Switch | No | Search control |
| shared-key-service-location | PlainText | No | Sync identifier |

## Expected Outcome

After implementation:
1. No fields will be incorrectly flagged as "Extra Webflow Fields"
2. All 7 collections will show "Ready" status with complete field mappings
3. Import/sync functions will properly read/write all fields
4. The is-delivery field will be synced for geographic entities
5. Service Location pages will have proper `name` field populated

## Technical Notes

- The suffix `-2` on Service Location fields (e.g., `seo-title-2`, `city-2`) appears to be a Webflow naming convention to avoid conflicts with other collections
- Multi-reference fields use type `ItemRefSet`
- Single reference fields use type `ItemRef`
- Boolean fields use type `Switch`
