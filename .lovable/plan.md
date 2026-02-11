

# Bulletproof Deep Verify: Fix Counting Bug and Add Auto-Continuation

## Problems Found

### Bug 1: Verified areas disappear from counts (CRITICAL)

The system IS working -- 14 areas were verified, 12 mismatched, 9 not found. But the UI shows "0 verified" because:

When an area is verified, the code changes its `navio_service_area_id` from `discovered_abc123` to the actual zone ID (e.g., `75`). Every counting query in the edge function filters by `LIKE 'discovered_%'`, so verified areas vanish from all progress stats.

**Fix**: Change all counting queries to use `geo_verified_at IS NOT NULL` instead of relying on the `discovered_` prefix. Or better: track all areas that have EVER had a `discovered_` prefix by querying based on `geo_verified_at` or `geo_verified_status` being set, regardless of current `navio_service_area_id`.

The simplest fix: count ALL areas that have `geo_verified_status IS NOT NULL` (these were all originally `discovered_` areas). For the "total discovered" count, sum `areas where navio_service_area_id LIKE 'discovered_%'` PLUS `areas where geo_verified_status IS NOT NULL AND navio_service_area_id NOT LIKE 'discovered_%'` (reassigned ones).

### Bug 2: No auto-continuation -- user must click 188 times

4,700 areas at 25 per batch = 188 button clicks. Currently there is zero auto-loop logic. Each batch completes, shows a toast, and waits for another manual click.

**Fix**: Add auto-continuation in the frontend. After each successful batch, if `remaining > 0`, automatically trigger the next batch with a short delay. Show a running progress indicator and a "Stop" button.

### Bug 3: Not ready for cron automation

For a nightly cron to work end-to-end, the edge function needs a mode that runs multiple batches within a single invocation (processing as many as the timeout allows), or the cron job needs to call the function in a loop.

**Fix**: Add a `coverage_check_deep_auto` mode that processes multiple internal batches within a single edge function call, using the time guard to process as many areas as possible before returning. This way a single cron invocation processes 20-25 areas, and the cron can run every few minutes during the overnight window.

## Implementation Plan

### 1. Fix counting in edge function (`supabase/functions/navio-import/index.ts`)

Replace the counting logic in `coverage_check_deep`:

```text
Before (broken):
  COUNT WHERE navio_service_area_id LIKE 'discovered_%'
  -> misses verified areas that got reassigned

After (correct):
  Total = COUNT WHERE navio_service_area_id LIKE 'discovered_%'
        + COUNT WHERE geo_verified_status IS NOT NULL 
          AND navio_service_area_id NOT LIKE 'discovered_%'
  
  Unverified = COUNT WHERE navio_service_area_id LIKE 'discovered_%'
               AND geo_verified_at IS NULL
```

This correctly accounts for areas that started as `discovered_` but were reassigned upon verification.

### 2. Add auto-continuation in frontend (`src/components/navio/CoverageHealthCard.tsx`)

Replace the current single-shot mutation with a looping mechanism:

- Add state: `isAutoVerifying`, `autoVerifyStats`
- After each batch completes successfully and `remaining > 0`, automatically call the next batch after a 2-second delay
- Show a persistent progress bar with live stats (verified/mismatched/remaining)
- Add a "Stop" button to halt the auto-loop
- When all done or stopped, show final summary

### 3. Improve the "Continue Verification" button UX

```text
Before first run:   "Start Deep Verify"
During auto-run:    Progress bar + "Stop Verification" button
After stopping:     "Continue Verification (X remaining)"  
All complete:       "All Verified" (disabled, green check)
```

### 4. Make it cron-ready

The existing edge function structure already works for cron -- each call processes one batch and returns. A cron job calling `coverage_check_deep` every 5 minutes would process ~25 areas per call, completing all 4,700 in ~16 hours. No additional edge function changes needed beyond the counting fix.

For the cron setup, add a new edge function `navio-deep-verify-cron` (simple wrapper) or reuse the existing `webflow-health-cron` pattern to invoke `navio-import` with `mode: coverage_check_deep`.

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Fix all `discovered_%` counting queries to include reassigned areas |
| `src/components/navio/CoverageHealthCard.tsx` | Add auto-continuation loop with progress UI and stop button |

## Expected Result

- Progress shows correct numbers (14 verified, not 0)
- Clicking "Start Deep Verify" runs continuously through all batches automatically
- User can stop at any time and resume later
- Each batch processes 25 areas in ~40 seconds
- Full verification of 4,700 areas completes in ~3 hours of auto-running
- System is ready for cron automation

