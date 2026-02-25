

# Create Comprehensive README for Claude Code Review

## What will be created

A single `README.md` file (replacing the existing one) that serves as a complete technical reference for the Noddi CMS Manager codebase. The README is designed to be fed to Claude Code (or any AI code reviewer) and contains everything needed to understand the system without reading individual files.

## Content Structure

The README will cover:

1. **Project Overview** -- What Noddi is, why this system exists, the 3-system architecture (Navio API -> Local DB -> Webflow CMS)

2. **Tech Stack** -- React 18, Vite, TypeScript, shadcn/ui, Tailwind, Supabase (PostgreSQL + PostGIS), Deno edge functions, AI models (Gemini + OpenAI)

3. **Complete Database Schema** -- All 22+ tables documented with columns, relationships, and purpose:
   - Core entities: cities, districts, areas (geographic hierarchy)
   - Services: service_categories, services, service_locations
   - Partners: partners + 5 junction tables (partner_cities, partner_districts, partner_areas, partner_services, partner_service_locations)
   - Staging: navio_staging_cities/districts/areas, navio_import_queue, navio_snapshot
   - System: settings, sync_logs, system_health, user_roles, navio_operation_log
   - Key computed entities: service_locations (SEO pages), service_location_partners

4. **Edge Functions** (7 total) -- Each documented with purpose, request/response format, and key logic:
   - `navio-import` (~3500 lines, 6 stages: initialize, process_city, finalize, commit, coverage_check, coverage_check_deep)
   - `webflow-sync` (chunked, per-collection sync with SEO content generation)
   - `webflow-import` (pulls CMS items with 3-locale merging)
   - `webflow-validate` (schema + data completeness + SEO quality checks)
   - `webflow-health-cron` (automated scheduled validation)
   - `schema-fix` (database column management via exec_sql RPC)
   - `check-delivery` (public PostGIS point-in-polygon endpoint)

5. **Frontend Architecture** -- All 21 pages, component organization, routing, hooks, auth flow

6. **Data Pipelines** -- Step-by-step flows for:
   - Navio import pipeline (6 stages with AI discovery)
   - Webflow sync pipeline (chunked, sequential per-collection)
   - Schema sync wizard (detect, resolve, apply)

7. **Localization** -- 3 locales (NO, EN, SV), Webflow locale IDs, field naming conventions (_en, _sv suffixes)

8. **SEO System** -- Content generation templates, canonical URL patterns, JSON-LD structured data, noindex/sitemap controls

9. **Webflow Field Mapping** -- Slug conventions (-2 suffixes, shared-key patterns), multi-reference fields, collection IDs from settings

10. **Configuration** -- Settings table keys, environment variables/secrets, edge function config

11. **Known Limitations and Recent Fixes** -- Memory limits requiring chunked sync, sequential per-collection calls

12. **Potential Add-ons / Improvement Areas** -- Suggestions for a reviewer to evaluate

## Files Modified

| File | Change |
|------|--------|
| `README.md` | Complete rewrite with comprehensive technical documentation |

