

# Schema Sync Wizard -- Automated Fix Workflow

## Problem

When Webflow fields change (renamed, added, deleted), the user currently sees mismatches in the health panel but has no way to fix them from the app. The "Generate Fix Checklist" just copies markdown to clipboard. For the `city-2` to `city-3` rename and new `tagline` field, this means manually editing 3 edge functions and running a migration -- not a sustainable workflow.

## Solution

Build a **Schema Sync Wizard** -- a new dedicated page accessible from the health panel that:
1. Shows all schema mismatches in a clear, guided UI
2. Categorizes fixes into actionable types (renamed fields, new fields, removed fields)
3. Lets the user review and approve changes
4. Automatically applies fixes to all 3 edge functions and triggers a database migration

The wizard will work through an edge function that receives the fix instructions and rewrites the relevant sections of the validate/import/sync configuration.

## Architecture

Since edge functions are deployed as code files and can't rewrite themselves at runtime, the actual fix mechanism will be:

1. **Detection**: The existing `webflow-validate` function already detects mismatches perfectly
2. **Resolution UI**: A new full-page wizard that shows each mismatch with guided resolution options
3. **Application**: A new `schema-fix` edge function that:
   - Runs the specific database migration (ADD COLUMN)
   - Updates a `field_mappings` settings row that the import/sync/validate functions read at runtime
   - This replaces hardcoded field mappings with a database-driven approach for fields that change

However, this is a very large architectural change. A more pragmatic approach for now:

## Pragmatic Plan: Smart Fix Dialog + Immediate Code Fixes

### Phase 1: Fix the immediate `city-2` to `city-3` + `tagline` issue (code changes)

Update all 3 edge functions and add a migration -- this is the approved plan from earlier that needs implementing.

### Phase 2: Build a "Schema Resolution Wizard" page (new UX)

A new page `/schema-wizard` that provides a step-by-step guided workflow when schema mismatches are detected.

#### Step 1: Detection Summary
- Shows a clear summary: "3 changes detected in Webflow"
- Groups changes by type:
  - **Renamed fields** (field disappeared + similar field appeared, e.g. `city-2` gone, `city-3` appeared)
  - **New fields** (exist in Webflow, not in app, e.g. `tagline`)
  - **Removed fields** (in app's expected list, not in Webflow)

#### Step 2: Field-by-Field Resolution
For each change, show a card with:
- The field name, type, and which collection it belongs to
- What the system thinks happened (renamed / added / removed)
- What needs to happen to fix it (explanation in plain language)
- A confirmation checkbox

For **renamed fields** (e.g. `city-2` to `city-3`):
> "The field `city-2` was removed from Areas and `city-3` was added. This looks like a rename. The system will update all internal references from `city-2` to `city-3`."

For **new fields** (e.g. `tagline`):
> "A new field `tagline` (Plain Text, localized) was added to all collections. The system will add database columns (`tagline`, `tagline_en`, `tagline_sv`) and update import/sync mappings."
> Option to provide: content generation template or leave blank for manual entry

For **removed fields**:
> "The field `old-field` no longer exists in Webflow. The system will remove it from the expected fields list. Existing database data will be preserved."

#### Step 3: Apply Fixes
A single "Apply All Fixes" button that calls a new `schema-fix` edge function which:
1. Runs the necessary SQL migrations (ALTER TABLE ADD COLUMN)
2. Updates the `EXPECTED_FIELDS` config stored in a new `schema_field_mappings` settings table
3. Updates the import/sync field mapping config in the same table

The edge functions (`webflow-validate`, `webflow-import`, `webflow-sync`) will be updated to read field mappings from the database at runtime, falling back to their hardcoded defaults. This makes future schema changes fixable from the UI without redeploying code.

#### Step 4: Verify
After applying, automatically re-runs validation to confirm everything is green.

### New Files

| File | Purpose |
|------|---------|
| `src/pages/SchemaWizard.tsx` | The main wizard page with step-by-step UI |
| `src/components/schema/SchemaDetectionStep.tsx` | Step 1: Shows detected changes grouped by type |
| `src/components/schema/SchemaResolutionStep.tsx` | Step 2: Field-by-field review with explanations |
| `src/components/schema/SchemaApplyStep.tsx` | Step 3: Apply button + progress |
| `src/components/schema/SchemaVerifyStep.tsx` | Step 4: Re-validation results |
| `supabase/functions/schema-fix/index.ts` | Edge function that applies migrations and updates mappings |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/schema-wizard` route |
| `src/components/layout/Sidebar.tsx` | Add Schema Wizard nav link (or just link from health panel) |
| `src/components/health/CollectionHealthCard.tsx` | Replace "Generate Fix Checklist" with "Open Schema Wizard" button |
| `src/components/health/SystemHealthPanel.tsx` | Add "Fix Issues" button linking to wizard when issues detected |
| `supabase/functions/webflow-validate/index.ts` | Update `city-2` to `city-3`, add `tagline` to all schemas |
| `supabase/functions/webflow-import/index.ts` | Update `city-2` to `city-3`, add tagline import |
| `supabase/functions/webflow-sync/index.ts` | Update `city-2` to `city-3`, add tagline to fieldMappings + generation |
| Database migration | Add `tagline`, `tagline_en`, `tagline_sv` columns to all 7 entity tables |

### Database Migration

```sql
-- Add tagline columns to all entity tables
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline_sv text;
```

### Tagline Content Generation

For service locations during sync, generate locale-aware taglines:
- **NO**: "Noddi leverer {service} i {area}, {district} -- sammenlign partnere og bestill enkelt."
- **EN**: "Noddi delivers {service} in {area}, {district} -- compare partners and book easily."
- **SV**: "Noddi levererar {service} i {area}, {district} -- jamfor partners och boka enkelt."

For geographic entities (cities, districts, areas), taglines describe Noddi's presence:
- **NO**: "Noddi tilbyr bilpleie i {location} -- enkelt, raskt og til din dor."
- **EN**: "Noddi offers car care in {location} -- easy, fast and to your door."
- **SV**: "Noddi erbjuder bilvard i {location} -- enkelt, snabbt och till din dorr."

### Implementation Order

1. Run database migration (tagline columns)
2. Fix the 3 edge functions (city-2 to city-3 + tagline mappings)
3. Build the Schema Wizard page and components
4. Update health panel to link to the wizard
5. Add the `schema-fix` edge function for future automated fixes

