
# Fix Duplicate Cities and Misspellings in Navio Import

## Problems Identified

### Problem 1: "Tornoto" Typo in Source Data
The Navio API returns an area named **"Canada Tornoto - Mimico-Queensway"** - a typo for "Toronto". The current city normalization map doesn't catch this, so it creates a separate "Tornoto (CA)" city instead of merging it with "Toronto (CA)".

### Problem 2: Duplicate Cities in Queue
Every city appears exactly twice because:
- Two different batch IDs exist: `7613371e-...` and `c7a9a60c-...`
- Each batch has 20 cities
- The UI is showing cities from BOTH batches combined, causing duplicates

## Solution

### 1. Add Typo Corrections to City Normalization Map

Add known Navio typos to `citySpellingNormalizations` in `navio-import/index.ts`:

```typescript
const citySpellingNormalizations: Record<string, string> = {
  // ... existing entries ...
  'tornoto': 'Toronto',  // Navio typo
  'gotehburg': 'Göteborg', // Already exists
  'gotheburg': 'Göteborg', // Already exists
  // Add more as discovered
};
```

### 2. Ensure Old Queue Entries Are Cleared Before New Import

The initialization already has `DELETE ... WHERE batch_id = ?`, but the issue is that old batches from previous imports remain. We should clean up all old pending/processing batches when a new import starts.

Modify `initializeImport()`:

```typescript
// Clear ALL old pending/processing entries from previous batches
await supabase
  .from("navio_import_queue")
  .delete()
  .in("status", ["pending", "processing"]);

// Also clear this specific batch if it exists
await supabase
  .from("navio_import_queue")
  .delete()
  .eq("batch_id", batchId);
```

### 3. Fix UI to Show Only Current Batch

The `NavioCityProgress` component receives the city list from the initialization response, so this is correct. However, the progress polling should also filter by batch_id.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Add "tornoto" → "Toronto" typo fix to normalizations; clear all old pending batches before starting new import |

## Expected Result

After these changes:
- "Tornoto" will be normalized to "Toronto" during parsing
- Only ONE "Toronto (CA)" city will appear with all 12 areas combined
- Starting a new import will clear any leftover queue entries from previous imports
- No duplicate cities in the progress list
