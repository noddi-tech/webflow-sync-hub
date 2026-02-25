

# Fix: Areas Sync Memory Limit via Chunked Processing

## Problem

The `webflow-sync` edge function crashes with "Memory limit exceeded" when syncing `areas`, even when called individually. The areas table has 5000+ rows, and loading them all at once (with joins to districts and cities) plus the 1500-line function code exceeds the 150MB memory limit.

## Solution

Add **chunked processing** so the client calls the areas sync in smaller batches (e.g., 50 items at a time), and the edge function only loads and processes that subset.

## Changes

### 1. `supabase/functions/webflow-sync/index.ts` -- Accept `offset` and `limit` parameters

- Accept optional `offset` and `limit` fields in the request body
- When provided, use `.range(offset, offset + limit - 1)` on the database query
- Return the total count so the client knows when to stop
- Apply this to ALL entity types, not just areas (future-proofing)

The response will include a new `total` field:
```json
{
  "success": true,
  "synced": { "areas": { "created": 0, "updated": 5 } },
  "total": 5200,
  "offset": 0,
  "limit": 50
}
```

### 2. `src/pages/WebflowSync.tsx` -- Chunk large collections

- For each entity, first call with `offset: 0, limit: 50`
- Read the `total` from the response
- Loop with increasing offset until all items are processed
- Accumulate created/updated counts across chunks
- The progress dialog will naturally track via `sync_logs`

### 3. Reduce function memory footprint

- Move the large SEO content template strings into a helper that only executes for `service_locations` entity type (lazy evaluation)
- Only load the `ServiceLocationGroup` interface and related functions when `entity_type === "service_locations"`
- This avoids allocating memory for unused code paths

## Technical Details

### Edge function changes (pseudocode)

```text
// Parse offset/limit from body
const offset = body.offset ?? 0;
const limit = body.limit ?? 50;

// For each entity query, add pagination:
const { data, count } = await supabase
  .from("areas")
  .select("*, districts!inner(webflow_item_id), cities(webflow_item_id)", { count: "exact" })
  .range(offset, offset + limit - 1);

// Return total count in response
return { success: true, synced, total: count, offset, limit }
```

### Client-side chunking (pseudocode)

```text
for each entity:
  offset = 0
  limit = 50
  loop:
    result = call webflow-sync with { entity_type, batch_id, offset, limit }
    merge results
    offset += limit
    if offset >= result.total: break
```

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/webflow-sync/index.ts` | Accept offset/limit params, paginate queries, return total count |
| `src/pages/WebflowSync.tsx` | Loop through chunks for each entity instead of single call |

