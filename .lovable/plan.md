

# Make Schema Sync from Webflow Actually Work

## Current State

You already have three pieces in place:
1. **webflow-validate** -- Compares Webflow's actual collection fields against a hardcoded `EXPECTED_FIELDS` list and reports mismatches
2. **Schema Wizard** (`/schema-wizard`) -- A 3-step UI (Detect, Resolve, Apply) that shows the mismatches
3. **schema-fix** -- A backend function that attempts to apply fixes, but is incomplete

The problem is that `schema-fix` doesn't actually work reliably:
- "Added" fields try to use an `exec_sql` RPC that doesn't exist
- "Removed" and "renamed" fields just log messages without doing anything
- The `EXPECTED_FIELDS` list in `webflow-validate` is never updated, so the same mismatches keep appearing

## What Needs to Change

The goal: When Webflow has new/changed fields, the app should be able to:
1. Detect the differences (already works)
2. Add missing database columns for new fields
3. Update the `EXPECTED_FIELDS` list so the health check stays green

## Implementation Plan

### 1. Create a database migration to add the `exec_sql` function

Add a secure RPC function that allows the `schema-fix` edge function (using the service role key) to run ALTER TABLE statements:

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Revoke from public, only service role can call this
REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
```

This allows the existing `schema-fix` logic for "added" fields to actually work.

### 2. Update `schema-fix` edge function to handle all change types properly

**For "added" fields:**
- Use the `exec_sql` RPC (now available) to run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- For localized field types (PlainText, RichText), also add `_en` and `_sv` columns
- This already exists in the code but will now actually succeed

**For "removed" fields:**
- Update the `EXPECTED_FIELDS` configuration stored in settings so the health check stops flagging them
- Store a `schema_expected_overrides` setting that the validate function reads

**For "renamed" fields:**
- Run `ALTER TABLE ... RENAME COLUMN old_name TO new_name` for the database column
- Update the overrides setting

### 3. Update `webflow-validate` to read dynamic field overrides

Currently `EXPECTED_FIELDS` is hardcoded. After schema-fix runs, it should check a `schema_expected_overrides` setting in the database that can add/remove fields from the expected list, so subsequent health checks reflect the applied fixes.

### 4. Add a sidebar link to the Schema Wizard

Add a permanent "Schema Sync" link under the Webflow section in the sidebar so it's always easy to find (not just via the health panel's "Fix Issues" button).

## Files Modified

| File | Change |
|------|--------|
| Database migration | Add `exec_sql` function |
| `supabase/functions/schema-fix/index.ts` | Handle removed/renamed properly, update overrides setting |
| `supabase/functions/webflow-validate/index.ts` | Read `schema_expected_overrides` from settings to merge with hardcoded fields |
| `src/components/layout/Sidebar.tsx` | Add "Schema Sync" nav link |

## How to Use (After Implementation)

1. Go to **Dashboard** and check the System Health panel, or navigate directly to **Schema Sync** in the sidebar
2. The wizard will show any fields that exist in Webflow but not in your app (and vice versa)
3. Confirm which changes to apply
4. Click "Apply All Fixes" -- this will add database columns and update the expected field list
5. The health check will re-run automatically and should show green

