
## Diagnosis (why it “finishes” but no UI log appears)

Your **Coverage Check does run and return results**, but it **logs to the wrong table**.

- In `supabase/functions/navio-import/index.ts`, the helper `logSync()` inserts into **`sync_logs`**:
  ```ts
  await supabase.from("sync_logs").insert({ ... })
  ```
- The “Recent Operations” UI on the Navio dashboard reads from **`navio_operation_log`**:
  - `src/hooks/useNavioOperationLog.ts` → `.from("navio_operation_log")`
  - `src/components/navio/OperationHistoryTable.tsx` renders those rows

So even though the function “logs”, it’s logging into **Sync History**, not **Navio Recent Operations**. That’s why you see “no feedback” in the place you’re watching.

Additionally, the current `logSync()` statuses (`in_progress`, `complete`) don’t match the Navio operation log statuses used by the UI (`started`, `success`, `failed`), so we need a small mapping.

---

## What I will change

### A) Make `coverage_check` write to `navio_operation_log` (the table your UI uses)

**File:** `supabase/functions/navio-import/index.ts`

1. **Add a dedicated helper** for Navio operation logging (insert + update) that writes to `navio_operation_log`.
2. In the `coverage_check` case:
   - Insert a row at start: `operation_type='coverage_check'`, `status='started'`, `batch_id=<uuid>`, `details={ message: 'Starting…' }`
   - On success: update that same row to `status='success'`, set `completed_at`, store a summary in `details`
   - On error: update to `status='failed'`, set `completed_at`, store error info in `details`
3. Keep the existing `settings` upsert (so the card can still show the last result).

**Important implementation detail:**
- We’ll capture the inserted row `id` (via `.insert(...).select("id").single()`) so we can update the exact entry later.
- We’ll also ensure `batch_id` is always present by explicitly generating it if missing.

### B) Teach the “Recent Operations” UI about the new operation type

Right now, the UI’s type unions/mappings don’t include `coverage_check`.

**Files:**
- `src/hooks/useNavioOperationLog.ts`
  - Extend `OperationType` union to include `"coverage_check"`.
- `src/components/navio/OperationHistoryTable.tsx`
  - Add icon + label for `"coverage_check"` (use a Shield icon, matching the card).
  - This ensures the operation displays nicely instead of falling back to generic text.

### C) (Small robustness) ensure the card triggers a unique batch id & refreshes logs

**File:** `src/components/navio/CoverageHealthCard.tsx`

- Call the function with a `batch_id`:
  ```ts
  body: { mode: "coverage_check", batch_id: crypto.randomUUID() }
  ```
- Keep invalidation of the operation log query; optionally broaden it to ensure it matches the `["navio-operation-log", limit]` query keys.

---

## Expected result after the fix

When you click **Check Coverage**:

1. The button spins while running (as it does now).
2. When it completes:
   - You’ll still get the toast (success/warning/error).
   - A new row will appear under **Recent Operations**:
     - “Coverage Check” with status:
       - `started` → `success` (or `failed`)
     - Duration will display correctly because `completed_at` will be set.
3. The operation will be visible immediately after completion without needing a hard refresh.

---

## Step-by-step implementation sequence (safe and fast)

1. Update `supabase/functions/navio-import/index.ts`
   - Implement `navio_operation_log` insert/update around `coverage_check`
   - Wrap `coverage_check` in `try/catch` so failures also log
2. Update UI typings/mappings
   - `src/hooks/useNavioOperationLog.ts` add `"coverage_check"`
   - `src/components/navio/OperationHistoryTable.tsx` add icon/label
3. Update `src/components/navio/CoverageHealthCard.tsx`
   - Send `batch_id`
   - Ensure invalidation updates the operation history list
4. Manual verification
   - Go to `/navio` → click **Check Coverage**
   - Confirm an operation appears in **Recent Operations** and completes

---

## Notes / Non-goals (for clarity)

- This fix is specifically about “why it doesn’t show up in Recent Operations”.
- It does not change the underlying coverage math yet (that can be improved later if you want a true spatial intersect check).
