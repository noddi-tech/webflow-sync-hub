
# System Health Dashboard with Automated Validation

## Overview

Transform the current modal-based Webflow validation into a persistent **System Health** dashboard that:
1. Displays health status directly on the Dashboard (no modal)
2. Stores validation results in the database for history and cron access
3. Runs automatically via a daily cron job
4. Provides actionable "Add to Mapping" buttons for unmapped extra fields
5. Shows data completeness metrics (e.g., how many records have SEO fields populated)

## Architecture

```text
+------------------+     +---------------------+     +------------------+
|   Dashboard UI   | --> | webflow-validate    | --> | system_health    |
|  (Health Panel)  |     | (Edge Function)     |     | (DB Table)       |
+------------------+     +---------------------+     +------------------+
                                   ^
                                   |
                         +-------------------+
                         | pg_cron (Daily)   |
                         +-------------------+
```

## Implementation Plan

### Phase 1: Database Schema

Create a new `system_health` table to store validation results and data completeness metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| check_type | TEXT | 'webflow_validation', 'data_completeness', etc. |
| status | TEXT | 'healthy', 'warning', 'error' |
| results | JSONB | Full validation results |
| summary | JSONB | Quick summary stats |
| checked_at | TIMESTAMP | When the check ran |
| triggered_by | TEXT | 'cron', 'manual' |

### Phase 2: Update webflow-validate Edge Function

Modify to optionally store results in the `system_health` table and support being called without authentication (for cron).

- Add `store_results: boolean` parameter
- Add `triggered_by: 'manual' | 'cron'` parameter
- Insert results into `system_health` table when `store_results=true`
- Add data completeness checks (count records with null SEO fields)

### Phase 3: Create System Health Dashboard Component

Replace the modal dialog with an inline dashboard panel showing:

- **Collection Status Cards**: 7 cards showing each collection's health status
- **Data Completeness Metrics**: % of records with SEO fields populated per entity
- **Last Check Time**: When validation last ran
- **Manual Trigger Button**: Run validation now
- **Expandable Details**: Click to see field-level details for each collection

### Phase 4: Add "Map This Field" Functionality

For each "Extra Field in Webflow", add a button that:
1. Shows what code change is needed
2. Copies the field slug to clipboard
3. Opens instructions for adding to EXPECTED_FIELDS

### Phase 5: Set Up Daily Cron Job

Configure pg_cron to call the validation function daily at a specified time.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/health/SystemHealthPanel.tsx` | Create | Main health dashboard component |
| `src/components/health/CollectionHealthCard.tsx` | Create | Individual collection status card |
| `src/components/health/DataCompletenessCard.tsx` | Create | Data completeness metrics |
| `src/pages/Dashboard.tsx` | Modify | Add SystemHealthPanel to dashboard |
| `supabase/functions/webflow-validate/index.ts` | Modify | Add DB storage and completeness checks |
| `supabase/functions/webflow-health-cron/index.ts` | Create | Cron-callable health check function |
| Database migration | Create | Add system_health table |

## UI Design

The System Health panel will appear on the Dashboard below the entity stats:

```text
+-------------------------------------------------------+
| System Health                    Last check: 2 min ago |
|                                    [Run Check Now]     |
+-------------------------------------------------------+
| Collection Mappings                                    |
| +----------+ +----------+ +----------+ +----------+   |
| | Cities   | |Districts | | Areas    | |Services  |   |
| | Ready    | | Ready    | | Ready    | | Ready    |   |
| | 10 flds  | | 11 flds  | | 12 flds  | | 10 flds  |   |
| +----------+ +----------+ +----------+ +----------+   |
|                                                        |
| Data Completeness                                      |
| +--------------------------------------------------+  |
| | SEO Titles      [=============     ] 78% complete|  |
| | Meta Desc       [===========       ] 65% complete|  |
| | Intro Content   [========          ] 45% complete|  |
| +--------------------------------------------------+  |
|                                                        |
| Extra Webflow Fields (not mapped - safe to ignore)    |
| [ districts-2 ] [ areas-2 ] [ noindex ] [+3 more]     |
| [Map Selected Fields]                                  |
+-------------------------------------------------------+
```

## Data Completeness Checks

Query each entity table to calculate:

| Metric | Query Logic |
|--------|-------------|
| SEO Title Coverage | `COUNT(*) WHERE seo_title IS NOT NULL / COUNT(*)` |
| Meta Description Coverage | `COUNT(*) WHERE seo_meta_description IS NOT NULL / COUNT(*)` |
| Intro Content Coverage | `COUNT(*) WHERE intro IS NOT NULL / COUNT(*)` |
| Localized Fields | `COUNT(*) WHERE name_en IS NOT NULL / COUNT(*)` |

These percentages help identify which data needs attention before syncing to Webflow.

## Cron Job Setup

After the migration, a SQL command will be run to set up the daily cron job:

```sql
SELECT cron.schedule(
  'daily-system-health-check',
  '0 6 * * *', -- Run at 6 AM daily
  $$
  SELECT net.http_post(
    url:='https://aqnrvcjctfjocrpmknho.supabase.co/functions/v1/webflow-health-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## Benefits

1. **Visibility**: Health status is always visible on the Dashboard
2. **Historical Data**: Track health over time via database records
3. **Automated Monitoring**: Daily cron catches issues before they become problems
4. **Actionable Insights**: Clear guidance on what fields need mapping or data
5. **Data Quality**: Completeness metrics show where content is missing
