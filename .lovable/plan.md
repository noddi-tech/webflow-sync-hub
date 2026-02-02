
# Fix Edge Function Timeout and Duplicate Cities

## Problems Identified

### 1. Edge Function Not Deployed
The typo fix (`'tornoto': 'Toronto'`) was added to the code but the database still shows "Tornoto" as a separate city. This indicates the updated edge function wasn't deployed or wasn't used.

### 2. Old Batches Not Cleared  
Database shows 2 batches exist (`c7a9a60c-...` AND `7613371e-...`), both with pending entries. The cleanup query isn't working because:
- The Supabase client `.in()` method may not be correctly filtering
- The edge function crashed before completing cleanup

### 3. Edge Function Timeout During City Processing
The logs show the function was processing München (31 districts) and shut down at district 23/31. This is hitting the ~60 second edge function timeout.

Each district requires:
- 2 AI calls (Gemini + OpenAI) for neighborhood discovery
- Each AI call takes 2-5 seconds

For München: 31 districts × 2 calls × ~3 seconds = ~186 seconds (well over the 60s limit)

## Solution

### 1. Process Districts in Smaller Batches
Instead of processing ALL districts for a city in one function call, process them incrementally (5-10 at a time) to stay under the timeout.

Modify `processSingleCity()`:
- Add `max_districts_per_call` parameter (default: 5)
- Track `districts_processed` in the queue row
- If more districts remain, return `{ completed: false, needsMoreProcessing: true }`
- Frontend keeps calling until city is fully processed

### 2. Fix Delete Query Syntax
Change from:
```typescript
await supabase.from("navio_import_queue").delete().in("status", ["pending", "processing"]);
```

To use `.or()` for compatibility:
```typescript
await supabase.from("navio_import_queue").delete().or("status.eq.pending,status.eq.processing");
```

### 3. Deploy Edge Function and Clear Database
- Clear the `navio_import_queue` table manually before redeploying
- Ensure the edge function is deployed with all fixes

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Fix delete query syntax; add district batching (5 at a time); track `districts_processed` in queue |

---

## Database Changes

| Table | Change |
|-------|--------|
| `navio_import_queue` | Add `districts_processed` column (integer, default 0) to track incremental progress |
| `navio_import_queue` | Clear all existing entries before testing |

---

## Expected Result

1. Cities with many districts (like München with 31) will be processed across multiple function calls
2. Each call processes 5-10 districts, staying well under the 60s timeout
3. "Tornoto" will be normalized to "Toronto" and only one Toronto city appears
4. Old pending/processing batches are properly cleared
