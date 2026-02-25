

# Fix: Sync Collections One at a Time (Avoid Memory Limit)

## Problem

When syncing all 7 collections at once, the edge function runs out of memory and crashes with `WORKER_LIMIT` / "Memory limit exceeded". The function tries to process all collections (service_categories, services, cities, districts, areas, partners, service_locations) in a single invocation, which is too much for the serverless compute limit.

## Solution

Change the client-side sync logic to call the edge function **once per collection** sequentially, instead of sending all collections in a single request. Each call processes only one collection, stays well within memory limits, and the progress dialog still tracks everything via the shared `batch_id`.

## Changes

### 1. `src/pages/WebflowSync.tsx` -- Sequential per-collection calls

Update the `syncMutation` to loop through selected entities one at a time:

- Instead of sending `entity_type: "all"` or an `entities` array, call `supabase.functions.invoke("webflow-sync", { body: { entity_type: "cities", batch_id } })` for each entity sequentially
- Accumulate results across calls
- If one collection fails, log the error and continue with the next (resilient processing)
- The progress dialog already polls `sync_logs` by `batch_id`, so it will show progress across all sequential calls naturally

### 2. No edge function changes needed

The edge function already supports `entity_type: "cities"` (single entity mode). We just need to stop sending `"all"` or multi-entity requests from the client.

## Technical Details

The sync mutation will change from one call to a loop:

```
for each selected entity (in dependency order):
  call webflow-sync with entity_type = entity
  merge results into total
  if error, log and continue
```

The dependency order (service_categories first, service_locations last) is preserved client-side.

Only one file changes: `src/pages/WebflowSync.tsx`.
