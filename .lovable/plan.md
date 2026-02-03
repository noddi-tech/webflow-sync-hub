
## What’s failing (root cause)
From the screenshots + current database state, the “Failed to send a request to the Edge Function” is not primarily a UI bug. It’s happening because **some `process_city` calls still occasionally run long enough to get cut off by the platform timeout** (or return a gateway error). When that happens, the browser often reports it as a **CORS error** (“No Access-Control-Allow-Origin”) because the **timeout/gateway response is not coming from our function code** and therefore doesn’t include our CORS headers.

Evidence in your database right now:
- `navio_import_queue` shows **Trondheim stuck in `status=processing` with `districts_discovered=5` but `districts_processed=0`**.
- That pattern strongly suggests: districts were discovered and saved, then the function started neighborhood discovery and got killed **before it could checkpoint `districts_processed`**.
- Once the frontend hits a request failure, it aborts the loop and the batch stays half-done.

So the true root cause is:
1) **Per-call execution time is still sometimes too close to the limit**, and  
2) **We checkpoint progress too late** (only after finishing a whole batch), and  
3) **Frontend has no resilient retry/resume**, so one transient failure kills the whole run.

This plan addresses all three so the same class of failure doesn’t keep coming back.

---

## Goals
1) Make it extremely unlikely a single `process_city` call ever times out.
2) Make progress recoverable even if a call is killed mid-way.
3) Make the UI resilient: automatic retries + user-visible “Resume” that continues the same batch instead of starting over.
4) Improve “what is happening” messaging (discovering districts vs neighborhoods), using real backend status instead of guesses.

---

## Backend changes (navio-import function)
### A) Harden CORS/preflight (prevents genuine CORS issues and improves reliability)
**File:** `supabase/functions/navio-import/index.ts`
- Extend `corsHeaders` with:
  - `Access-Control-Allow-Methods: "POST, OPTIONS"`
  - (optional but recommended) `Access-Control-Max-Age: "86400"`
- Change OPTIONS handler to return `"ok"` body and include methods.
- Ensure every response path (including early returns) includes the full CORS header set.

Why: even though we already include `Access-Control-Allow-Origin` in normal responses, preflight + some clients behave better with explicit methods, and it reduces “false CORS” confusion when debugging.

### B) Add time-budgeted district processing (avoid timeouts deterministically)
**File:** `supabase/functions/navio-import/index.ts`
- Replace “always process next 5 districts” with **time-budget processing**:
  - Set `const DEADLINE_MS = 45_000` (or similar safety budget).
  - Process districts until:
    - `districtIndex === totalDistricts`, or
    - `Date.now() - startTime > DEADLINE_MS`, then stop and return `needsMoreProcessing: true`.
- Keep `MAX_DISTRICTS_PER_CALL` as an upper bound, but the real guard is the deadline.

Why: a fixed count (5) can still exceed the limit if external calls slow down. A time budget prevents this.

### C) Checkpoint after every district (so crashes don’t lose work)
**File:** `supabase/functions/navio-import/index.ts`
- Inside the district loop, after each district:
  - Update `discovered_hierarchy` (with the neighborhoods for that district)
  - Update `districts_processed` to `i + 1`
  - Update `neighborhoods_discovered` to the current running total
  - Update a new timestamp field `last_progress_at = now()`
- This makes the workflow **idempotent** and resumable. If the runtime dies mid-call, the next call continues from the last saved district.

### D) Speed up AI calls (reduce latency spikes that trigger timeouts)
**File:** `supabase/functions/navio-import/index.ts`
- Update `callAI()` so Gemini and OpenAI calls run **in parallel** (Promise.allSettled).
- Add per-request timeouts (AbortController) so one slow provider doesn’t stall the whole function.
- Add small, bounded retries for AI calls (e.g., 1 retry) with jitter for transient upstream issues.

Why: current `callAI()` is sequential (Gemini then OpenAI), which increases wall time per district.

### E) Return richer progress/status for UI (“what’s happening”)
**File:** `supabase/functions/navio-import/index.ts`
Add fields to `process_city` response, e.g.:
- `stage`: `"discovering_districts" | "discovering_neighborhoods" | "checkpointing" | "completed_city"`
- `districtProgress`: `{ processed: number; total: number; currentDistrict?: string }`

Why: right now the frontend tries to infer district progress from a queue-progress object that doesn’t contain district totals. This will make the UI accurate and explanatory.

---

## Database change (small but important)
### Add `last_progress_at` to `navio_import_queue`
**Migration:** new SQL file in `supabase/migrations/`
- `ALTER TABLE navio_import_queue ADD COLUMN last_progress_at timestamptz;`
- Default: `now()` (or nullable but set whenever processing starts/updates)

Why:
- Helps resume logic, debug, and optionally detect “stuck” processing rows.
- Allows us to safely implement “if processing row is stale, keep processing or reset” policies later without guessing.

---

## Frontend changes (resilience + better UX)
### A) Retry/backoff for all navio-import calls (prevents one blip from failing the batch)
**File:** `src/hooks/useNavioImport.ts`
- Wrap `supabase.functions.invoke("navio-import")` in an `invokeWithRetry()` helper:
  - Retry 3–5 times on retryable errors:
    - “Failed to send a request to the Edge Function”
    - network fetch failures
    - transient 5xx
    - CORS-looking failures that happen when the platform returns a gateway timeout
  - Exponential backoff with jitter: 1s → 2s → 4s → 8s
- During retry, update progress state to show “Reconnecting / retrying (2/5)…”.

Why: this is the single biggest improvement for user-perceived reliability.

### B) Persist batch + allow Resume (fixes “stuck processing” without starting over)
**Files:** `src/hooks/useNavioImport.ts`, `src/pages/Dashboard.tsx`, `src/components/sync/SyncProgressDialog.tsx`, `src/components/sync/NavioCityProgress.tsx`
- Store the current `batchId` and initial `cities` list in `localStorage` as soon as initialize succeeds.
- If the import fails:
  - Keep the batchId
  - Show a “Resume import” button (in the error state UI) that continues calling `process_city` for the same batchId (no re-initialize unless explicitly requested).
- Add a “Start over” secondary action that generates a new batchId and runs initialize fresh.

Why: today, when it fails, you lose the batch and leave rows in `processing`. Resume makes the workflow robust and avoids repeating work.

### C) Fix district progress UI to use real backend fields
**File:** `src/hooks/useNavioImport.ts`, `src/components/sync/NavioCityProgress.tsx`
- Stop reading district progress from `progress` (queue progress).
- Use the new backend `districtProgress` and `stage` to render:
  - “Discovering districts…”
  - “Finding neighborhoods…”
  - “Saving progress…”
  - “Retrying request (n/m)…”
- Display current district name when available.

---

## “Stuck” batch cleanup policy (so it doesn’t build up again)
We’ll keep your improved initialization cleanup (delete other batches), but we’ll make it intentional:
- Only delete other batches when starting a brand-new import.
- Resume should not delete anything; it should continue the same batch.

Optionally (nice-to-have after reliability is restored):
- Add a small UI action “Clear old batches” in Settings/Debug that deletes `navio_import_queue` rows older than X days.

---

## Implementation sequence
1) Backend: CORS + time-budget + per-district checkpointing + parallel AI calls + richer response fields.
2) DB migration: add `last_progress_at`.
3) Frontend: retry/backoff wrapper.
4) Frontend: persist batch + Resume/Start over UI.
5) Frontend: update UI messaging using `stage` + `districtProgress`.
6) Validation run (end-to-end):
   - Run a full import.
   - Confirm Trondheim (and other multi-district cities) increments `districts_processed` in DB while running.
   - Confirm a forced refresh / temporary disconnect can be resumed without restarting.
   - Confirm no more “CORS blocked” during normal flow; and if the platform times out, retries recover automatically.

---

## Validation checklist (what you should see after)
- No city remains stuck at `status=processing` with `districts_processed=0` after it has begun district work.
- The UI explains the current phase:
  - “Discovering districts in X”
  - “Finding neighborhoods in X → District Y (3/5)”
  - “Saving progress…”
- If a request fails transiently:
  - UI shows “Retrying…”
  - Import continues automatically
- If it fails repeatedly:
  - UI shows “Resume import” (keeps batchId)
  - Resume continues from last checkpoint instead of repeating districts.
