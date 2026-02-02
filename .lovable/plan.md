

# Fix: Navio Import Edge Function Timeout Issue

## Problem Identified

The error occurs because:
1. The `navio-import` edge function starts processing correctly
2. It fetches 216 areas from Navio API
3. It begins AI classification (batches of 30 = 8 batches with 500ms delays between each)
4. The **browser connection times out** before the function completes
5. When the connection closes mid-request, no CORS headers are returned, causing the CORS error

Evidence from logs:
- "Navio API response structure" shows 216 items being fetched
- "Http: connection closed before message completed" confirms timeout

## Root Cause

Edge functions have a 60-second execution limit, but the browser may time out sooner. The AI classification process with rate limit delays takes too long for a synchronous HTTP request.

## Solution

Modify the edge function to return immediately with a batch ID, then process asynchronously. The frontend can poll for progress using the existing `sync_logs` table.

---

## Implementation Changes

### 1. Edge Function: Return Early with Batch ID

Instead of waiting for the entire import to complete, return a response immediately after starting the process:

**Before:**
```typescript
serve(async (req) => {
  // ... process everything synchronously
  return new Response(JSON.stringify(result));
});
```

**After:**
```typescript
serve(async (req) => {
  // Quick validation
  // Start async processing
  // Return immediately with batch_id
  
  // Use EdgeRuntime.waitUntil() for background processing
  EdgeRuntime.waitUntil(processInBackground());
  
  return new Response(JSON.stringify({ 
    message: "Import started", 
    batch_id: batchId 
  }), { headers: corsHeaders });
});
```

### 2. Use Deno's waitUntil for Background Processing

The `EdgeRuntime.waitUntil()` API allows the function to return a response while continuing to process in the background:

```typescript
// At the start of the function
declare const EdgeRuntime: { waitUntil(promise: Promise<void>): void };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Quick validation
  const batchId = crypto.randomUUID();
  
  // Start background processing
  EdgeRuntime.waitUntil(
    processNavioImport(batchId, mode)
  );
  
  // Return immediately
  return new Response(
    JSON.stringify({ 
      message: "Import started - check progress in sync logs",
      batch_id: batchId,
      status: "processing"
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

### 3. Update Frontend to Poll for Completion

Modify `navioPreviewMutation` in Dashboard.tsx to:
1. Receive the batch_id from the initial response
2. Poll the sync_logs table for progress
3. Navigate to preview page when complete

The existing `SyncProgressDialog` already polls `sync_logs`, so it should work with minimal changes.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Add `EdgeRuntime.waitUntil()` for async processing, return early with batch_id |
| `src/pages/Dashboard.tsx` | Update mutation handlers to handle async response and wait for completion |

---

## Alternative: Increase Batch Size + Reduce Delays

A simpler fix that might work without architectural changes:

1. Increase batch size from 30 to 50 (fewer API calls)
2. Reduce delay between batches from 500ms to 200ms
3. This might complete within the timeout window

This is a quicker fix to try first before implementing the full async solution.

---

## Recommended Approach

**Try the simple fix first:**
1. Increase AI batch size to 50
2. Reduce inter-batch delay to 200ms
3. This should complete ~216 areas in ~5 batches (50s estimated)

**If that still times out, implement the async solution:**
1. Use `EdgeRuntime.waitUntil()` for background processing
2. Return immediately with batch_id
3. Frontend polls sync_logs for completion

---

## Quick Fix Implementation

Update `supabase/functions/navio-import/index.ts`:

```typescript
// Line 261: Change batch size
const batchSize = 50; // Was 30

// Line 364: Reduce delay
await new Promise(resolve => setTimeout(resolve, 200)); // Was 500
```

This reduces processing time by ~40% and should prevent timeouts.

