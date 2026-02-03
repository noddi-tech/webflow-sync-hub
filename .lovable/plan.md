
# Plan: Fix Navio Preview Issues - Map, Delivery Check, and Commit UI

This plan addresses 4 issues found in the Navio Preview page:

---

## Issue Analysis

### Issue 1: Map Component Shows Production Data, Not Staging Data
The current `DeliveryAreaMap` component queries `areas` table (production) with `is_delivery = true`. For the Navio Preview page, it should show the **staging data with geofences** to preview before committing.

### Issue 2: No Delivery Check UI Component
There's a working `check-delivery` edge function but no UI to test it. Users need an interactive way to enter coordinates or an address to verify delivery coverage.

### Issue 3: Commit Button UI Is Minimal
After approval, users only see a fixed "Commit X Cities" button at bottom-right. There should be a more prominent action bar with Approve/Reject/Commit buttons that appear when cities are selected.

### Issue 4: Commit Failed with 504 Timeout
The logs show the commit request timed out (504) after 150 seconds. Stockholm was committed (status: "committed") before the timeout, but the remaining 17 cities stayed "approved". The duplicate slug errors indicate the commit function isn't generating unique slugs for areas with the same name across different districts.

---

## Technical Root Causes

### Timeout Issue
The commit function processes all cities/districts/areas sequentially in a single request. With 18 cities and potentially thousands of areas, this exceeds the 60-second edge function limit.

### Duplicate Slug Errors
```
Error creating area: duplicate key value violates unique constraint "areas_slug_key"
Key (slug)=(hasselby) already exists.
```
The `slugify()` function creates the same slug for areas with identical names in different districts. The slug should include city/district context.

---

## Solution

### Task 1: Add Staging Geofence Map to Navio Preview

Create a new `StagingAreaMap` component that:
- Queries `navio_import_queue` table for geofences (stored during AI Import)
- Shows polygons from staging data, not production
- Color-codes by city with popups showing area/district names

**Files:**
| File | Action |
|------|--------|
| `src/components/map/StagingAreaMap.tsx` | Create - Map showing staging geofences |
| `src/pages/NavioPreview.tsx` | Modify - Replace DeliveryAreaMap with StagingAreaMap on Map tab |

### Task 2: Create Delivery Check UI Component

Build a `DeliveryChecker` component with:
- Input for coordinates (lat/lng) or address
- Geocoding using OpenStreetMap Nominatim (free, no API key)
- "Check Delivery" button that calls the `check-delivery` edge function
- Results display showing matching areas or "not covered" message
- Map marker showing the checked location

**Files:**
| File | Action |
|------|--------|
| `src/components/delivery/DeliveryChecker.tsx` | Create - Address/coordinate input and check button |
| `src/pages/NavioPreview.tsx` | Modify - Add "Delivery Checker" tab |

### Task 3: Improve Commit UI with Selection Toolbar

Add a sticky action bar that appears when cities are selected:
- Shows selection count
- "Approve Selected" and "Reject Selected" buttons
- "Commit Approved" button only when approved count > 0
- Visual feedback during operations
- Toast notifications for all operations

**Files:**
| File | Action |
|------|--------|
| `src/components/navio/StagingActionBar.tsx` | Create - Floating action bar component |
| `src/pages/NavioPreview.tsx` | Modify - Add action bar, improve UX |

### Task 4: Fix Commit Timeout and Duplicate Slug Issues

#### 4a. Make Slugs Unique
Update the `commitToProduction` function to generate unique slugs by appending the district slug:
```typescript
// Before
slug: slugify(stagingArea.name)

// After  
slug: slugify(`${stagingArea.name}-${districtSlug}`)
// Or use upsert with navio_service_area_id as the conflict key
```

#### 4b. Add Batch Commit with Progress
Instead of processing all cities in one request, implement incremental commit:
- Add `mode: "commit_batch"` that commits one city per request
- Frontend tracks progress and calls repeatedly until done
- Similar pattern to `process_city` for AI Import

**Files:**
| File | Action |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Modify - Fix slug generation, add batch commit mode |
| `src/hooks/useNavioImport.ts` | Modify - Add incremental commit with progress |
| `src/pages/NavioPreview.tsx` | Modify - Show commit progress |

---

## Implementation Details

### Task 1: StagingAreaMap Component

```tsx
// src/components/map/StagingAreaMap.tsx
export function StagingAreaMap({ batchId }: { batchId: string }) {
  const { data: queueData } = useQuery({
    queryKey: ["staging-geofences", batchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("navio_import_queue")
        .select("city_name, navio_areas")
        .eq("batch_id", batchId);
      
      // Extract areas with geofences
      const areasWithGeo = [];
      for (const entry of data || []) {
        const areas = entry.navio_areas as Array<{
          id: number;
          name: string;
          geofence_geojson: GeoJSON.Polygon | null;
        }>;
        for (const area of areas || []) {
          if (area.geofence_geojson) {
            areasWithGeo.push({
              id: area.id,
              name: area.name,
              city: entry.city_name,
              geofence: area.geofence_geojson,
            });
          }
        }
      }
      return areasWithGeo;
    },
  });

  return (
    <MapContainer center={[59.9, 10.75]} zoom={5}>
      <TileLayer url="..." />
      {queueData?.map(area => (
        <GeoJSON 
          key={area.id}
          data={area.geofence}
          style={{ color: getCityColor(area.city), fillOpacity: 0.3 }}
        >
          <Popup>{area.name} ({area.city})</Popup>
        </GeoJSON>
      ))}
    </MapContainer>
  );
}
```

### Task 2: DeliveryChecker Component

```tsx
// src/components/delivery/DeliveryChecker.tsx
export function DeliveryChecker() {
  const [coordinates, setCoordinates] = useState({ lat: 59.9139, lng: 10.7522 });
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<DeliveryCheckResult | null>(null);
  
  const checkMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      const { data, error } = await supabase.functions.invoke("check-delivery", {
        body: coords,
      });
      if (error) throw error;
      return data;
    },
  });

  const geocodeAddress = async () => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    );
    const data = await response.json();
    if (data[0]) {
      setCoordinates({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check Delivery Coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Address</Label>
            <div className="flex gap-2">
              <Input 
                value={address} 
                onChange={e => setAddress(e.target.value)}
                placeholder="Enter address..."
              />
              <Button onClick={geocodeAddress}>Lookup</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Latitude</Label>
              <Input type="number" value={coordinates.lat} onChange={...} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" value={coordinates.lng} onChange={...} />
            </div>
          </div>
        </div>
        
        <Button onClick={() => checkMutation.mutate(coordinates)}>
          Check Delivery
        </Button>
        
        {result && (
          <Alert variant={result.delivers ? "default" : "destructive"}>
            {result.delivers 
              ? `Delivers to ${result.areas.length} area(s)` 
              : "No delivery coverage"
            }
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### Task 3: StagingActionBar Component

```tsx
// src/components/navio/StagingActionBar.tsx
interface Props {
  selectedCount: number;
  approvedCount: number;
  onApprove: () => void;
  onReject: () => void;
  onCommit: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isCommitting: boolean;
}

export function StagingActionBar({
  selectedCount,
  approvedCount,
  onApprove,
  onReject,
  onCommit,
  isApproving,
  isRejecting,
  isCommitting,
}: Props) {
  const showBar = selectedCount > 0 || approvedCount > 0;
  
  return (
    <AnimatePresence>
      {showBar && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <Card className="shadow-lg border-2">
            <CardContent className="py-3 px-4 flex items-center gap-4">
              {selectedCount > 0 && (
                <>
                  <span className="text-sm font-medium">{selectedCount} selected</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onApprove} disabled={isApproving}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={onReject} disabled={isRejecting}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </>
              )}
              
              {approvedCount > 0 && (
                <>
                  <Separator orientation="vertical" className="h-8" />
                  <Button size="sm" onClick={onCommit} disabled={isCommitting}>
                    {isCommitting ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-1" />
                    )}
                    Commit {approvedCount} Approved
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Task 4: Fix Edge Function

```typescript
// supabase/functions/navio-import/index.ts

// 4a. Fix slug generation to be unique per district
function generateUniqueAreaSlug(areaName: string, districtName: string, cityName: string): string {
  // Create unique slug: area-district-city format
  const base = slugify(areaName);
  const districtSlug = slugify(districtName);
  
  // For common names, include district context
  const commonNames = ['center', 'sentrum', 'nord', 'syd', 'øst', 'vest'];
  if (commonNames.includes(base)) {
    return `${base}-${districtSlug}`;
  }
  
  // Try base slug first, use with district if conflict
  return base;
}

// 4b. Add batch commit mode - commit one city at a time
case "commit_city": {
  // Find next approved city to commit
  const { data: nextCity } = await supabase
    .from("navio_staging_cities")
    .select("id, name")
    .eq("batch_id", batchId)
    .eq("status", "approved")
    .limit(1)
    .single();

  if (!nextCity) {
    return { completed: true, remaining: 0 };
  }

  // Commit just this city
  await commitSingleCity(supabase, nextCity, batchId, geofenceMap);

  // Count remaining
  const { count } = await supabase
    .from("navio_staging_cities")
    .select("id", { count: "exact" })
    .eq("batch_id", batchId)
    .eq("status", "approved");

  return { 
    completed: count === 0, 
    committedCity: nextCity.name,
    remaining: count,
  };
}
```

---

## Files Summary

### Files to Create
| File | Description |
|------|-------------|
| `src/components/map/StagingAreaMap.tsx` | Map showing staging geofences |
| `src/components/delivery/DeliveryChecker.tsx` | Address/coordinate delivery check UI |
| `src/components/navio/StagingActionBar.tsx` | Floating action bar for selections |

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/NavioPreview.tsx` | Add staging map, delivery checker tab, action bar |
| `src/hooks/useNavioImport.ts` | Add incremental commit with progress |
| `supabase/functions/navio-import/index.ts` | Fix slugs, add batch commit mode |

---

## Execution Order

```text
1. Fix slug generation (prevents future errors)
       |
       v
2. Add batch commit mode (prevents timeouts)
       |
       v  
3. Update useNavioImport hook
       |
       v
4. Create StagingActionBar component
       |
       v
5. Create StagingAreaMap component  
       |
       v
6. Create DeliveryChecker component
       |
       v
7. Update NavioPreview page with all new components
       |
       v
8. Test commit flow with remaining 17 approved cities
```

---

## Success Criteria

| Feature | Verification |
|---------|-------------|
| Map shows staging data | Polygons visible on Map tab before commit |
| Delivery check works | Enter Oslo coordinates, get matching areas |
| Action bar appears | Select cities, see approve/reject/commit buttons |
| Commit doesn't timeout | All 17 cities commit successfully |
| No duplicate slug errors | Each area gets unique slug |
