
# Plan: Fix Commit Reliability with Retry Logic and Resume Capability

This plan fixes the commit failure issue where a network timeout causes the entire commit to abort, leaving partially committed data.

---

## Problem Analysis

**What happened:**
1. Commit started with 18 approved cities
2. 5 cities committed successfully: Asker, Bærum, Bergen, Drammen, Stockholm
3. 6th city (Göteborg) failed with "Failed to fetch" - network timeout after ~2 minutes
4. Commit loop stopped without retry
5. 13 cities remain in "approved" status, ready to continue

**Current database state:**
- 5 cities: status = "committed" (Asker, Bærum, Bergen, Drammen, Stockholm)
- 13 cities: status = "approved" (Göteborg, Hoksund, Kolbotn, etc.)

The good news: **You can simply click "Commit" again to continue** with the remaining 13 cities.

---

## Technical Fixes

### Issue 1: No Retry on Network Errors

The `commitIncrementally` function in `NavioPreview.tsx` immediately aborts on any error. It should use retry logic similar to `useNavioImport.ts`.

**Solution:** Add exponential backoff retry for transient network errors.

```text
File: src/pages/NavioPreview.tsx

Current behavior:
  - Single try per city
  - Any error stops the entire commit

New behavior:
  - Up to 5 retries with exponential backoff (1.5s, 3s, 6s, 12s, 24s)
  - Only retry on transient errors (network, 502, 503, 504)
  - Show retry progress in the action bar
  - Continue to next city on non-transient errors
```

### Issue 2: Stale Approved Count

The action bar uses `approvedCount` which is computed once from the initial query. After cities are committed, this count becomes stale.

**Solution:** Use the `remaining` count returned from the edge function response.

```text
Current: setCommitProgress({ current: citiesCommitted, total: totalApproved })
Fixed: setCommitProgress({ current: citiesCommitted, total: data.remaining + citiesCommitted })
```

### Issue 3: Missing Resume State

When commit fails, users don't see that some cities were committed. They need clear feedback.

**Solution:** Show partial commit status in the toast and allow resume.

```text
Toast on failure:
  "Commit paused after 5 cities. Click 'Commit' to continue with remaining 13 cities."
```

---

## Implementation Details

### Changes to NavioPreview.tsx

Add a retry helper function (reuse pattern from useNavioImport.ts):

```typescript
const isRetryableError = (error: unknown): boolean => {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("504") ||
    msg.includes("502") ||
    msg.includes("503")
  );
};

const invokeWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1500,
  onRetry?: (attempt: number, max: number) => void
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      onRetry?.(attempt, maxRetries);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError;
};
```

Update `commitIncrementally` to use retry:

```typescript
const commitIncrementally = useCallback(async (batchId: string) => {
  setIsCommitting(true);
  setCommitProgress({ current: 0, total: approvedCount });
  
  let completed = false;
  let citiesCommitted = 0;
  let totalRemaining = approvedCount;
  
  while (!completed) {
    try {
      const { data, error } = await invokeWithRetry(
        async () => {
          const response = await supabase.functions.invoke("navio-import", {
            body: { batch_id: batchId, mode: "commit_city" },
          });
          if (response.error) throw response.error;
          if (response.data?.error) throw new Error(response.data.error);
          return response;
        },
        5,
        1500,
        (attempt, max) => {
          // Show retry status in progress
          setCommitProgress(prev => ({
            ...prev!,
            retryAttempt: attempt,
            retryMax: max,
          }));
        }
      );
      
      // Clear retry state on success
      completed = data.completed;
      citiesCommitted++;
      totalRemaining = data.remaining;
      
      setCommitProgress({
        current: citiesCommitted,
        total: citiesCommitted + totalRemaining,
        currentCityName: data.committedCity,
      });
      
    } catch (error) {
      setCommitProgress(null);
      setIsCommitting(false);
      
      toast({
        title: citiesCommitted > 0 
          ? `Commit paused after ${citiesCommitted} cities` 
          : "Commit Failed",
        description: citiesCommitted > 0
          ? `Click 'Commit' again to continue with ${totalRemaining} remaining cities.`
          : (error instanceof Error ? error.message : "Unknown error"),
        variant: citiesCommitted > 0 ? "default" : "destructive",
      });
      
      // Refresh data to show updated status
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      return;
    }
  }
  
  // Success
  setCommitProgress(null);
  setIsCommitting(false);
  queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
  queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
  queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
  
  toast({
    title: "Commit Complete",
    description: `Successfully committed ${citiesCommitted} cities to production database.`,
  });
}, [approvedCount, queryClient, toast]);
```

### Update StagingActionBar to Show Retry State

Add optional retry status to the progress display:

```typescript
interface CommitProgress {
  current: number;
  total: number;
  currentCityName?: string;
  retryAttempt?: number;
  retryMax?: number;
}

// In the progress display:
{commitProgress.retryAttempt && (
  <span className="text-amber-500 text-xs">
    Retry {commitProgress.retryAttempt}/{commitProgress.retryMax}...
  </span>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/NavioPreview.tsx` | Add retry logic, update progress tracking |
| `src/components/navio/StagingActionBar.tsx` | Show retry status in progress |

---

## Immediate Action

**You can resume the commit right now by clicking "Commit 13 Approved" again.** The remaining 13 cities will be processed. The fix above will prevent future interruptions.

---

## Summary

1. Add exponential backoff retry (5 attempts) for transient network errors
2. Update progress counter to use backend's `remaining` count
3. Show helpful toast on partial failure with resume instructions
4. Display retry attempts in the action bar during recovery
5. Automatically refresh data after partial commit to show accurate counts
