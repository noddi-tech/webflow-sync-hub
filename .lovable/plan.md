

# Fix: Stale "Approved" Cities Already Committed

## What's Happening

The 10 cities showing as "approved (ready to commit)" have **already been committed** to production. This is proven by the database showing:

| Staging City | Status | committed_city_id | Production City Exists |
|--------------|--------|-------------------|------------------------|
| Stockholm | approved | 78f372c8-... | Yes |
| Oslo | approved | 06eafe56-... | Yes |
| München | approved | da62ccea-... | Yes |
| (7 more...) | approved | (all populated) | Yes |

The `committed_city_id` being populated means the commit process **did run** - but the status update from "approved" → "committed" failed or was interrupted (network issue, page refresh, timeout).

## Will Clicking Commit Duplicate Data?

**No** - the commit logic is idempotent:
1. It checks for existing cities by name before creating
2. It reuses existing IDs if found
3. Same deduplication applies to districts and areas

So clicking "Commit" again would just re-link to existing records and finally update the status to "committed".

## Solution: Clean Up Stale Staging Status

We should update the staging records to reflect reality - they've already been committed:

### Option A: One-Time Database Cleanup (Recommended)

Run a single query to mark these as committed:

```sql
UPDATE navio_staging_cities
SET status = 'committed'
WHERE status = 'approved' 
  AND committed_city_id IS NOT NULL;

UPDATE navio_staging_districts
SET status = 'committed'
WHERE status IN ('approved', 'pending')
  AND committed_district_id IS NOT NULL;

UPDATE navio_staging_areas
SET status = 'committed'
WHERE status IN ('approved', 'pending')
  AND committed_area_id IS NOT NULL;
```

This instantly fixes the UI - the "10 approved" badge disappears.

### Option B: Improve Commit Logic to Self-Heal

Modify the `commit_city` handler to detect and fix this scenario automatically:

```typescript
// At the start of commit_city case
// First, fix any stale approved cities that are already committed
await supabase
  .from("navio_staging_cities")
  .update({ status: "committed" })
  .eq("status", "approved")
  .not("committed_city_id", "is", null);
```

### Option C: Let User Click Commit (Safe but Wasteful)

Clicking "Commit" would work without duplication, but it's unnecessary work since the data is already there.

## Recommended Approach

1. **Apply Option A** (one-time cleanup) to fix the current state
2. **Apply Option B** (self-healing logic) to prevent this from happening again in future interrupted commits

## Files to Modify

| File | Changes |
|------|---------|
| Database (one-time query) | Fix stale staging records |
| `supabase/functions/navio-import/index.ts` | Add self-healing check at start of `commit_city` |

## Expected Outcome

- "10 approved" badge disappears immediately
- Future interrupted commits will self-heal on next run
- No duplicate data created

