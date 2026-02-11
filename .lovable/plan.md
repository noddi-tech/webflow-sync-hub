

# Fix Deep Verify: Client Timeout Kills Auto-Loop

## What's Actually Happening

The deep verify function **is working correctly**. Evidence from the last run:
- 30 areas verified and reassigned to correct zones
- 15 mismatched, 9 not found
- Boler correctly reassigned to zone 123
- Progress saved to database after each batch

But the user sees "nothing happening" because:
1. Each batch of 25 areas takes ~45 seconds (1.1s Nominatim delay per area + PostGIS + overhead)
2. The browser's `fetch()` times out before the function returns its response
3. The auto-loop's `catch` block fires with "Failed to fetch", shows an error toast, and stops the loop
4. The user sees no progress because `autoStats` never gets updated

## The Fix: Smaller Batches + Timeout Resilience

### 1. Reduce batch size from 25 to 10 (`supabase/functions/navio-import/index.ts`)

At 10 areas per batch:
- ~1.1s Nominatim delay x 10 = 11 seconds
- PostGIS calls + overhead = ~5 seconds
- Total: ~16-18 seconds per batch -- safely under any timeout

Also lower the time guard from 40s to 25s to match.

### 2. Make auto-loop resilient to timeouts (`src/components/navio/CoverageHealthCard.tsx`)

If a batch call fails (timeout), don't abort the whole loop. Instead:
- Catch the error
- Wait 3 seconds
- Poll the settings table for the latest `deepVerifyProgress` (the function saves progress even if the client doesn't get the response)
- If progress advanced, continue the loop
- If progress didn't advance after 3 retries, then actually stop with an error

This makes the system truly bulletproof -- even if the occasional batch takes longer than expected, the loop recovers automatically.

### 3. Add retry counter display

Show "Batch X completed" / "Retrying..." status in the progress area so the user knows it's working.

## Technical Details

### Edge function change

```text
BATCH_SIZE: 25 -> 10
Time guard: 40000 -> 25000
```

### Frontend auto-loop change

```typescript
// Pseudo-code for resilient loop
while (keepGoing && !stopRef.current) {
  try {
    const progress = await runDeepVerifyBatch();
    setAutoStats(progress);
    retryCount = 0;
  } catch (error) {
    retryCount++;
    if (retryCount >= 3) { stop with error; break; }
    // Wait and poll settings for progress
    await sleep(3000);
    const savedProgress = await pollProgressFromSettings();
    if (savedProgress) setAutoStats(savedProgress);
    // Continue loop -- the batch likely completed server-side
  }
  await sleep(2000);
}
```

### New helper: poll progress from settings

```typescript
const pollProgressFromSettings = async () => {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "navio_coverage_check")
    .maybeSingle();
  if (data?.value) {
    const parsed = JSON.parse(data.value);
    return parsed.deepVerifyProgress as DeepVerifyProgress;
  }
  return null;
};
```

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Reduce BATCH_SIZE to 10, time guard to 25s |
| `src/components/navio/CoverageHealthCard.tsx` | Add timeout resilience with retry logic and settings polling |

## Expected Result

- Each batch completes in ~16-18 seconds (no more timeouts)
- If a batch does time out, the loop recovers automatically by polling saved progress
- Progress bar updates smoothly after each batch
- Full verification of ~4,700 areas completes in ~470 batches over ~3-4 hours of auto-running
- User can stop and resume at any point
- Ready for cron automation (each cron call processes 10 areas in ~18 seconds)
