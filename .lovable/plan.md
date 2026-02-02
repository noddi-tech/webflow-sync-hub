
# Fix Import Progress UI and Remove Non-Existent "intro-content" Field

## Issues Identified

### Issue 1: Import Dialog Shows Blank During Import

**Root Cause:** The batch ID synchronization is broken between client and server.

- **Client side (Dashboard.tsx):** Generates a batch ID with `crypto.randomUUID()` before calling the edge function
- **Server side (webflow-import):** Generates its own batch ID independently
- **Result:** The client polls for logs with a batch ID that doesn't match any server-generated logs

**Current Flow:**
```
Client: batchId = crypto.randomUUID()  →  "abc-123"
Client: Opens SyncProgressDialog with batchId "abc-123"
Client: Calls edge function (without sending batchId)
Server: batchId = crypto.randomUUID()  →  "xyz-789"
Server: Logs progress with batchId "xyz-789"
Client: Polls sync_logs WHERE batch_id = "abc-123"  →  No results!
```

**Solution:** Pass the client-generated batch ID to the edge function so logs are written with the matching ID.

---

### Issue 2: Partners Collection Shows "Missing Fields" for `intro-content`

**Root Cause:** The app's `EXPECTED_FIELDS` includes `intro-content` for the Partners collection, but this field does **NOT exist** in the actual Webflow Partners schema.

From the validation API response:
- Partners has 20 found fields
- `intro-content` is listed as "missing_in_webflow"
- This is because we added it to EXPECTED_FIELDS in a previous update, but it was never created in Webflow

**Solution:** Since the philosophy is that Webflow is the actual schema source, remove `intro-content` from Partners' EXPECTED_FIELDS. If you need this field in the future, create it in Webflow first.

---

## Implementation Plan

### Phase 1: Fix Batch ID Synchronization

**File: `src/pages/Dashboard.tsx`**

Update both mutation functions to pass the batch ID to the edge function:

```typescript
const importMutation = useMutation({
  mutationFn: async ({ entityType, batchId }: { entityType: EntityType; batchId: string }) => {
    const { data, error } = await supabase.functions.invoke("webflow-import", {
      body: { entity_type: entityType, batch_id: batchId },
    });
    // ...
  },
  onMutate: (entityType) => {
    const entities = ...;
    const batchId = crypto.randomUUID();
    setCurrentBatchId(batchId);
    // Return context for mutation call
    return { batchId };
  },
  // Adjust mutate calls to use { entityType, batchId }
});
```

Actually, a cleaner approach - generate batch ID in `onMutate`, store it in state, and pass it in the mutation function.

**File: `supabase/functions/webflow-import/index.ts`**

Accept `batch_id` from the request body instead of generating it internally:

```typescript
// Line ~380 - where request body is parsed
const { entity_type, batch_id } = await req.json();
const batchId = batch_id || crypto.randomUUID(); // Use provided or generate fallback
```

**File: `supabase/functions/webflow-sync/index.ts`**

Same change - accept `batch_id` from request.

---

### Phase 2: Improve Progress Dialog UX

**File: `src/components/sync/SyncProgressDialog.tsx`**

Add a loading state when no progress data is available yet:

```typescript
// When dialog is open but no progress logs yet
{!hasAnyProgress && !isComplete && (
  <div className="flex flex-col items-center py-8 space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">
      Connecting to Webflow...
    </p>
  </div>
)}
```

This provides visual feedback during the initial API connection phase before progress logs start arriving.

---

### Phase 3: Remove Non-Existent Field from EXPECTED_FIELDS

**File: `supabase/functions/webflow-validate/index.ts`**

Remove `intro-content` from the partners EXPECTED_FIELDS array (around line 140):

```typescript
partners: [
  // ... other fields ...
  // REMOVE this line:
  // { slug: "intro-content", type: "RichText", required: false, description: "Rich text intro for SEO and partner context." },
  // ... rest of fields ...
],
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Pass batch_id to edge function in mutation body |
| `src/components/sync/SyncProgressDialog.tsx` | Add loading spinner when connecting/no data yet |
| `supabase/functions/webflow-import/index.ts` | Accept batch_id from request body |
| `supabase/functions/webflow-sync/index.ts` | Accept batch_id from request body |
| `supabase/functions/webflow-validate/index.ts` | Remove `intro-content` from partners EXPECTED_FIELDS |

---

## Expected Results

1. **Import/Sync Dialog** will show real-time progress with entities, counts, and progress bars
2. **Partners Collection** will show "Ready" status with 20 fields mapped (no missing fields)
3. **All 7 collections** will show green "Ready" status in System Health
