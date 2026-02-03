
# Fix Counter Bug & Improve Navio Import Progress UI

## Problems to Fix

### 1. Counter Bug (43/19 cities)
The edge function's `process_city` response is missing the `needsMoreProcessing` field. Since it's `undefined`, the frontend's check `!result.data.needsMoreProcessing` is always `true`, incrementing the counter on **every** edge function call instead of only when a city fully completes.

### 2. Unclear UI
The current UI just shows "Processing cities..." with no detail about what's happening inside each city (discovering districts, finding neighborhoods, etc.)

---

## Solution

### Part 1: Fix the Counter Bug

**File: `supabase/functions/navio-import/index.ts`**

Add the missing `needsMoreProcessing` to the `process_city` response:

```typescript
case "process_city": {
  const result = await processNextCity(...);
  
  return new Response(
    JSON.stringify({
      success: true,
      batch_id: batchId,
      processedCity: result.city,
      completed: result.completed,
      progress: result.progress,
      districtsDiscovered: result.districtsDiscovered,
      neighborhoodsDiscovered: result.neighborhoodsDiscovered,
      needsMoreProcessing: result.needsMoreProcessing,  // ADD THIS
      nextAction: result.completed ? "finalize" : "process_city",
    }),
    ...
  );
}
```

---

### Part 2: Enhanced Progress UI

**File: `src/components/sync/NavioCityProgress.tsx`**

Redesign to show detailed per-city progress:

| Element | Description |
|---------|-------------|
| Phase banner | Shows current phase with icon (Connecting, Discovering Districts, Finding Neighborhoods, Saving) |
| Current city card | Highlighted card showing the active city with live stats |
| Per-city stats | Districts found, neighborhoods discovered for each completed city |
| Animated indicators | Different animations for different phases |

```text
+-----------------------------------------------+
|  IMPORTING FROM NAVIO                          |
+-----------------------------------------------+
|                                                |
|  🔍 Discovering districts in München...        |
|                                                |
|  ┌─────────────────────────────────────────┐  |
|  │ 🏙️ München (DE)                    ●     │  |
|  │   Finding neighborhoods in Schwabing... │  |
|  │   ████████░░░░░░░░░░░░  15/31 districts │  |
|  │   → 45 neighborhoods found so far       │  |
|  └─────────────────────────────────────────┘  |
|                                                |
|  ✓ Toronto (CA) — 12 districts, 38 areas      |
|  ✓ Bergen (NO) — 8 districts, 24 areas        |
|  ○ Oslo (NO) — pending                         |
|  ○ Stockholm (SE) — pending                    |
|                                                |
|  ───────────────────────────────────────────  |
|  Cities: 3/19  ████░░░░░░░░░░░  16%           |
+-----------------------------------------------+
```

**File: `src/components/sync/NavioCityProgress.tsx`**

Update the `CityProgressData` interface to include detailed stats:

```typescript
export interface CityProgressData {
  phase: "idle" | "initializing" | "processing" | "finalizing" | "complete" | "error";
  currentCity: string | null;
  citiesTotal: number;
  citiesProcessed: number;
  cities: Array<{ 
    name: string; 
    countryCode: string;
    districtsFound?: number;
    neighborhoodsFound?: number;
    status?: "pending" | "processing" | "completed";
  }>;
  // New fields for detailed progress
  currentDistrictsTotal?: number;
  currentDistrictsProcessed?: number;
  currentNeighborhoodsFound?: number;
  errorMessage?: string;
}
```

**File: `src/hooks/useNavioImport.ts`**

Track detailed progress from edge function responses:

```typescript
// When processing
if (result.data.needsMoreProcessing) {
  // Still working on current city - show district progress
  setCityProgress(prev => ({
    ...prev,
    currentDistrictsProcessed: result.data.progress?.districtsProcessed || 0,
    currentDistrictsTotal: result.data.progress?.districtsTotal || 0,
    currentNeighborhoodsFound: result.data.neighborhoodsDiscovered || 0,
  }));
} else if (result.data.processedCity) {
  // City fully completed
  processedCount++;
  // Update the completed city with its final stats
  // Move to next city
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Add `needsMoreProcessing` to `process_city` response |
| `src/components/sync/NavioCityProgress.tsx` | Enhanced UI with per-city stats, district progress bar, phase explanations |
| `src/hooks/useNavioImport.ts` | Track district/neighborhood progress from responses, update city stats |

---

## Expected Result

1. Counter correctly shows "3/19 cities" (never exceeds total)
2. Active city shows: "Finding neighborhoods in Schwabing... 15/31 districts"
3. Completed cities show summary: "✓ Toronto (CA) — 12 districts, 38 areas"
4. User understands the system is discovering districts and their neighborhoods
5. Progress feels informative rather than broken
