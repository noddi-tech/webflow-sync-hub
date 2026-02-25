# Noddi CMS Manager

A Webflow CMS automation platform that manages thousands of SEO-optimized location pages for [Noddi](https://www.noddi.no) — a mobile car care marketplace operating across Norway, Sweden, Germany, Denmark, Finland, and Canada.

---

## Table of Contents

1. [Why This Exists](#why-this-exists)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Database Schema](#database-schema)
5. [Edge Functions](#edge-functions)
6. [The Navio Pipeline](#the-navio-pipeline)
7. [The Webflow Pipeline](#the-webflow-pipeline)
8. [Schema Sync Wizard](#schema-sync-wizard)
9. [SEO Content Generation](#seo-content-generation)
10. [Delivery Checking](#delivery-checking)
11. [Frontend Architecture](#frontend-architecture)
12. [Localization](#localization)
13. [Webflow Field Mapping Reference](#webflow-field-mapping-reference)
14. [Configuration](#configuration)
15. [Authentication & Authorization](#authentication--authorization)
16. [Operational Workflows](#operational-workflows)
17. [Known Limitations & Recent Fixes](#known-limitations--recent-fixes)
18. [Potential Add-ons / Improvement Areas](#potential-add-ons--improvement-areas)

---

## Why This Exists

Noddi delivers car care services (tire changes, car wash, polishing, etc.) to customers' locations across multiple countries. The public website runs on **Webflow** and needs thousands of location-specific pages like *"Dekkskift i Frogner, Oslo"* — each with unique SEO content, structured data, canonical URLs, and localization in three languages (Norwegian, English, Swedish).

Manually managing this in Webflow is impossible at scale. This system automates the entire pipeline:

1. **Ingest** delivery zones from Navio (the operations API)
2. **Enrich** them with AI-discovered neighborhoods and districts
3. **Verify** spatial accuracy with PostGIS
4. **Generate** SEO content, JSON-LD structured data, and canonical URLs
5. **Sync** everything to Webflow CMS with full localization

---

## Architecture Overview

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   Navio API     │──────▶│   Local Database     │──────▶│  Webflow CMS    │
│                 │       │   (PostgreSQL +       │       │                 │
│ Source of truth  │       │    PostGIS)           │       │ Public website  │
│ for delivery    │       │                      │       │ SEO pages       │
│ zones           │       │ Enrichment layer:     │       │ 3 locales       │
│                 │       │ - AI discovery        │       │ (NO, EN, SV)    │
│ Geofence        │       │ - Spatial verification│       │                 │
│ polygons        │       │ - Editorial control   │       │ Structured data │
│                 │       │ - SEO generation      │       │ JSON-LD         │
└─────────────────┘       └──────────────────────┘       └─────────────────┘
```

**Data flow is bidirectional:**
- **Webflow → App** via `webflow-import` (pulls existing CMS items into local DB)
- **App → Webflow** via `webflow-sync` (pushes local data with generated SEO content to CMS)
- **Schema alignment** via `webflow-validate` + `schema-fix` (detects and resolves field mismatches)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS |
| **State Management** | TanStack React Query v5 |
| **Routing** | React Router v6 |
| **Backend** | Supabase — PostgreSQL + PostGIS |
| **Edge Functions** | 7 Deno functions (auto-deployed) |
| **AI** | Gemini 2.5 Flash (via Lovable AI gateway) + OpenAI GPT-4o-mini (parallel calls) |
| **External APIs** | Navio REST API, Webflow CMS API v2, Nominatim (geocoding) |
| **Maps** | Leaflet + React Leaflet |

---

## Database Schema

### Core Geographic Hierarchy

```
Cities (e.g., Oslo, Bergen, Stockholm)
  └── Districts (e.g., Frogner, Grünerløkka, Gamle Oslo)
       └── Areas (e.g., Majorstuen, Bislett, Holmenkollen)
```

#### `cities`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `name`, `name_en`, `name_sv` | text | Localized display names |
| `slug`, `slug_en`, `slug_sv` | text | URL fragments |
| `seo_title`, `seo_title_en`, `seo_title_sv` | text | Page `<title>` tags |
| `seo_meta_description`, `..._en`, `..._sv` | text | Meta descriptions |
| `intro`, `intro_en`, `intro_sv` | text | Rich text content |
| `tagline`, `tagline_en`, `tagline_sv` | text | Short tagline below H1 |
| `short_description` | text | Brief text for cards |
| `country_code` | text | Default `'NO'` |
| `navio_city_key` | text | Navio tracking identifier |
| `is_delivery` | boolean | Active delivery coverage |
| `noindex` | boolean | Search engine indexing control |
| `sitemap_priority` | numeric | Default `0.7` |
| `shared_key` | text | Stable sync identifier |
| `webflow_item_id` | text | Link to Webflow CMS item |

#### `districts`
Same localized field pattern as cities, plus:
| Column | Type | Notes |
|--------|------|-------|
| `city_id` | uuid FK → cities | Parent city (required) |
| `navio_district_key` | text | Navio tracking |
| `sitemap_priority` | numeric | Default `0.6` |

#### `areas`
Same localized field pattern, plus:
| Column | Type | Notes |
|--------|------|-------|
| `district_id` | uuid FK → districts | Parent district (required) |
| `city_id` | uuid FK → cities | Denormalized city reference |
| `navio_service_area_id` | text | Direct link to Navio zone |
| `navio_imported_at` | timestamptz | Last Navio sync timestamp |
| `geofence` | geometry | PostGIS polygon |
| `geofence_center` | geometry | Polygon centroid |
| `geofence_json` | jsonb | GeoJSON representation |
| `geo_verified_status` | text | `verified`, `mismatch`, `not_found` |
| `geo_verified_point` | geometry | Geocoded point used for verification |
| `geo_overlap_percent` | numeric | Overlap % with nearest Navio zone |
| `geo_verified_at` | timestamptz | When spatial verification ran |
| `sitemap_priority` | numeric | Default `0.5` |

### Services

#### `service_categories`
| Column | Type | Notes |
|--------|------|-------|
| `name`, `name_en`, `name_sv` | text | Localized names |
| `slug`, `slug_en`, `slug_sv` | text | URL fragments |
| `description`, `description_en`, `description_sv` | text | Full descriptions |
| `seo_title/meta_description/intro` | text × 3 locales | SEO fields |
| `tagline` × 3 locales | text | Short taglines |
| `icon_url` | text | Visual icon URL |
| `sort_order` | integer | Display order |
| `active` | boolean | Visibility toggle |
| `shared_key`, `webflow_item_id` | text | Sync identifiers |

#### `services`
All fields from `service_categories`, plus:
| Column | Type | Notes |
|--------|------|-------|
| `service_category_id` | uuid FK | Parent category |
| `short_description`, `..._en`, `..._sv` | text | Brief one-liners |
| `service_includes`, `..._en`, `..._sv` | text | Rich text "what's included" |
| `price` | text | Display price |
| `price_from` | text | "From X kr" text |
| `price_first_column`, `..._en`, `..._sv` | text | Tier 1 pricing description |
| `price_second_column`, `..._en`, `..._sv` | text | Tier 2 pricing description |
| `price_third_column`, `..._en`, `..._sv` | text | Tier 3 pricing description |
| `step_1_text`, `..._en`, `..._sv` | text | "How it works" step 1 |
| `step_1_illustration` | text | Step 1 illustration URL |
| `step_2_text/illustration`, `step_3_text/illustration` | text | Steps 2 & 3 |
| `service_type_schema` | text | Schema.org service type |
| `season_product` | boolean | Seasonal availability flag |
| `icon_url`, `sort_order`, `active` | various | Control fields |

### Service Locations (Computed SEO Collection)

The critical table for SEO. Each row = unique **service + location** combination.

#### `service_locations`
| Column | Type | Notes |
|--------|------|-------|
| `service_id` | uuid FK → services | Required |
| `city_id` | uuid FK → cities | Required |
| `district_id` | uuid FK → districts | Optional granularity |
| `area_id` | uuid FK → areas | Optional finest granularity |
| `slug`, `slug_en`, `slug_sv` | text | Computed: `{service}-{city}-{district}-{area}` |
| `canonical_url`, `..._en`, `..._sv` | text | Full canonical URLs per locale |
| `seo_title`, `..._en`, `..._sv` | text | Generated `<title>` tags |
| `seo_meta_description`, `..._en`, `..._sv` | text | Generated meta descriptions |
| `hero_content`, `..._en`, `..._sv` | text | Generated ~200+ word rich text |
| `structured_data_json`, `..._en`, `..._sv` | text | Schema.org JSON-LD |
| `tagline`, `..._en`, `..._sv` | text | Generated taglines |
| `noindex` | boolean | Auto-set when zero active partners |
| `sitemap_priority` | numeric | Varies by granularity level |
| `city_2` | text | Legacy Webflow reference field |
| `webflow_item_id` | text | Webflow CMS item link |

### Partners

#### `partners`
| Column | Type | Notes |
|--------|------|-------|
| `name/slug` × 3 locales | text | Core identity |
| `email`, `phone`, `address` | text | Contact info |
| `website_url`, `facebook_url`, `instagram_url` | text | Social/web links |
| `description`, `..._en`, `..._sv` | text | Rich text from Webflow `client-information` |
| `description_summary` | text | From `client-information-summary` |
| `heading_text`, `heading_text_2` | text | Custom heading texts |
| `logo_url`, `noddi_logo_url` | text | Branding (extracted from Webflow Image objects) |
| `rating` | numeric | Partner rating |
| `active` | boolean | From Webflow `partner-active` |
| `seo_title/meta_description/intro/tagline` × 3 locales | text | SEO fields |
| `shared_key`, `webflow_item_id` | text | Sync identifiers |

**Note:** Webflow uses the slug `twitter-link` for what is actually the Instagram URL field. The import maps `twitter-link` → `instagram_url`.

### Junction Tables (Partner Coverage)

| Table | Columns | Purpose |
|-------|---------|---------|
| `partner_cities` | `partner_id`, `city_id` | Cities where partner operates |
| `partner_districts` | `partner_id`, `district_id` | Districts covered |
| `partner_areas` | `partner_id`, `area_id` | Areas covered |
| `partner_services` | `partner_id`, `service_id` | Services offered |
| `partner_service_locations` | `partner_id`, `service_id`, `city_id`, `district_id?`, `area_id?`, `price_info`, `duration_info`, `is_delivery`, `metadata` | Granular coverage mapping — the source for computing `service_locations` |
| `service_location_partners` | `service_location_id`, `partner_id` | Computed junction linking service_locations ↔ partners |

### Staging Tables (Navio Pipeline)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `navio_staging_cities` | `name`, `country_code`, `batch_id`, `status`, `committed_city_id` | Cities awaiting approval |
| `navio_staging_districts` | `name`, `staging_city_id`, `source`, `batch_id`, `committed_district_id` | AI-discovered districts |
| `navio_staging_areas` | `name`, `original_name`, `staging_district_id`, `navio_service_area_id`, `source`, `committed_area_id` | Both Navio-sourced and AI-discovered areas |
| `navio_import_queue` | `city_name`, `country_code`, `batch_id`, `status`, `navio_areas` (jsonb), `discovered_hierarchy` (jsonb), `districts_processed`, `districts_discovered`, `neighborhoods_discovered` | Per-city processing queue with checkpoint state |
| `navio_snapshot` | `navio_service_area_id` (integer), `name`, `display_name`, `city_name`, `country_code`, `geofence_json`, `geofence_hash`, `is_active`, `snapshot_at` | Point-in-time Navio API state for delta detection |
| `navio_operation_log` | `operation_type`, `batch_id`, `status`, `details` (jsonb), `started_at`, `completed_at` | Audit trail of all pipeline operations |

### System Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `settings` | `key`, `value` | Key-value config store (collection IDs, base URL, pipeline state, schema overrides) |
| `sync_logs` | `entity_type`, `operation`, `status`, `batch_id`, `current_item`, `total_items`, `message` | Detailed sync progress tracking |
| `system_health` | `check_type`, `status`, `results` (jsonb), `summary` (jsonb), `triggered_by` | Stored health check results |
| `user_roles` | `user_id`, `role` (enum: `admin`) | RBAC access control |

### RLS Policy Pattern

All tables (except `spatial_ref_sys`, `geography_columns`, `geometry_columns`) use **restrictive** RLS policies requiring admin role:

```sql
-- Pattern applied to all CRUD operations per table:
USING (has_role(auth.uid(), 'admin'::app_role))
-- or for INSERT:
WITH CHECK (has_role(auth.uid(), 'admin'::app_role))
```

Notable exceptions:
- `partner_areas`, `partner_cities`, `partner_districts`, `partner_services`, `service_location_partners`: No UPDATE policy (delete + re-insert pattern)
- `sync_logs`, `system_health`: No UPDATE or DELETE policies (append-only)
- `user_roles`: SELECT only (managed outside the app)
- `settings`: No DELETE policy

---

## Edge Functions

All 7 edge functions are Deno-based, auto-deployed, and configured with `verify_jwt = false` (they handle auth internally).

### 1. `navio-import` (~3,518 lines)

The largest function. A multi-stage pipeline that transforms raw Navio delivery zones into a rich geographic hierarchy with AI-discovered neighborhoods.

**Stages:** `initialize`, `process_city`, `finalize`, `commit`, `commit_incremental`, `coverage_check`, `coverage_check_deep`

**Request:** `POST` with `{ stage: string, ... }` — see [The Navio Pipeline](#the-navio-pipeline) for details.

**Auth:** Bearer token + `has_role()` admin check.

**Key constants:**
- `DEADLINE_MS = 45_000` — Time budget per invocation (leaves 15s buffer before 60s timeout)
- `AI_CALL_TIMEOUT_MS = 20_000` — Per-AI-call timeout

### 2. `webflow-sync` (~1,549 lines)

Pushes local database to Webflow CMS. Handles two distinct operations:
1. **Service Location generation** — Computes `service_locations` from `partner_service_locations` with full SEO content
2. **Per-entity Webflow sync** — Creates/updates CMS items with localized content

**Request:** `POST` with `{ entity_type: string, batch_id?: string, offset?: number, limit?: number }`

**Key features:**
- Chunked processing via `offset`/`limit` parameters
- `buildLocalizedFields()` maps DB fields to Webflow slugs with `_en`/`_sv` suffix detection
- Generates SEO titles, meta descriptions, ~200-word rich text intros, canonical URLs, JSON-LD
- Service-specific content templates (dekkskift, bilvask, polering, default)
- Pre-sync validation blocks items missing critical fields
- Progress tracking via `sync_logs` with `batch_id`

**Rate limiting:** 900ms delay between API calls, exponential backoff on 429 (up to 5 retries).

### 3. `webflow-import` (~739 lines)

Pulls existing CMS items from Webflow into the local database.

**Request:** `POST` with `{ entity_type?: string, batch_id?: string }`

**Process:**
1. For each entity type in dependency order: `service_categories → services → cities → districts → areas → partners`
2. Calls `fetchLocalizedItems()` which fetches items from all 3 Webflow locales
3. Merges locale data into a single record per item
4. Upserts into local DB, matching first by `shared_key`, then by `webflow_item_id`
5. For partners: also syncs junction tables (`partner_areas`, `partner_cities`, `partner_services`)

**Locale fetching:** Each collection requires 3 separate Webflow API calls (one per locale), paginated at 100 items per page.

### 4. `webflow-validate` (~870 lines)

Compares expected field schemas against actual Webflow collection fields. Three check types:

1. **Schema validation** — Expected vs actual fields per collection. Reports missing, extra, and missing-required fields.
2. **Data completeness** — Counts records with filled SEO fields and localized names across all entity tables.
3. **SEO quality** — Checks for duplicate titles, short intros (<100 chars), invalid JSON-LD, noindex pages with partners, missing canonical URLs. Produces a 0-100 score.

**Dynamic overrides:** Reads `schema_expected_overrides` from the `settings` table and merges with the hardcoded `EXPECTED_FIELDS` list. This allows `schema-fix` to update expectations without code changes.

**Request:** `POST` with `{ store_results?: boolean, triggered_by?: string }`

When `store_results: true`, results are stored in the `system_health` table.

### 5. `webflow-health-cron` (~55 lines)

Lightweight cron wrapper that calls `webflow-validate` with `{ store_results: true, triggered_by: "cron" }`. Designed for scheduled automated health checks.

**Auth:** Uses `SUPABASE_SERVICE_ROLE_KEY` — no user auth required (meant for cron triggers).

### 6. `schema-fix` (~215 lines)

Applies database schema changes based on Webflow field mismatches detected by the Schema Wizard.

**Request:** `POST` with `{ changes: Array<{ id, collection, type, fieldSlug, fieldType, oldFieldSlug? }> }`

**Change types:**
- `added` → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (+ `_en`/`_sv` for localized types). Uses the `exec_sql` RPC.
- `removed` → Updates `schema_expected_overrides` in settings (does NOT drop columns).
- `renamed` → `ALTER TABLE ... RENAME COLUMN` (+ localized variants). Updates overrides.

**Type mapping:** `PlainText`/`RichText` → `text`, `Number` → `numeric`, `Switch` → `boolean`.

**Audit:** Stores `last_schema_fix` in settings with timestamp and results.

### 7. `check-delivery` (~78 lines)

Public endpoint (no auth required). Checks if coordinates fall within a Noddi delivery zone.

**Request:** `POST` with `{ lng: number, lat: number }`

**Response:**
```json
{
  "delivers": true,
  "coordinates": { "lng": 10.7522, "lat": 59.9139 },
  "areas": [{ "area_id": "uuid", "area_name": "Frogner", "district_name": "...", "city_name": "Oslo" }],
  "message": "We deliver to this location! Found in 1 delivery area(s)."
}
```

Uses the PostgreSQL function `find_delivery_areas(lng, lat)` which performs `ST_Contains()` checks against area geofence polygons.

---

## The Navio Pipeline

### Stage 1: `initialize`

Fetches all service areas from the Navio API (`/v1/service-areas/for-landing-pages/`).

**Name parsing** supports 5 patterns across 6 countries:
1. `"Country City Area"` — e.g., `"Norway Oslo Frogner"`
2. `"Country Area"` — e.g., `"Germany München"`
3. `"City Country Area"` — e.g., `"Oslo Norway Majorstuen"`
4. Internal codes — e.g., `"NO OSL 123"` (mapped via code→city lookup)
5. Simple `"City Area"` — fallback pattern

Each country has native terminology configured (Norwegian: bydel/nabolag, Swedish: stadsdel/grannskap, German: Stadtbezirk/Nachbarschaft, etc.).

**Filters out** test data and street addresses using regex patterns.

**Groups** areas by city and queues each city in `navio_import_queue` for processing.

### Stage 2: `process_city`

For each queued city, uses **parallel AI calls** (Gemini + OpenAI simultaneously) to discover:

1. **Districts** — Official administrative divisions (e.g., Oslo's 15 bydeler)
2. **Neighborhoods** — Named residential areas within each district (15-30 per district)

Key features:
- **Time-budgeted**: 45-second deadline per function call, stops mid-district if needed
- **Per-district checkpointing**: Progress saved to `navio_import_queue.discovered_hierarchy` after every district, so processing can resume exactly where it left off
- **Parallel AI**: Both Gemini and OpenAI are called simultaneously; results are merged and deduplicated with Unicode normalization (`NFD` + strip diacritics for dedup keys, but preserves original characters like æ, ø, å)
- **Native language prompts**: AI prompts use the correct local terminology and character sets

### Stage 3: `finalize`

After all cities are processed:
1. Classifies each area as either **Navio-sourced** (direct from API) or **AI-discovered** (found by neighborhood discovery)
2. Writes to staging tables (`navio_staging_cities`, `navio_staging_districts`, `navio_staging_areas`)
3. Sets `status = 'pending'` for human review

### Stage 4: `commit` / `commit_incremental`

Moves approved staging data to production tables:
- **Deduplication**: Matches against existing records using Unicode-normalized, lowercased, stripped-of-special-characters comparisons
- **Upsert logic**: Creates new cities/districts/areas or links staging records to existing ones via `committed_city_id`, `committed_district_id`, `committed_area_id`
- **`commit_incremental`**: Processes one city at a time for safer, resumable commits

### Stage 5: `coverage_check`

Validates production data against the live Navio API:
- Fetches current Navio snapshot
- Compares against `navio_snapshot` table for **delta detection** (new zones, removed zones, changed geofences via hash comparison)
- Checks for **orphaned areas** (in production but not in Navio)
- Updates `navio_snapshot` with current state
- Uses `fetchAllRows()` helper to paginate past Supabase's 1,000-row limit

### Stage 6: `coverage_check_deep`

Spatial verification using PostGIS — the most computationally intensive stage:

1. **Selects** AI-discovered areas without Navio linkage (or with `geo_verified_status = null`)
2. **Geocodes** each area via Nominatim: `https://nominatim.openstreetmap.org/search?q={area}, {city}`
3. **Point-in-zone check**: Uses PostGIS `check_point_best_navio_zone()` to find which Navio zone contains the geocoded point
4. **Polygon overlap**: If geofence data exists, uses `check_area_navio_overlap()` for precise polygon intersection
5. **90% threshold**: Areas with ≥90% overlap are linked to the Navio zone and marked `is_delivery = true`
6. **Reassignment**: Areas in the wrong zone get reassigned to the correct one
7. **Deactivation**: Areas not found in any zone get `is_delivery = false`

Processing constraints:
- **10 areas per batch** (reduced from 25 to prevent browser timeouts)
- **1.1s delay** between Nominatim calls (rate limiting)
- **25-second time guard** per batch
- Progress saved to `settings` table after each batch for resilient auto-looping
- **Auto-retry**: Frontend polls `settings` for progress if a batch request times out

---

## The Webflow Pipeline

### Import (`webflow-import`)

**Import order** (dependency-based): `service_categories → services → cities → districts → areas → partners`

For each entity:
1. Fetches items from all 3 locales using `fetchLocalizedItems()` (3 paginated API calls per collection)
2. Merges locale data into a `LocalizedRecord` with `{ no: {...}, en: {...}, sv: {...} }` structure
3. Maps Webflow field slugs to database columns (e.g., `seo-title` → `seo_title`, `intro-content` → `intro`)
4. Upserts into local DB: first tries matching by `shared_key`, then by `webflow_item_id`
5. For partners: syncs junction tables by resolving Webflow multi-reference IDs to local UUIDs

**Image handling**: Uses `getImageUrl()` to extract URLs from Webflow Image field objects (which can be strings or `{ url: string }` objects).

### Sync (`webflow-sync`)

**Sync order**: `service_categories → services → cities → districts → areas → partners → service_locations`

For each entity type (except service_locations):
1. Reads local records with chunked pagination (`offset`/`limit`)
2. Builds localized field data using `buildLocalizedFields()`
3. Creates or updates items in Webflow (matched via `webflow_item_id`)
4. Writes localized content for EN and SV as separate API calls per item
5. Logs progress to `sync_logs` with `batch_id`

For service_locations (special handling):
1. **Generates** service locations from `partner_service_locations` — groups by unique `service_id + city_id + district_id + area_id` combinations
2. For each combination, generates SEO content, canonical URLs, slugs, JSON-LD, taglines
3. Sets `noindex = true` for combinations with zero active partners
4. Upserts into `service_locations` table
5. Rebuilds `service_location_partners` junction table
6. Then syncs all service_locations to Webflow CMS

### Validate (`webflow-validate`)

**Three check types:**

1. **Collection schema validation**: Compares hardcoded `EXPECTED_FIELDS` (merged with `schema_expected_overrides` from settings) against actual Webflow collection fields. Reports:
   - Missing in Webflow (expected but not found)
   - Extra in Webflow (found but not expected)
   - Missing required fields

2. **Data completeness**: For each entity table, counts records with filled `seo_title`, `seo_meta_description`, `intro`, `name_en`, `name_sv`. Reports percentages.

3. **SEO quality scoring** (0-100): Checks `service_locations` for:
   - Duplicate SEO titles
   - Duplicate meta descriptions
   - Invalid JSON-LD (malformed JSON)
   - Short intro content (<100 characters)
   - Noindex pages that have partners (should be indexed)
   - Missing canonical URLs

---

## Schema Sync Wizard

A 3-step UI at `/schema-wizard` that automates Webflow schema alignment:

### Step 1: Detect
Calls `webflow-validate` and displays mismatches between Webflow's actual collection fields and the app's expected fields.

### Step 2: Resolve
User reviews each mismatch and classifies it as:
- **Added** — New field in Webflow, needs a database column
- **Removed** — Field removed from Webflow, stop expecting it
- **Renamed** — Field slug changed, rename the database column

### Step 3: Apply
Calls `schema-fix` which:
1. Executes `ALTER TABLE` statements via the secure `exec_sql` RPC (for added/renamed fields)
2. Updates `schema_expected_overrides` in the settings table
3. Subsequent health checks reflect the applied fixes

**Key database function:**
```sql
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN EXECUTE sql_query; END; $$;
-- Only callable by service role
REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
```

---

## SEO Content Generation

### Service-Specific Templates

The sync function uses service-specific content variations:

| Service Slug | Content Focus |
|-------------|---------------|
| `dekkskift` | Tire change and tire hotel services |
| `bilvask` | Car wash and car care |
| `polering` | Polishing and paint protection |
| `default` | Generic professional services |

Each template provides localized `serviceDesc` and `callToAction` strings in NO, EN, and SV.

### Rich Text Intro Structure (~200+ words)

```html
<h2>Mobil {service} i {location}</h2>
<p>Introduction paragraph with service description...</p>

<h3>Hvorfor velge Noddi?</h3>
<p>Platform benefits, partner count...</p>

<h3>Hvordan det fungerer</h3>
<p>Step-by-step booking process...</p>

<h3>Kvalitet og trygghet</h3>
<p>Quality assurance, call to action...</p>
```

### Canonical URL Pattern

```
{base_url}/{locale_prefix}/{service-slug}/{city-slug}/{district-slug}/{area-slug}
```

- Norwegian (default): no locale prefix
- English: `/en/` prefix
- Swedish: `/sv/` prefix
- `base_url` from Settings (e.g., `https://www.noddi.no`)

### JSON-LD Structured Data

Each Service Location gets Schema.org structured data with:
- `@type: "Service"` with `serviceType` and `description`
- `provider[]` — Up to 10 `LocalBusiness` entries with name, rating, URL
- `areaServed` — Nested `AdministrativeArea` → `City` hierarchy
- `offers` — `AggregateOffer` with partner count and availability
- `url` — Canonical URL for the locale

### Noindex & Sitemap Controls

- Pages with **zero active partner coverage** → `noindex = true`
- Sitemap priority by granularity: city-level `0.6`, district `0.5`, area `0.4`
- Noindex pages get `sitemap_priority = 0.1`

---

## Delivery Checking

**Edge Function:** `check-delivery` — the only public (unauthenticated) endpoint.

Uses PostGIS `find_delivery_areas(lng, lat)` which performs `ST_Contains()` checks against all area geofence polygons where `is_delivery = true`.

Returns matching areas with their full geographic hierarchy (area → district → city).

---

## Frontend Architecture

### Routing

All authenticated routes are wrapped in `<DashboardLayout>` which enforces admin-only access.

| Route | Page Component | Purpose |
|-------|---------------|---------|
| `/login` | `Login` | Email/password auth |
| `/dashboard` | `Dashboard` | Overview with system health panel |
| `/cities` | `Cities` | CRUD for cities |
| `/districts` | `Districts` | CRUD for districts |
| `/areas` | `Areas` | CRUD for areas |
| `/service-categories` | `ServiceCategories` | CRUD for categories |
| `/services` | `Services` | CRUD with pricing + steps |
| `/partners` | `Partners` | CRUD with coverage mappings |
| `/partner-service-locations` | `PartnerServiceLocations` | Granular partner coverage management |
| `/service-locations` | `ServiceLocations` | View computed SEO pages |
| `/webflow/import` | `WebflowImport` | Pull from Webflow |
| `/webflow/sync` | `WebflowSync` | Push to Webflow with progress tracking |
| `/schema-wizard` | `SchemaWizard` | 3-step schema alignment |
| `/navio` | `NavioDashboard` | Staging review, operations, coverage |
| `/sync-history` | `SyncHistory` | Sync log viewer |
| `/settings` | `Settings` | Collection IDs, base URL config |
| `/` | Redirect → `/dashboard` | |

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DashboardLayout` | `src/components/layout/` | Auth guard + sidebar layout |
| `Sidebar` | `src/components/layout/` | Navigation with collapsible sections |
| `EntityTable` | `src/components/entities/` | Reusable CRUD table |
| `SystemHealthPanel` | `src/components/health/` | Collection health, data completeness, SEO quality cards |
| `NavioStagingTab` | `src/components/navio/` | Staging data review |
| `OperationHistoryTable` | `src/components/navio/` | Pipeline audit log |
| `CoverageHealthCard` | `src/components/navio/` | Navio coverage statistics |
| `DeliveryAreaMap` | `src/components/map/` | Leaflet map for delivery zones |
| `DeltaResultsPanel` | `src/components/sync/` | Pre-sync change preview |
| `SyncProgressDialog` | `src/components/sync/` | Real-time sync progress |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Session management, admin role check via `has_role()` RPC |
| `useNavioImport` | Navio pipeline stage execution |
| `useNavioPipelineStatus` | Pipeline state polling |
| `useNavioOperationLog` | Operation history queries |
| `useProductionData` | Production data queries for Navio dashboard |

---

## Localization

### Three Locales

| Locale | Language | Webflow Locale ID | URL Prefix |
|--------|----------|-------------------|------------|
| NO | Norwegian (default) | `64e4857c2f099414c700c890` | *(none)* |
| EN | English | `66f270e0051d1b43823c01d9` | `/en/` |
| SV | Swedish | `66f270e0051d1b43823c01da` | `/sv/` |

### Field Naming Convention

Database columns use `_en` and `_sv` suffixes. The base (no suffix) is always Norwegian:

```
name        → Norwegian
name_en     → English
name_sv     → Swedish
```

This applies to: `name`, `slug`, `seo_title`, `seo_meta_description`, `intro`, `tagline`, `description`, `short_description`, `hero_content`, `canonical_url`, `structured_data_json`, pricing columns, step texts, `service_includes`.

### `buildLocalizedFields()` Pattern

Maps DB fields to Webflow slugs and automatically checks for `_en`/`_sv` suffixed columns:

```typescript
function buildLocalizedFields(item, fieldMappings) {
  // For each mapping { dbField: webflowSlug }:
  // result.no[webflowSlug] = item[dbField]
  // result.en[webflowSlug] = item[dbField + "_en"]
  // result.sv[webflowSlug] = item[dbField + "_sv"]
  return { no: {...}, en: {...}, sv: {...} };
}
```

---

## Webflow Field Mapping Reference

### Naming Conventions

| Pattern | Example | Reason |
|---------|---------|--------|
| `-2` suffix | `city-3`, `seo-title-2`, `district-2` | Webflow auto-appends when field names conflict across collections |
| `shared-key-{entity}` | `shared-key-city`, `shared-key-district`, `shared-key-service-location-2` | Stable sync identifiers unique per collection |
| Dash-separated | `seo-meta-description`, `intro-content` | Webflow slug normalization |
| `---` triple dash | `price---first-column-description`, `step-1---text` | Webflow convention for nested field groups |

### Key Reference Fields

| Collection | Field Slug | Links To | Type |
|-----------|------------|----------|------|
| Cities | `districts-2` | Districts | ItemRefSet |
| Cities | `areas-2` | Areas | ItemRefSet |
| Districts | `city` | Cities | ItemRef |
| Districts | `areas-2` | Areas | ItemRefSet |
| Areas | `district` | Districts | ItemRef |
| Areas | `city-3` | Cities | ItemRef |
| Service Locations | `service` | Services | ItemRef |
| Service Locations | `city-3` | Cities | ItemRef |
| Service Locations | `district-2` | Districts | ItemRef |
| Service Locations | `area-2` | Areas | ItemRef |
| Service Locations | `partners-2` | Partners | ItemRefSet |
| Partners | `primary-city` | Cities | ItemRefSet |
| Partners | `service-areas-optional` | Areas | ItemRefSet |
| Partners | `services-provided` | Services | ItemRefSet |

### Webflow ↔ DB Field Slug Mapping (Selected)

| Webflow Slug | DB Column | Notes |
|-------------|-----------|-------|
| `name` | `name` | Auto-localized |
| `slug` | `slug` | Auto-localized |
| `seo-title` / `seo-title-2` | `seo_title` | `-2` for service_locations |
| `seo-meta-description` / `-2` | `seo_meta_description` | |
| `intro-content` / `hero-intro-content-2` | `intro` / `hero_content` | |
| `canonical-path-2` | `canonical_url` | Service locations only |
| `json-ld-structured-data-2` | `structured_data_json` | Service locations only |
| `sitemap-priority` / `-2` | `sitemap_priority` | |
| `noindex` / `noindex-2` | `noindex` | |
| `is-delivery` | `is_delivery` | Areas only |
| `client-information` | `description` | Partners |
| `client-information-summary` | `description_summary` | Partners |
| `client-logo` | `logo_url` | Image → URL extraction |
| `noddi-logo` | `noddi_logo_url` | Image → URL extraction |
| `phone-number` | `phone` | Partners |
| `website-link` | `website_url` | Partners |
| `facebook-link` | `facebook_url` | Partners |
| `twitter-link` | `instagram_url` | **Legacy slug, actually Instagram** |
| `partner-active` | `active` | Partners |
| `service-intro-seo` | `intro` | Services (different slug than other entities) |
| `service-includes` | `service_includes` | Services |
| `price---first-column-description` | `price_first_column` | Services |
| `step-1---text` | `step_1_text` | Services |
| `step-1---illustration` | `step_1_illustration` | Services (URL string, not Image) |
| `service-type-schema` | `service_type_schema` | Services |
| `season-product` | `season_product` | Services |

---

## Configuration

### Settings Table Keys

| Key | Purpose | Example Value |
|-----|---------|---------------|
| `base_url` | Base URL for canonical links | `https://www.noddi.no` |
| `webflow_cities_collection_id` | Webflow collection ID | `64e485...` |
| `webflow_districts_collection_id` | Webflow collection ID | |
| `webflow_areas_collection_id` | Webflow collection ID | |
| `webflow_service_categories_collection_id` | Webflow collection ID | |
| `webflow_services_collection_id` | Webflow collection ID | |
| `webflow_partners_collection_id` | Webflow collection ID | |
| `webflow_service_locations_collection_id` | Webflow collection ID | |
| `schema_expected_overrides` | JSON: dynamic field override list | `{"cities":{"added":[],"removed":[],"renamed":{}}}` |
| `last_schema_fix` | JSON: audit log of last schema fix | |
| `navio_pipeline_state` | Current pipeline state | |
| `deep_verify_progress` | Progress state for coverage_check_deep | |

### Environment Variables / Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `NAVIO_API_TOKEN` | `navio-import` | Navio REST API auth |
| `WEBFLOW_API_TOKEN` | `webflow-import`, `webflow-sync`, `webflow-validate` | Webflow CMS API v2 |
| `OPENAI_API_KEY` | `navio-import` | GPT-4o-mini for parallel neighborhood discovery |

The Lovable AI gateway key is automatically available for Gemini calls (no secret needed).

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in all edge functions.

---

## Authentication & Authorization

- **Auth method:** Email/password via Supabase Auth
- **Role check:** `has_role(_user_id, _role)` RPC function
- **Admin-only:** All write operations require `admin` role
- **Edge functions:** Verify auth via Bearer token → `getUser()` → `has_role()` check
- **Exception:** `check-delivery` is public (uses service role key, no user auth)
- **Frontend guard:** `DashboardLayout` checks `useAuth()` → redirects to `/login` if not authenticated, shows "Access Denied" if not admin

---

## Operational Workflows

### Initial Setup

```
Configure Settings (Collection IDs + Base URL)
    ↓
Import from Webflow (pulls existing CMS data)
    ↓
Run Navio Import → Initialize (fetches delivery zones)
    ↓
Process Cities (AI discovers districts & neighborhoods)
    ↓
Finalize (saves to staging tables)
    ↓
Review Staging (human approval in Navio Dashboard)
    ↓
Commit (moves to production tables)
    ↓
Sync to Webflow (generates SEO content + pushes)
```

### Adding a New City

1. **Coverage Check** detects new zones in Navio API
2. **Initialize** fetches updated data, queues the new city
3. **Process City** discovers districts and neighborhoods via AI
4. **Finalize** → staging tables
5. **Review** in Navio Dashboard — verify AI-discovered locations
6. **Commit** to production
7. **Sync** generates SEO pages and pushes to Webflow

### Ongoing Maintenance

```
Coverage Check (detects changes vs. snapshot)
    ↓
Deep Verify (spatial validation of AI-discovered areas)
    ↓ Areas verified → keep with is_delivery = true
    ↓ Areas mismatched → reassign to correct zone
    ↓ Areas not found → deactivate (is_delivery = false)
    ↓
Sync to Webflow (updates noindex flags, content)
```

### Schema Drift Resolution

```
Run Schema Sync Wizard (Webflow → Schema Sync in sidebar)
    ↓
Detect differences between Webflow and app
    ↓
Classify: added / removed / renamed
    ↓
Apply fixes (database columns + override settings)
    ↓
Health check auto-updates
```

---

## Known Limitations & Recent Fixes

1. **Memory limits**: Edge functions have limited memory. The `webflow-sync` function processes items in chunks (`offset`/`limit`) to avoid OOM. Service location generation fetches all reference data at once but processes items sequentially.

2. **Sequential per-collection sync**: Collections must be synced in dependency order (categories before services, cities before districts, etc.) because Webflow references require the target item to exist first.

3. **Nominatim rate limiting**: Deep verification uses 1.1s delays between geocoding calls and processes only 10 areas per batch to stay under rate limits.

4. **AI checkpoint resumption**: The `process_city` stage saves progress per-district to `discovered_hierarchy` in `navio_import_queue`. If a function times out, the frontend can call it again and processing resumes from the last completed district.

5. **Webflow `-2`/`-3` suffix quirk**: When multiple collections have similarly-named fields, Webflow auto-appends numeric suffixes to slugs. These are hardcoded in `EXPECTED_FIELDS` and field mappings. If Webflow changes these, the Schema Wizard can detect and resolve the mismatch.

6. **`twitter-link` → Instagram**: Webflow's field slug says "twitter-link" but the display name is "Instagram Link". The import correctly maps this to `instagram_url`.

7. **1000-row query limit**: Supabase defaults to returning max 1000 rows. The `navio-import` function uses a `fetchAllRows()` helper that paginates. Other functions should be aware of this limit when querying large tables.

---

## Potential Add-ons / Improvement Areas

1. **Automated sync scheduling**: Currently manual. Could add cron-triggered sync with delta detection to only push changed items.

2. **Bulk SEO content regeneration**: When content templates change, there's no way to regenerate all service location content without a full sync. A targeted "regenerate content" action would help.

3. **Partner onboarding automation**: Currently `partner_service_locations` are managed manually. Could auto-generate from `partner_cities` × `partner_services` combinations.

4. **Multi-language AI prompts**: The Navio AI discovery uses English prompts even for non-English cities. Could improve accuracy by prompting in the native language.

5. **Webflow publish integration**: The sync creates/updates items as drafts. A "publish all" step via Webflow API could complete the pipeline.

6. **Rollback mechanism**: No way to undo a sync or Navio commit. Snapshot-based rollback could provide safety.

7. **Real-time dashboard stats**: The dashboard could show live counts (total cities, areas, service locations, coverage %) using Supabase realtime subscriptions.

8. **Improved error recovery**: When a sync partially fails (e.g., Webflow API error mid-batch), there's no automatic retry mechanism for individual failed items.

9. **Schema-fix for type changes**: Currently `schema-fix` handles added/removed/renamed fields but not type changes (e.g., `PlainText` → `RichText`).

10. **Service location cleanup**: Orphaned service locations (where the underlying partner coverage no longer exists) are not automatically removed.
