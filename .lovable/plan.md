

# Complete Collection Field Parity Audit

## Summary

After a full review of all 7 collections, I found several gaps between what Webflow expects, what the database has, and what the UI form supports. Here's the complete analysis:

## Collection Analysis

### 1. Cities

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Missing `noindex` | Has: name, slug, seo_title, seo_meta_description, intro, sitemap_priority, is_delivery (all localized). Missing: `noindex` column |
| **UI Form** | Missing `noindex` toggle | Form has all SEO fields but no noindex toggle |
| **Webflow Expected** | Matches well | Expects: name, slug, seo-title, seo-meta-description, intro-content, sitemap-priority, noindex |

**Gaps to fix:**
- Add `noindex` boolean column to database
- Add `noindex` toggle to Cities form UI

---

### 2. Districts

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Missing `noindex` | Has all localized fields. Missing: `noindex` column |
| **UI Form** | Missing `noindex` toggle | Form complete except noindex |
| **Webflow Expected** | Matches well | Same as Cities |

**Gaps to fix:**
- Add `noindex` boolean column to database
- Add `noindex` toggle to Districts form UI

---

### 3. Areas

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Missing `noindex` | Has all localized fields including is_delivery. Missing: `noindex` column |
| **UI Form** | Missing `noindex` toggle | Form complete except noindex |
| **Webflow Expected** | Complete | Expects is-delivery and noindex |

**Gaps to fix:**
- Add `noindex` boolean column to database
- Add `noindex` toggle to Areas form UI

---

### 4. Service Categories

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Complete | Has: name, slug, description, seo_title, seo_meta_description, intro, icon_url, sort_order, active (all localized) |
| **UI Form** | Complete | All fields present in tabbed UI |
| **Webflow Expected** | Complete | icon, sort-order, active, services reference |

**Status: COMPLETE - No changes needed**

---

### 5. Services

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Complete | Has all localized fields, category reference, icon, sort_order, active |
| **UI Form** | Complete | All fields present |
| **Webflow Expected** | Complete | service-category, description, service-intro-seo, icon, sort-order, active |

**Status: COMPLETE - No changes needed**

---

### 6. Partners

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Recently Updated | Now has seo_title, seo_meta_description, intro (all localized) |
| **UI Form** | Recently Updated | Now includes SEO fields and coverage selectors (cities, districts, areas, services) |
| **Webflow Expected** | Mostly Complete | client-information, client-information-summary, heading-text, logos, contact info, SEO fields, primary-city, service-areas-optional, services-provided |

**Status: COMPLETE - Recent changes covered this**

---

### 7. Service Locations

| Category | Status | Details |
|----------|--------|---------|
| **Database** | Complete | Has all fields: slug, canonical_url, seo_title, seo_meta_description, hero_content, structured_data_json, sitemap_priority, noindex (all localized) |
| **UI Form** | Read-Only | Computed entity - no form needed |
| **Webflow Expected** | Complete | service, city-2, district-2, area-2, partners-2, seo-title-2, hero-intro-content-2, json-ld-structured-data-2, canonical-path-2, noindex-2 |

**Status: COMPLETE - Computed entity, read-only**

---

## Required Changes

### Phase 1: Database Migration - Add `noindex` to Geographic Entities

```sql
ALTER TABLE cities ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;
```

### Phase 2: UI Updates - Add `noindex` Toggle

Update the following files to add a `noindex` toggle:
1. `src/pages/Cities.tsx` - Add noindex to form data and toggle in UI
2. `src/pages/Districts.tsx` - Add noindex to form data and toggle in UI
3. `src/pages/Areas.tsx` - Add noindex to form data and toggle in UI

Each will need:
- Add `noindex: boolean` to the form data interface
- Add toggle in the form next to other control switches
- Include in payload for create/update mutations
- Map from entity when opening edit dialog

### Visual Layout for noindex Toggle

```
+-----------------------------------------------+
| Control Fields                                 |
+-----------------------------------------------+
| [Sitemap Priority: 0.7] [is_delivery toggle]  |
|                         [noindex toggle]       |
+-----------------------------------------------+
```

### Phase 3: Update webflow-validate EXPECTED_FIELDS

Update the validation function to include `noindex` for Cities and Districts (currently only Areas has is-delivery in Webflow, but all three need noindex in our app).

---

## Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Add `noindex` column to cities, districts, areas tables |
| `src/pages/Cities.tsx` | Add noindex to form interface, add toggle, update mutations |
| `src/pages/Districts.tsx` | Add noindex to form interface, add toggle, update mutations |
| `src/pages/Areas.tsx` | Add noindex to form interface, add toggle, update mutations |
| `supabase/functions/webflow-validate/index.ts` | Already correct for Webflow expectations |

---

## Complete Field Matrix After Changes

| Collection | Core Fields | SEO Fields | Control Fields | References | Status |
|------------|-------------|------------|----------------|------------|--------|
| **Cities** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | sitemap_priority, is_delivery, **noindex** | districts, areas | Will be complete |
| **Districts** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | sitemap_priority, is_delivery, **noindex** | city, areas | Will be complete |
| **Areas** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | sitemap_priority, is_delivery, **noindex** | district, city | Will be complete |
| **Service Categories** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | sort_order, active, icon_url | services | Complete |
| **Services** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | sort_order, active, icon_url | service_category | Complete |
| **Partners** | name, slug (localized) | seo_title, seo_meta_description, intro (localized) | active, rating, heading_text, logos, contact | services, areas, cities, districts | Complete |
| **Service Locations** | slug, canonical_url (localized) | seo_title, seo_meta_description, hero_content, structured_data_json (localized) | sitemap_priority, noindex | service, city, district, area, partners | Complete |

---

## Expected Outcome

After implementation:
1. All geographic entities (Cities, Districts, Areas) will have full `noindex` control
2. The System Health panel will show all collections as "Ready"
3. Webflow sync can properly set noindex flags on pages that shouldn't be indexed
4. Full schema parity between our app and Webflow CMS

