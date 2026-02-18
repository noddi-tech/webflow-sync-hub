

# Create Detailed Project README

## Overview

Replace the current generic README with a comprehensive technical document explaining the entire CMS Manager system -- what it does, why it exists, its architecture, how data flows between Navio, the local database, and Webflow, and how every subsystem works.

## README Structure

The new `README.md` will contain the following sections:

### 1. Project Overview
- **What**: A Webflow CMS Manager for Noddi -- an admin dashboard that manages geographic entities (Cities, Districts, Areas), Services, Service Categories, Partners, and computed Service Locations
- **Why**: Noddi delivers car care services across multiple countries. The website (Webflow) needs thousands of SEO-optimized location pages. Manually managing this in Webflow is impossible at scale. This system automates the entire pipeline: ingesting delivery zones from Navio (the operations API), enriching them with AI-discovered neighborhoods, verifying them spatially with PostGIS, then syncing everything to Webflow with full localization and SEO content

### 2. Architecture Overview
- Tech stack: React + Vite + TypeScript + shadcn/ui + Tailwind CSS frontend, Lovable Cloud (Supabase) backend with PostgreSQL + PostGIS, Deno edge functions
- Diagram of the three-system relationship: **Navio API** (source of truth for delivery zones) -> **Local Database** (enrichment, verification, editorial control) -> **Webflow CMS** (public website)

### 3. Data Model
- **Geographic hierarchy**: Cities > Districts > Areas (with `is_delivery`, geofence polygons, Navio IDs)
- **Services**: Service Categories > Services (with pricing, steps, rich content in 3 locales)
- **Partners**: Partner profiles with coverage mappings (partner_service_locations)
- **Service Locations**: Computed SEO collection joining services + locations + partner coverage
- **Staging tables**: `navio_staging_cities/districts/areas` for review before commit
- **Tracking columns**: `navio_service_area_id`, `navio_imported_at`, `navio_district_key`, `navio_city_key`

### 4. The Navio Pipeline (Edge Function: `navio-import`)
Explain each mode of the multi-stage import process:
- **`initialize`**: Fetches all service areas from Navio API, parses names (supports 6 countries with native terminology), groups by city, queues for processing
- **`process_city`**: AI-powered discovery using Gemini + OpenAI in parallel to find districts and neighborhoods for each city. Time-budgeted with per-district checkpointing
- **`finalize`**: Classifies all areas as either Navio-sourced or AI-discovered, saves to staging tables
- **`commit`** / **`commit_incremental`**: Moves approved staging data to production tables with deduplication
- **`coverage_check`**: Validates production data against live Navio API -- checks geofence coverage, Navio linkage, orphan detection
- **`coverage_check_deep`**: Spatial verification using PostGIS -- geocodes each AI-discovered area via Nominatim, compares polygon overlap against active Navio zones using 90% threshold, reassigns or deactivates areas. Batch-processed (10 areas/batch) with timeout resilience

### 5. The Webflow Pipeline
- **Import** (`webflow-import`): Pulls existing items from Webflow CMS across all 3 locales (NO, EN, SV), merges into local database. Rate-limited (900ms delay, exponential backoff for 429s)
- **Sync** (`webflow-sync`): Pushes local database to Webflow. Generates SEO content (titles, meta descriptions, 200+ word rich text intros), JSON-LD structured data, canonical URLs. Handles multi-reference fields and all 3 locales
- **Validate** (`webflow-validate`): Compares expected field schemas against actual Webflow collection fields. Reports missing/extra fields
- **Health Cron** (`webflow-health-cron`): Scheduled wrapper that runs validation and stores results

### 6. Localization
- Three locales: Norwegian (default), English, Swedish
- Webflow locale IDs and how they map
- How `buildLocalizedFields()` works for sync
- How `fetchLocalizedItems()` merges data during import

### 7. SEO Content Generation
- Template system for service-specific content (dekkskift, bilvask, polering)
- Canonical URL generation from `base_url` setting
- JSON-LD structured data for Service Location pages
- Sitemap priority and noindex controls

### 8. Delivery Checking (Edge Function: `check-delivery`)
- PostGIS `find_delivery_areas` function
- Takes lat/lng coordinates, returns matching delivery areas with full hierarchy

### 9. Dashboard Features
- Entity management pages (CRUD for all entity types)
- System health panel with collection health, data completeness, SEO quality
- Navio dashboard with staging review, operation history, coverage health
- Sync history and progress tracking via `sync_logs` table with `batch_id`

### 10. Configuration
- Settings page for Webflow Collection IDs and base URL
- Environment variables / secrets needed (Navio API token, Webflow API token, OpenAI API key)
- `supabase/config.toml` edge function configuration

### 11. Operational Workflows
Step-by-step guides:
1. **Initial Setup**: Configure settings -> Import from Webflow -> Run Navio import
2. **Adding a new city**: Navio import detects it -> AI discovers neighborhoods -> Review staging -> Commit -> Sync to Webflow
3. **Ongoing maintenance**: Coverage check detects orphans -> Deactivate -> Deep verify confirms -> Sync updates to Webflow
4. **Cron automation**: How each edge function is designed for batch/cron operation

## File to Create

| File | Description |
|------|-------------|
| `README.md` | Complete project documentation (replaces current placeholder) |

