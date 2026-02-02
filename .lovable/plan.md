
# Fix Navio Import Timeout - Incremental City Processing

## Problem Analysis

The current Navio import times out because it processes **all cities in a single function invocation**:

1. For each city, the function:
   - Calls AI to discover districts (~2-4 seconds per model, 2 models = ~5 seconds)
   - For each district (8-25 per city), calls AI to discover neighborhoods (~5 seconds each)
   
2. **Example: Processing 21 cities**
   - Oslo: 15 districts x 5 seconds = 75 seconds (already over timeout!)
   - Bergen: 8 districts x 5 seconds = 40 seconds
   - Munchen: 25 districts x 5 seconds = 125 seconds
   - **Total: 400+ seconds** vs 60-second Edge Function timeout

3. The `EdgeRuntime.waitUntil()` helps but still has limits (~5 minute maximum), and the function crashed after processing only 4 cities.

---

## Solution: Incremental City-by-City Processing

Process one city per function invocation, with the frontend orchestrating successive calls.

```text
CURRENT FLOW (times out):
┌─────────────────────────────────────────────────┐
│ Single Function Call                            │
│  → Process Oslo (15 districts, ~75s)            │
│  → Process Bergen (8 districts, ~40s)           │
│  → Process Munchen (25 districts, ~125s)        │
│  → ... 18 more cities                           │
│  💥 TIMEOUT after ~4 cities                     │
└─────────────────────────────────────────────────┘

NEW FLOW (incremental):
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Call 1: Initialize │→  │ Call 2: Oslo       │→  │ Call 3: Bergen     │→ ...
│ - Fetch Navio      │   │ - 15 districts     │   │ - 8 districts      │
│ - Analyze cities   │   │ - ~75 seconds      │   │ - ~40 seconds      │
│ - Create queue     │   │ - Update progress  │   │ - Update progress  │
└────────────────────┘   └────────────────────┘   └────────────────────┘
         ↑                        ↑                        ↑
         └───── Frontend polls & triggers next city ───────┘
```

---

## Technical Implementation

### 1. New Database Table: `navio_import_queue`

Track cities pending processing:

```sql
CREATE TABLE navio_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  navio_areas JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, error
  error_message TEXT,
  districts_discovered INTEGER DEFAULT 0,
  neighborhoods_discovered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_navio_import_queue_batch ON navio_import_queue(batch_id);
CREATE INDEX idx_navio_import_queue_status ON navio_import_queue(batch_id, status);
```

### 2. Updated Edge Function Modes

The `navio-import` function will support new request parameters:

| Mode | Action |
|------|--------|
| `mode: "initialize"` | Fetch Navio data, analyze cities, populate queue, return immediately |
| `mode: "process_city"` | Process a single city from the queue, discover districts/neighborhoods |
| `mode: "finalize"` | After all cities processed, save all results to staging |
| `mode: "commit"` | Commit staging to production (unchanged) |

### 3. Updated Edge Function: `navio-import/index.ts`

#### New Initialization Handler

```typescript
async function initializeImport(
  supabase: SupabaseClient,
  batchId: string,
  navioToken: string,
  lovableKey: string
): Promise<{ totalCities: number; cities: string[] }> {
  // Fetch Navio data
  const serviceAreas = await fetchNavioServiceAreas(navioToken);
  
  // Parse and extract unique cities
  const cityMap = extractCitiesFromNavioData(serviceAreas, lovableKey);
  
  // Clear any existing queue for this batch
  await supabase.from("navio_import_queue").delete().eq("batch_id", batchId);
  
  // Insert cities into queue
  const queueEntries = Array.from(cityMap.entries()).map(([key, data]) => ({
    batch_id: batchId,
    city_name: data.name,
    country_code: data.countryCode,
    navio_areas: data.navioAreas,
    status: "pending",
  }));
  
  await supabase.from("navio_import_queue").insert(queueEntries);
  
  await logSync(supabase, "navio", "import", "in_progress", null,
    `Queued ${queueEntries.length} cities for processing`, batchId, 0, queueEntries.length);
  
  return { 
    totalCities: queueEntries.length, 
    cities: queueEntries.map(e => e.city_name) 
  };
}
```

#### New Single City Processor

```typescript
async function processNextCity(
  supabase: SupabaseClient,
  batchId: string,
  lovableKey: string,
  openAIKey?: string
): Promise<{ 
  city: string | null; 
  completed: boolean; 
  progress: { current: number; total: number } 
}> {
  // Get next pending city
  const { data: nextCity } = await supabase
    .from("navio_import_queue")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (!nextCity) {
    // No more cities to process
    return { city: null, completed: true, progress: await getQueueProgress(supabase, batchId) };
  }
  
  // Mark as processing
  await supabase
    .from("navio_import_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", nextCity.id);
  
  await logSync(supabase, "navio", "import", "in_progress", null,
    `Processing ${nextCity.city_name}...`, batchId);
  
  try {
    // Discover districts for this city
    const districts = await discoverDistrictsForCity(
      nextCity.city_name, 
      nextCity.country_code, 
      lovableKey, 
      openAIKey
    );
    
    let neighborhoodCount = 0;
    const hierarchy = { districts: new Map() };
    
    // Discover neighborhoods for each district
    for (const districtName of districts) {
      const neighborhoods = await discoverNeighborhoodsForDistrict(
        nextCity.city_name,
        districtName,
        nextCity.country_code,
        lovableKey,
        openAIKey
      );
      
      hierarchy.districts.set(districtName, {
        name: districtName,
        neighborhoods,
        source: 'discovered'
      });
      
      neighborhoodCount += neighborhoods.length;
      
      // Small delay between districts
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Store discovered hierarchy in queue row
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString(),
        districts_discovered: districts.length,
        neighborhoods_discovered: neighborhoodCount,
        // Store the discovered hierarchy for later finalization
        discovered_hierarchy: Object.fromEntries(hierarchy.districts)
      })
      .eq("id", nextCity.id);
    
    return { 
      city: nextCity.city_name, 
      completed: false, 
      progress: await getQueueProgress(supabase, batchId) 
    };
  } catch (error) {
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "error", 
        error_message: error instanceof Error ? error.message : "Unknown error"
      })
      .eq("id", nextCity.id);
    
    throw error;
  }
}
```

#### Updated HTTP Handler

```typescript
serve(async (req) => {
  const { batch_id, mode } = await req.json();
  
  switch (mode) {
    case "initialize":
      // Quick: Fetch Navio, create city queue
      const initResult = await initializeImport(...);
      return Response.json({ 
        success: true, 
        batch_id, 
        totalCities: initResult.totalCities,
        cities: initResult.cities,
        nextAction: "process_city"
      });
      
    case "process_city":
      // Process one city at a time
      const result = await processNextCity(...);
      return Response.json({
        success: true,
        batch_id,
        processedCity: result.city,
        completed: result.completed,
        progress: result.progress,
        nextAction: result.completed ? "finalize" : "process_city"
      });
      
    case "finalize":
      // Combine all discovered data, save to staging
      await finalizeImport(...);
      return Response.json({ success: true, batch_id, nextAction: "preview" });
      
    case "commit":
      // Unchanged - commit to production
      ...
  }
});
```

### 4. Updated Frontend: `Dashboard.tsx`

Add a new mutation that orchestrates the incremental process:

```typescript
const [importState, setImportState] = useState<{
  phase: "idle" | "initializing" | "processing" | "finalizing" | "complete";
  currentCity: string | null;
  citiesTotal: number;
  citiesProcessed: number;
  cities: string[];
}>();

const navioIncrementalImport = useMutation({
  mutationFn: async ({ batchId }: { batchId: string }) => {
    // Phase 1: Initialize
    setImportState({ phase: "initializing", currentCity: null, citiesTotal: 0, citiesProcessed: 0, cities: [] });
    
    const initResult = await supabase.functions.invoke("navio-import", {
      body: { batch_id: batchId, mode: "initialize" }
    });
    
    if (initResult.error) throw initResult.error;
    
    const { totalCities, cities } = initResult.data;
    setImportState(prev => ({ 
      ...prev!, 
      phase: "processing", 
      citiesTotal: totalCities, 
      cities 
    }));
    
    // Phase 2: Process cities one by one
    let completed = false;
    let processedCount = 0;
    
    while (!completed) {
      const result = await supabase.functions.invoke("navio-import", {
        body: { batch_id: batchId, mode: "process_city" }
      });
      
      if (result.error) throw result.error;
      
      if (result.data.processedCity) {
        processedCount++;
        setImportState(prev => ({ 
          ...prev!, 
          currentCity: result.data.processedCity,
          citiesProcessed: processedCount
        }));
      }
      
      completed = result.data.completed;
    }
    
    // Phase 3: Finalize
    setImportState(prev => ({ ...prev!, phase: "finalizing", currentCity: null }));
    
    await supabase.functions.invoke("navio-import", {
      body: { batch_id: batchId, mode: "finalize" }
    });
    
    setImportState(prev => ({ ...prev!, phase: "complete" }));
    
    return { success: true };
  },
});
```

### 5. Enhanced Progress Dialog: `SyncProgressDialog.tsx`

Update to show city-level progress:

```typescript
// New props for city-level progress
interface SyncProgressDialogProps {
  // ... existing props
  cityProgress?: {
    currentCity: string | null;
    citiesTotal: number;
    citiesProcessed: number;
    cities: string[];
    phase: "initializing" | "processing" | "finalizing" | "complete";
  };
}

// In render:
{source === "navio" && cityProgress && (
  <div className="space-y-3">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">
        {cityProgress.phase === "initializing" && "Fetching Navio data..."}
        {cityProgress.phase === "processing" && `Processing ${cityProgress.currentCity}...`}
        {cityProgress.phase === "finalizing" && "Saving results..."}
        {cityProgress.phase === "complete" && "Import complete!"}
      </span>
      <span className="text-muted-foreground">
        {cityProgress.citiesProcessed}/{cityProgress.citiesTotal} cities
      </span>
    </div>
    <Progress value={(cityProgress.citiesProcessed / cityProgress.citiesTotal) * 100} />
    
    {/* City list with status indicators */}
    <div className="max-h-40 overflow-y-auto space-y-1">
      {cityProgress.cities.map((city, idx) => (
        <div key={city} className="flex items-center gap-2 text-sm">
          {idx < cityProgress.citiesProcessed ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : city === cityProgress.currentCity ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          ) : (
            <div className="h-3 w-3 rounded-full border border-muted" />
          )}
          <span className={city === cityProgress.currentCity ? "font-medium" : "text-muted-foreground"}>
            {city}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Create `navio_import_queue` table with RLS policies |
| `supabase/functions/navio-import/index.ts` | Add `initialize`, `process_city`, `finalize` modes; refactor into incremental functions |
| `src/pages/Dashboard.tsx` | Replace single mutation with orchestrated multi-call approach; add city progress state |
| `src/components/sync/SyncProgressDialog.tsx` | Add city-level progress display with scrollable city list |

---

## Expected Behavior

### User Experience

1. User clicks "Fetch & Preview"
2. Dialog shows: "Fetching Navio data..." (2-3 seconds)
3. Dialog shows: "Processing Oslo..." with progress bar (0/21 cities)
4. Each city takes 30-90 seconds depending on size
5. Dialog updates: "Processing Bergen..." (1/21 cities)
6. After all cities: "Saving results..." 
7. Redirect to Navio Preview page

### Timing

| City | Districts | Est. Time |
|------|-----------|-----------|
| Oslo | 15 | ~60 seconds |
| Bergen | 8 | ~35 seconds |
| Trondheim | 4 | ~20 seconds |
| Munchen | 25 | ~90 seconds |
| Small cities | 1-3 | ~15 seconds |

**Total for 21 cities**: ~10-15 minutes (vs timeout crash before)

---

## Advantages

1. **No timeouts**: Each function call processes only one city
2. **Real-time progress**: Users see exactly which city is being processed
3. **Resumable**: If a city fails, the queue tracks progress and can retry
4. **Cancellable**: User can close dialog and resume later (queue persists)
5. **Transparent**: City list shows completed vs pending vs current

