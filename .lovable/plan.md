
# Comprehensive Service-Based Architecture Implementation Plan

## Overview

This plan implements the complete Lovable-to-Webflow sync system as specified in the master instruction document. The key additions beyond the previous plan include:

1. **Service Categories** - New entity for grouping services
2. **Localization** - Full support for 3 locales (NO, EN, SV) with per-locale fields
3. **Shared Keys** - Using `shared_key` for record matching across systems
4. **Partner Service Locations** - Granular relationship table specifying which partner provides which service at which location
5. **Service Locations** - Computed SEO pages combining Service + Geographic location
6. **SEO Content Generation** - Automated title, meta description, intro, and JSON-LD generation
7. **Multi-reference field handling** - Districts on Cities, Areas on Districts, etc.

---

## Current State Analysis

**Existing Tables:**
- `cities` - name, slug, short_description, is_delivery, webflow_item_id
- `districts` - name, slug, short_description, is_delivery, city_id, webflow_item_id
- `areas` - name, slug, short_description, is_delivery, district_id, webflow_item_id
- `partners` - name, slug, email, phone, address, webflow_item_id
- `partner_areas` - partner_id, area_id (junction table)

**What's Missing:**
- Service Categories table
- Services table
- Partner Service Locations relationship table
- Service Locations computed table
- Shared keys on all tables
- SEO fields (seo_title, seo_meta_description, intro, sitemap_priority)
- Localized field storage
- Partner extended fields (logo, description, website, rating, active, social links)
- Multi-reference junction tables for reverse references

---

## Phase 1: Database Schema Migration

### 1.1 Add Shared Keys to Existing Tables

Add `shared_key` column to all geographic entities and partners for cross-system matching:

```sql
-- Cities
ALTER TABLE cities ADD COLUMN shared_key text UNIQUE;
ALTER TABLE cities ADD COLUMN seo_title text;
ALTER TABLE cities ADD COLUMN seo_meta_description text;
ALTER TABLE cities ADD COLUMN intro text;
ALTER TABLE cities ADD COLUMN sitemap_priority numeric DEFAULT 0.7;

-- Add localized fields (JSON storage for simplicity)
ALTER TABLE cities ADD COLUMN name_en text;
ALTER TABLE cities ADD COLUMN name_sv text;
ALTER TABLE cities ADD COLUMN slug_en text;
ALTER TABLE cities ADD COLUMN slug_sv text;
ALTER TABLE cities ADD COLUMN seo_title_en text;
ALTER TABLE cities ADD COLUMN seo_title_sv text;
ALTER TABLE cities ADD COLUMN seo_meta_description_en text;
ALTER TABLE cities ADD COLUMN seo_meta_description_sv text;
ALTER TABLE cities ADD COLUMN intro_en text;
ALTER TABLE cities ADD COLUMN intro_sv text;
```

Similar changes for districts, areas.

### 1.2 New Table: `service_categories`

```sql
CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_key text UNIQUE,
  name text NOT NULL,
  name_en text,
  name_sv text,
  slug text NOT NULL UNIQUE,
  slug_en text,
  slug_sv text,
  description text,
  description_en text,
  description_sv text,
  seo_title text,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  intro text,
  intro_en text,
  intro_sv text,
  icon_url text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 1.3 New Table: `services`

```sql
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_key text UNIQUE,
  service_category_id uuid REFERENCES service_categories(id),
  name text NOT NULL,
  name_en text,
  name_sv text,
  slug text NOT NULL UNIQUE,
  slug_en text,
  slug_sv text,
  description text,
  description_en text,
  description_sv text,
  seo_title text,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  intro text,
  intro_en text,
  intro_sv text,
  icon_url text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 1.4 Extend Partners Table

```sql
ALTER TABLE partners ADD COLUMN shared_key text UNIQUE;
ALTER TABLE partners ADD COLUMN name_en text;
ALTER TABLE partners ADD COLUMN name_sv text;
ALTER TABLE partners ADD COLUMN slug_en text;
ALTER TABLE partners ADD COLUMN slug_sv text;
ALTER TABLE partners ADD COLUMN logo_url text;
ALTER TABLE partners ADD COLUMN noddi_logo_url text;
ALTER TABLE partners ADD COLUMN heading_text text;
ALTER TABLE partners ADD COLUMN description text;
ALTER TABLE partners ADD COLUMN description_en text;
ALTER TABLE partners ADD COLUMN description_sv text;
ALTER TABLE partners ADD COLUMN description_summary text;
ALTER TABLE partners ADD COLUMN website_url text;
ALTER TABLE partners ADD COLUMN instagram_url text;
ALTER TABLE partners ADD COLUMN facebook_url text;
ALTER TABLE partners ADD COLUMN rating numeric;
ALTER TABLE partners ADD COLUMN active boolean DEFAULT true;
```

### 1.5 New Table: `partner_service_locations`

This is the critical relationship table specifying exactly which partner provides which service at which location:

```sql
CREATE TABLE partner_service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  price_info text,
  duration_info text,
  is_delivery boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, service_id, city_id, district_id, area_id)
);
```

### 1.6 New Table: `service_locations`

Computed SEO pages based on partner coverage:

```sql
CREATE TABLE service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  
  -- Localized slugs
  slug text NOT NULL,
  slug_en text,
  slug_sv text,
  
  -- Canonical URLs
  canonical_url text NOT NULL,
  canonical_url_en text,
  canonical_url_sv text,
  
  -- Localized SEO fields
  seo_title text NOT NULL,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text NOT NULL,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  hero_content text,
  hero_content_en text,
  hero_content_sv text,
  
  -- Structured data (JSON-LD)
  structured_data_json text,
  structured_data_json_en text,
  structured_data_json_sv text,
  
  -- Metadata
  sitemap_priority numeric DEFAULT 0.5,
  noindex boolean DEFAULT false,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(service_id, city_id, district_id, area_id)
);
```

### 1.7 Junction Table for Service Location Partners

```sql
CREATE TABLE service_location_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_location_id, partner_id)
);
```

### 1.8 Junction Tables for Multi-References

```sql
-- Partner services (which services a partner provides overall)
CREATE TABLE partner_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, service_id)
);

-- Partner cities (which cities a partner operates in)
CREATE TABLE partner_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, city_id)
);

-- Partner districts
CREATE TABLE partner_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, district_id)
);

-- Service category to services association (reverse lookup)
CREATE TABLE service_category_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_category_id, service_id)
);
```

### 1.9 RLS Policies

All new tables will have admin-only CRUD policies matching existing tables.

---

## Phase 2: Update Settings Page

Add new collection ID fields to Settings:

| Setting Key | Label |
|-------------|-------|
| `webflow_cities_collection_id` | Cities Collection ID |
| `webflow_districts_collection_id` | Districts Collection ID |
| `webflow_areas_collection_id` | Areas Collection ID |
| `webflow_services_collection_id` | Services (Tjenester) Collection ID |
| `webflow_service_categories_collection_id` | Service Categories Collection ID |
| `webflow_partners_collection_id` | Partners Collection ID |
| `webflow_service_locations_collection_id` | Service Locations Collection ID |
| `base_url` | Base URL (e.g., https://www.noddi.no) |

---

## Phase 3: Create New Management Pages

### 3.1 Service Categories Page (`/service-categories`)

- List view with name, slug, icon, sort order, active status
- Add/Edit form with all localized fields
- Drag-to-reorder for sort order

### 3.2 Services Page (`/services`)

- List view with name, slug, category, active status
- Add/Edit form with:
  - Category selector
  - Localized name, slug, description fields
  - SEO fields
  - Icon upload

### 3.3 Partner Service Locations Page (`/partner-service-locations`)

- Table view showing: Partner, Service, City, District, Area
- Bulk import capability
- Filter by partner, service, or location
- Add/Edit form for granular partner coverage

### 3.4 Service Locations Page (`/service-locations`)

- **Read-only view** of computed service locations
- Filter by service, city, district
- Columns: Service, Location (City/District/Area), Partner Count, Canonical URL
- "Regenerate All" button to recompute
- "Preview" links to Webflow

---

## Phase 4: Update Existing Management Pages

### 4.1 Cities Page

Add fields:
- Shared Key (readonly after creation)
- Localized names (NO, EN, SV tabs)
- Localized slugs
- SEO Title, Meta Description, Intro (per locale)
- Sitemap Priority

### 4.2 Districts Page

Add fields:
- Shared Key
- Localized fields
- SEO fields per locale

### 4.3 Areas Page

Add fields:
- Shared Key
- Localized fields
- SEO fields per locale
- Display derived City

### 4.4 Partners Page

Significantly expand form:
- Shared Key
- Localized name, slug
- Logo upload, Noddi Logo toggle
- Heading text
- Description (rich text, localized)
- Description Summary
- Contact fields (email, phone, address)
- Social links (website, Instagram, Facebook)
- Rating
- Active toggle
- Services provided (multi-select from services)
- **Note:** Coverage is now managed via Partner Service Locations, not here

---

## Phase 5: Update Edge Functions

### 5.1 Update `webflow-import/index.ts`

**Import Order (critical for references):**
1. Service Categories
2. Services
3. Cities
4. Districts
5. Areas
6. Partners
7. Partner Service Locations (from junction data)

**Key Changes:**
- Match records by `shared_key` instead of just `webflow_item_id`
- Import localized fields from Webflow using locale parameter
- Populate all new junction tables
- Handle multi-reference fields

**Localization handling:**
```typescript
const LOCALES = {
  no: "64e4857c2f099414c700c890",
  en: "66f270e0051d1b43823c01d9",
  sv: "66f270e0051d1b43823c01da",
};

// Fetch each locale separately
for (const [locale, localeId] of Object.entries(LOCALES)) {
  const items = await fetchCollectionItems(collectionId, apiToken, localeId);
  // Merge localized fields into main record
}
```

### 5.2 Update `webflow-sync/index.ts`

**Sync Order:**
1. Service Categories
2. Services (with category references)
3. Cities (with Districts multi-reference)
4. Districts (with City reference, Areas multi-reference)
5. Areas (with District + City references)
6. Partners (with all references and localized fields)
7. **Generate Service Locations** (computed)
8. Sync Service Locations (with partner multi-references)

**Service Location Generation Logic:**

```typescript
async function generateServiceLocations(supabase: any) {
  // Get all unique combinations from partner_service_locations
  const { data: combinations } = await supabase
    .from("partner_service_locations")
    .select(`
      service_id,
      city_id,
      district_id,
      area_id,
      partners!inner(id, webflow_item_id)
    `);
  
  // Group by location combination
  const locationMap = new Map();
  for (const combo of combinations) {
    const key = `${combo.service_id}-${combo.city_id}-${combo.district_id || 'null'}-${combo.area_id || 'null'}`;
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        service_id: combo.service_id,
        city_id: combo.city_id,
        district_id: combo.district_id,
        area_id: combo.area_id,
        partner_ids: []
      });
    }
    locationMap.get(key).partner_ids.push(combo.partners.id);
  }
  
  // Generate/update service_locations for each unique combination
  for (const [key, location] of locationMap) {
    const seoContent = await generateSEOContent(location);
    const structuredData = await generateStructuredData(location);
    
    // Upsert service_location
    // Update service_location_partners junction
  }
}
```

**SEO Content Generation:**

```typescript
function generateSEOContent(location: ServiceLocation, service: Service, city: City, district?: District, area?: Area) {
  const locales = ['no', 'en', 'sv'];
  const content: Record<string, { title: string; meta: string; intro: string }> = {};
  
  for (const locale of locales) {
    const serviceName = service[`name_${locale}`] || service.name;
    const cityName = city[`name_${locale}`] || city.name;
    const districtName = district?.[`name_${locale}`] || district?.name;
    const areaName = area?.[`name_${locale}`] || area?.name;
    
    let locationStr: string;
    if (area) {
      locationStr = `${areaName}, ${districtName}, ${cityName}`;
    } else if (district) {
      locationStr = `${districtName}, ${cityName}`;
    } else {
      locationStr = cityName;
    }
    
    content[locale] = {
      title: `${serviceName} i ${locationStr} - Finn partnere & bestill | Noddi`,
      meta: `Sammenlign ${serviceName.toLowerCase()} i ${locationStr}, se priser, vurderinger og bestill direkte med lokale partnere.`,
      intro: `Mobil ${serviceName.toLowerCase()} i ${locationStr} - med erfarne partnere levert til deg. Finn tilbud, sammenlign priser og bestill i dag.`
    };
  }
  
  return content;
}
```

**Structured Data Generation:**

```typescript
function generateStructuredData(location: ServiceLocation, partners: Partner[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${location.serviceName} i ${location.locationName}`,
    "serviceType": location.serviceName,
    "provider": partners.map(p => ({
      "@type": "LocalBusiness",
      "name": p.name,
      "url": p.website_url,
      "telephone": p.phone,
      ...(p.rating && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": p.rating } })
    })),
    "areaServed": {
      "@type": "City",
      "name": location.cityName
    },
    "url": location.canonical_url
  });
}
```

**Webflow API Localization:**

```typescript
// When syncing localized content
async function syncLocalizedItem(collectionId: string, itemId: string, fieldData: Record<string, unknown>, locale: string) {
  const localeId = LOCALES[locale];
  const response = await rateLimitedFetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items/${itemId}?locale=${localeId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fieldData }),
    }
  );
  // Handle response
}
```

---

## Phase 6: Update Dashboard

### 6.1 Add New Entity Counts

Add stats cards for:
- Service Categories
- Services
- Partner Service Locations
- Service Locations

### 6.2 Update Sync Options

Expand the entity dropdown to include:
- All Entities
- Service Categories
- Services
- Cities
- Districts
- Areas
- Partners
- Service Locations

---

## Phase 7: Update Navigation

Add new sidebar links:

```
Dashboard
---
Cities
Districts
Areas
---
Service Categories
Services
---
Partners
Partner Service Locations
---
Service Locations (read-only)
Sync History
---
Settings
```

---

## Implementation Order

| Step | Description | Type |
|------|-------------|------|
| 1 | Database migration - all new tables and column alterations | Database |
| 2 | Settings page - add new collection IDs and base URL | Frontend |
| 3 | Service Categories management page | Frontend |
| 4 | Services management page | Frontend |
| 5 | Update existing pages (Cities, Districts, Areas, Partners) with new fields | Frontend |
| 6 | Partner Service Locations management page | Frontend |
| 7 | Update webflow-import edge function | Backend |
| 8 | Update webflow-sync edge function with service location generation | Backend |
| 9 | Service Locations view page (read-only) | Frontend |
| 10 | Dashboard updates - new entity counts and sync options | Frontend |
| 11 | Navigation updates | Frontend |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database Migration | Create | All new tables, altered columns, RLS policies |
| `src/pages/Settings.tsx` | Modify | Add 4 new collection ID fields + base URL |
| `src/pages/ServiceCategories.tsx` | Create | Service categories management |
| `src/pages/Services.tsx` | Create | Services management |
| `src/pages/PartnerServiceLocations.tsx` | Create | Partner-service-location relationship management |
| `src/pages/ServiceLocations.tsx` | Create | Read-only computed service locations view |
| `src/pages/Cities.tsx` | Modify | Add shared_key, localized fields, SEO fields |
| `src/pages/Districts.tsx` | Modify | Add shared_key, localized fields, SEO fields |
| `src/pages/Areas.tsx` | Modify | Add shared_key, localized fields, SEO fields |
| `src/pages/Partners.tsx` | Modify | Add all new fields, services multi-select |
| `src/pages/Dashboard.tsx` | Modify | Add new entity counts, expand sync options |
| `supabase/functions/webflow-import/index.ts` | Modify | Handle all new entities, localization, shared_keys |
| `supabase/functions/webflow-sync/index.ts` | Modify | Sync all entities, generate service locations |
| `src/components/layout/Sidebar.tsx` | Modify | Add new navigation links |
| `src/App.tsx` | Modify | Add new routes |

---

## Validation Checklist

### Webflow CMS (Manual - Do First)
- [ ] Create/consolidate Cities collection with all fields
- [ ] Create/consolidate Districts collection with all fields
- [ ] Create/consolidate Areas collection with all fields
- [ ] Update Tjenester (Services) collection with all fields
- [ ] Create Service Categories collection
- [ ] Update Partners collection with all fields
- [ ] Create Service Locations collection
- [ ] Record all 7 collection IDs
- [ ] Enable localization for all collections

### Lovable Database
- [ ] shared_key columns on all entities
- [ ] Localized field columns (name_en, name_sv, etc.)
- [ ] SEO field columns
- [ ] service_categories table
- [ ] services table
- [ ] partner_service_locations table
- [ ] service_locations table
- [ ] All junction tables
- [ ] RLS policies on all new tables

### Sync Functionality
- [ ] Import matches by shared_key
- [ ] Import handles all 3 locales
- [ ] Import populates all junction tables
- [ ] Sync generates service_locations based on partner coverage
- [ ] Sync produces correct SEO content per template
- [ ] Sync generates valid JSON-LD structured data
- [ ] Sync handles canonical URLs correctly
- [ ] Sync publishes localized content to each locale

### Error Handling
- [ ] Logs unmatched references
- [ ] Logs missing required fields
- [ ] Provides sync summary report
- [ ] Does not create duplicates
- [ ] Skips items with missing required references
