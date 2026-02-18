# Noddi CMS Manager

A Webflow CMS automation platform that manages thousands of SEO-optimized location pages for [Noddi](https://www.noddi.no) — a mobile car care marketplace operating across Norway, Sweden, Germany, Denmark, Finland, and Canada.

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

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS |
| **Backend** | Lovable Cloud (Supabase) — PostgreSQL + PostGIS |
| **Edge Functions** | Deno (6 functions handling import, sync, validation, delivery checks) |
| **AI** | Gemini 2.5 Flash (via Lovable AI gateway) + OpenAI GPT-4o-mini (parallel calls) |
| **External APIs** | Navio REST API, Webflow CMS API v2, Nominatim (geocoding) |

---

## Data Model

### Geographic Hierarchy

```
Cities (e.g., Oslo, Bergen, Stockholm)
  └── Districts (e.g., Frogner, Grünerløkka, Gamle Oslo)
       └── Areas (e.g., Majorstuen, Bislett, Holmenkollen)
```

Each level has:
- **Localized names** (`name`, `name_en`, `name_sv`)
- **Localized slugs** for URL generation
- **SEO fields** (title, meta description, intro content) in 3 locales
- **`is_delivery`** flag indicating active Navio delivery coverage
- **`webflow_item_id`** linking to the Webflow CMS item
- **`shared_key`** for stable sync matching across systems

Areas additionally have:
- **`navio_service_area_id`** — direct link to the Navio zone
- **`navio_imported_at`** — timestamp of last Navio sync
- **`geofence`** / `geofence_json` — PostGIS polygon geometry
- **`geo_verified_status`** — spatial verification result (`verified`, `mismatch`, `not_found`)
- **`geo_overlap_percent`** — percentage overlap with nearest Navio zone

Cities have `navio_city_key` and districts have `navio_district_key` for Navio tracking.

### Services

```
Service Categories (e.g., Bilpleie, Dekk)
  └── Services (e.g., Dekkskift, Bilvask, Polering)
```

Services include:
- Pricing fields (price, price_from, 3 pricing tier columns in 3 locales)
- "How it works" steps (3 steps with text + illustration URLs, each in 3 locales)
- `service_type_schema` for Schema.org structured data
- `season_product` flag for seasonal availability

### Partners

Partner profiles with:
- Contact info (email, phone, website, social links)
- Branding (logo, Noddi logo)
- Rating
- Coverage mappings via junction tables: `partner_cities`, `partner_districts`, `partner_areas`, `partner_services`

### Service Locations (Computed SEO Collection)

The critical table for SEO. Each row represents a unique **service + location** combination:

```
Service Location = Service × (City [× District [× Area]])
```

Fields:
- References to `service_id`, `city_id`, `district_id` (optional), `area_id` (optional)
- Generated SEO content: `seo_title`, `seo_meta_description`, `hero_content` (rich text ~200+ words)
- `canonical_url` following pattern: `/{locale}/{service-slug}/{city-slug}/{district-slug}/{area-slug}`
- `structured_data_json` — Schema.org JSON-LD with AdministrativeArea hierarchy and AggregateOffer
- `noindex` — automatically set for locations with zero active partner coverage
- `sitemap_priority` — minimum 0.1 for indexed pages
- Linked partners via `service_location_partners` junction table

### Staging Tables

Before committing Navio data to production, everything goes through staging:

| Table | Purpose |
|-------|---------|
| `navio_staging_cities` | Discovered cities awaiting approval |
| `navio_staging_districts` | AI-discovered districts per city |
| `navio_staging_areas` | Both Navio-sourced and AI-discovered areas |
| `navio_import_queue` | Processing queue with per-city progress tracking |
| `navio_operation_log` | Audit trail of all pipeline operations |
| `navio_snapshot` | Point-in-time snapshot of Navio API state for delta detection |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `settings` | Key-value configuration (Webflow collection IDs, base URL, pipeline state) |
| `sync_logs` | Detailed sync operation logs with `batch_id` for progress tracking |
| `system_health` | Stored health check results from automated validation |
| `user_roles` | RBAC with `admin` role for access control |

---

## The Navio Pipeline

**Edge Function:** `navio-import` (~3,500 lines)

A multi-stage import process that transforms raw Navio delivery zones into a rich geographic hierarchy with AI-discovered neighborhoods.

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
- **Parallel AI**: Both Gemini and OpenAI are called simultaneously; results are merged and deduplicated with Unicode normalization
- **Native language prompts**: AI prompts use the correct local terminology and character sets (æ, ø, å, ä, ö, ü, ß)

### Stage 3: `finalize`

After all cities are processed:
1. Classifies each area as either **Navio-sourced** (direct from API) or **AI-discovered** (found by neighborhood discovery)
2. Writes to staging tables (`navio_staging_cities`, `navio_staging_districts`, `navio_staging_areas`)
3. Sets `status = 'pending'` for human review

### Stage 4: `commit` / `commit_incremental`

Moves approved staging data to production tables:
- **Deduplication**: Matches against existing records using `normalizeForDedup()` (Unicode-normalized, lowercased, stripped of special characters)
- **Upsert logic**: Creates new cities/districts/areas or links staging records to existing ones via `committed_city_id`, `committed_district_id`, `committed_area_id`
- **`commit_incremental`**: Processes one city at a time for safer, resumable commits

### Stage 5: `coverage_check`

Validates production data against the live Navio API:
- Fetches current Navio snapshot
- Compares against `navio_snapshot` table for **delta detection** (new zones, removed zones, changed geofences)
- Checks for **orphaned areas** (in production but not in Navio)
- Updates `navio_snapshot` with current state
- Reports coverage statistics

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

Pulls existing CMS items from Webflow into the local database.

**Process:**
1. For each entity type (service_categories → services → cities → districts → areas → partners), in dependency order
2. Fetches items from all 3 locales using `fetchLocalizedItems()`
3. Merges locale data into a single `LocalizedRecord` per item
4. Upserts into local database, matching on `webflow_item_id`

**Rate limiting:**
- 900ms delay between API calls
- Exponential backoff on 429 responses (2s, 4s, 8s, 16s, 32s)
- Max 5 retries per request

**Locale IDs:**
| Locale | Webflow Locale ID |
|--------|-------------------|
| Norwegian (default) | `64e4857c2f099414c700c890` |
| English | `66f270e0051d1b43823c01d9` |
| Swedish | `66f270e0051d1b43823c01da` |

### Sync (`webflow-sync`)

Pushes local database to Webflow CMS with full SEO content generation.

**For each entity type:**
1. Reads all local records
2. Generates localized field data using `buildLocalizedFields()`
3. For Service Locations, generates:
   - **SEO titles**: `"{Service} i {Location} | Noddi"` pattern
   - **Meta descriptions**: Include partner count and value proposition
   - **Rich text intros**: ~200+ words with H2/H3 structure, localized per service type
   - **Canonical URLs**: `{base_url}/{locale}/{service}/{city}/{district}/{area}`
   - **JSON-LD structured data**: Schema.org Service type with AdministrativeArea hierarchy, provider list, and AggregateOffer
4. Creates or updates items in Webflow (matched via `webflow_item_id` or `shared_key`)
5. Writes localized content for EN and SV locales as separate API calls
6. Logs progress to `sync_logs` with `batch_id` for real-time progress tracking

**`buildLocalizedFields()` pattern:**
```typescript
// Maps db fields to Webflow field slugs
// For each field, checks _en and _sv suffixed versions
// Returns { no: {...}, en: {...}, sv: {...} }
```

### Validate (`webflow-validate`)

Compares expected field schemas against actual Webflow collection fields.

- Defines expected fields for all 7 collections with types, required flags, and descriptions
- Fetches actual collection schema from Webflow API
- Reports: missing fields, extra fields, missing required fields
- Includes **data completeness** check: counts records with filled SEO fields, localized names
- Includes **SEO quality** scoring: duplicate titles, short intros, invalid JSON-LD, noindex pages with partners

### Health Cron (`webflow-health-cron`)

Scheduled wrapper that:
1. Calls `webflow-validate` with `store_results: true`
2. Results stored in `system_health` table
3. Designed for periodic automated health checks

---

## SEO Content Generation

### Service-Specific Templates

The sync function uses service-specific content variations for richer, more relevant SEO content. Templates exist for:

| Service Slug | Content Focus |
|-------------|---------------|
| `dekkskift` | Tire change and tire hotel services |
| `bilvask` | Car wash and car care |
| `polering` | Polishing and paint protection |
| `default` | Generic professional services |

Each template provides localized `serviceDesc` and `callToAction` strings in NO, EN, and SV.

### Rich Text Intro Structure

Generated intros follow a consistent ~200+ word structure:

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
- `base_url` configured in Settings (e.g., `https://www.noddi.no`)

### JSON-LD Structured Data

Each Service Location page gets Schema.org structured data:

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Dekkskift i Frogner, Oslo",
  "serviceType": "Dekkskift",
  "provider": [
    {
      "@type": "LocalBusiness",
      "name": "Partner Name",
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.8 }
    }
  ],
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Frogner",
    "containedInPlace": {
      "@type": "City",
      "name": "Oslo",
      "addressCountry": "NO"
    }
  },
  "offers": {
    "@type": "AggregateOffer",
    "offerCount": 3,
    "availability": "https://schema.org/InStock"
  }
}
```

### Noindex & Sitemap Controls

- Pages with **zero active partner coverage** → `noindex = true`
- Minimum `sitemap_priority` of **0.1** for indexed pages
- Cities default to 0.7, districts to 0.6

---

## Delivery Checking

**Edge Function:** `check-delivery`

A lightweight PostGIS-powered endpoint that checks if a given coordinate falls within a Noddi delivery zone.

**Request:**
```json
{ "lng": 10.7522, "lat": 59.9139 }
```

**Response:**
```json
{
  "delivers": true,
  "coordinates": { "lng": 10.7522, "lat": 59.9139 },
  "areas": [
    {
      "area_id": "uuid",
      "area_name": "Frogner",
      "district_id": "uuid",
      "district_name": "Frogner bydel",
      "city_id": "uuid",
      "city_name": "Oslo"
    }
  ],
  "message": "We deliver to this location! Found in 1 delivery area(s)."
}
```

Uses the PostgreSQL function `find_delivery_areas(lng, lat)` which performs `ST_Contains()` checks against all area geofence polygons.

---

## Dashboard Features

### Entity Management

Full CRUD for all entity types:
- **Cities, Districts, Areas** — geographic hierarchy with delivery flags
- **Services & Service Categories** — with pricing, steps, and rich content in 3 locales
- **Partners** — profiles with coverage mappings
- **Service Locations** — computed SEO pages (managed via sync, not manual editing)

### System Health Panel

- **Collection Health**: Validates Webflow collection schemas against expected fields
- **Data Completeness**: Tracks percentage of records with filled SEO fields and localized content
- **SEO Quality**: Scores based on duplicate titles, short intros, invalid JSON-LD, etc.

### Navio Dashboard

- **Staging Review**: Browse staged cities/districts/areas before committing to production
- **Operation History**: Audit log of all pipeline operations with status and timing
- **Coverage Health**: Real-time stats on Navio coverage, orphaned areas, and deep verification progress
- **Pipeline Status Banner**: Shows current pipeline state (idle, importing, processing, etc.)

### Sync History

- Real-time progress tracking via `sync_logs` table with `batch_id`
- Shows current item being processed, total items, success/error counts
- Delta checking before sync to preview changes

---

## Configuration

### Settings Page

Configured via the admin dashboard:

| Setting | Purpose |
|---------|---------|
| `base_url` | Base URL for canonical links (e.g., `https://www.noddi.no`, no trailing slash) |
| `webflow_cities_collection_id` | Webflow collection ID for Cities |
| `webflow_districts_collection_id` | Webflow collection ID for Districts |
| `webflow_areas_collection_id` | Webflow collection ID for Areas |
| `webflow_service_categories_collection_id` | Webflow collection ID for Service Categories |
| `webflow_services_collection_id` | Webflow collection ID for Services (Tjenester) |
| `webflow_partners_collection_id` | Webflow collection ID for Partners |
| `webflow_service_locations_collection_id` | Webflow collection ID for Service Locations |

### Environment Variables / Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `NAVIO_API_TOKEN` | `navio-import` | Authentication for Navio REST API |
| `WEBFLOW_API_TOKEN` | `webflow-import`, `webflow-sync`, `webflow-validate` | Webflow CMS API v2 authentication |
| `OPENAI_API_KEY` | `navio-import` | GPT-4o-mini for parallel neighborhood discovery |

The Lovable AI gateway key is automatically available for Gemini calls.

### Edge Function Configuration

All edge functions are configured in `supabase/config.toml` with `verify_jwt = false` (they handle auth internally via Bearer token + role checks):

```toml
[functions.navio-import]
verify_jwt = false

[functions.webflow-import]
verify_jwt = false

[functions.webflow-sync]
verify_jwt = false

[functions.webflow-validate]
verify_jwt = false

[functions.webflow-health-cron]
verify_jwt = false

[functions.check-delivery]
verify_jwt = false
```

---

## Operational Workflows

### 1. Initial Setup

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

### 2. Adding a New City

When Navio expands to a new city:

1. **Coverage Check** detects new zones in Navio API
2. **Initialize** fetches updated data, queues the new city
3. **Process City** discovers districts and neighborhoods via AI
4. **Finalize** → staging tables
5. **Review** in Navio Dashboard — verify AI-discovered locations make sense
6. **Commit** to production
7. **Sync** generates SEO pages and pushes to Webflow

### 3. Ongoing Maintenance

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

### 4. Cron Automation

Each edge function is designed for batch/cron operation:

| Function | Cron Pattern | Behavior |
|----------|-------------|----------|
| `webflow-health-cron` | Daily | Runs validation, stores results in `system_health` |
| `navio-import` (coverage_check) | Weekly | Detects Navio API changes |
| `navio-import` (coverage_check_deep) | Batch of 10 | Auto-continues until all areas verified |

The deep verify loop is designed to be **timeout-resilient**: if a batch request times out, the frontend polls the `settings` table for saved progress and automatically resumes.

---

## Webflow Field Mapping Reference

### Naming Conventions

Webflow uses specific slug conventions that differ from the database:

| Pattern | Example | Reason |
|---------|---------|--------|
| `-2` suffix | `city-2`, `seo-title-2`, `district-2` | Webflow auto-appends when field names conflict across collections |
| `shared-key-{entity}` | `shared-key-city`, `shared-key-district` | Stable sync identifiers unique per collection |
| Dash-separated | `seo-meta-description`, `intro-content` | Webflow slug normalization |

### Key Multi-Reference Fields

| Collection | Field | Links To |
|-----------|-------|----------|
| Cities | `districts-2` | Districts in this city |
| Cities | `areas-2` | Areas in this city |
| Districts | `areas-2` | Areas in this district |
| Service Locations | `partners-2` | Partners serving this location |
| Partners | `primary-city` | Cities where partner operates |
| Partners | `services-provided` | Services the partner offers |

---

## Authentication & Authorization

- Uses email/password authentication
- Role-based access via `user_roles` table with `app_role` enum
- All write operations require `admin` role (checked via `has_role()` RPC)
- Edge functions verify auth internally via Bearer token + role checks
- `check-delivery` is the only public (unauthenticated) endpoint
