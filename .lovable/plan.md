

# Plan: Complete Geo-Based Delivery System - Testing and Map Visualization

This plan covers three remaining tasks to fully test and visualize the geo-based delivery system.

---

## Current State Summary

| Component | Status |
|-----------|--------|
| Database columns (`geofence_json`, `geofence`, `geofence_center`) | Ready |
| PostGIS extension and spatial indexes | Ready |
| SQL trigger for JSONB-to-geometry sync | Ready |
| `sync_geo` mode in edge function | Ready |
| `check-delivery` endpoint | Ready |
| **Actual data in database** | **Empty (0 areas with geofence)** |
| **Map visualization** | **Not implemented** |

---

## Task 1: Run Geo Sync to Populate Data

**Approach:** Use the existing "Geo Sync" button on the Dashboard to trigger the `sync_geo` edge function mode.

### Steps (User Actions)
1. Navigate to the Dashboard (/)
2. Click the "Geo Sync" button in the "Import from Navio" card
3. Wait for the sync to complete (should be fast, 1-2 minutes)
4. Toast notification will show results

### Expected Outcome
The sync will:
- Fetch all service areas from Navio API
- Parse city names and group areas
- Create/update cities, districts, and areas in the database
- Store `geofence_json` (JSONB) for each area
- The SQL trigger will automatically populate PostGIS `geofence` geometry columns

### Verification Query
After sync completes, verify with:
```sql
SELECT COUNT(*) as total, 
       COUNT(geofence_json) as with_json, 
       COUNT(geofence) as with_geometry 
FROM areas WHERE is_delivery = true;
```

---

## Task 2: Add Map Visualization to NavioPreview

**Approach:** Install Leaflet (lightweight, free, no API key required) and add an interactive map tab to the NavioPreview page that displays all delivery area polygons.

### Implementation Details

#### 2.1 Install Dependencies
```bash
npm install leaflet react-leaflet @types/leaflet
```

#### 2.2 Create Map Component
Create `src/components/map/DeliveryAreaMap.tsx`:

```tsx
import { MapContainer, TileLayer, GeoJSON, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

interface DeliveryArea {
  id: string;
  name: string;
  geofence_json: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  district_name: string;
  city_name: string;
}

export function DeliveryAreaMap() {
  const { data: areas, isLoading } = useQuery({
    queryKey: ["delivery-areas-with-geofence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select(`
          id, name, geofence_json,
          districts!inner(name),
          cities!inner(name)
        `)
        .eq("is_delivery", true)
        .not("geofence_json", "is", null);
      
      if (error) throw error;
      return data.map(a => ({
        id: a.id,
        name: a.name,
        geofence_json: a.geofence_json,
        district_name: a.districts.name,
        city_name: a.cities.name,
      }));
    },
  });

  if (isLoading) return <Skeleton className="h-[500px]" />;

  // Center on Norway by default
  const defaultCenter: [number, number] = [59.9, 10.75];

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={5} 
      className="h-[500px] w-full rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {areas?.map(area => (
        area.geofence_json && (
          <GeoJSON 
            key={area.id}
            data={area.geofence_json}
            style={{ color: '#22c55e', fillOpacity: 0.3, weight: 2 }}
          >
            <Popup>
              <strong>{area.name}</strong><br />
              {area.district_name}, {area.city_name}
            </Popup>
          </GeoJSON>
        )
      ))}
    </MapContainer>
  );
}
```

#### 2.3 Update NavioPreview Page
Add a new "Map" tab to the existing Tabs component:

```tsx
// Add import
import { DeliveryAreaMap } from "@/components/map/DeliveryAreaMap";

// Inside Tabs component, add new TabsTrigger
<TabsTrigger value="map">
  <MapPin className="h-4 w-4 mr-2" />
  Map View
</TabsTrigger>

// Add TabsContent
<TabsContent value="map">
  <Card>
    <CardHeader>
      <CardTitle>Delivery Area Map</CardTitle>
    </CardHeader>
    <CardContent>
      <DeliveryAreaMap />
    </CardContent>
  </Card>
</TabsContent>
```

#### 2.4 Add Leaflet CSS
Import in `src/index.css`:
```css
@import "leaflet/dist/leaflet.css";
```

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/map/DeliveryAreaMap.tsx` | Create new component |
| `src/pages/NavioPreview.tsx` | Add Map tab |
| `src/index.css` | Import Leaflet CSS |

---

## Task 3: Test Delta Check with Populated Data

**Approach:** After running Geo Sync, use "Check for Changes" to verify delta detection works with geofence tracking.

### Steps (User Actions)
1. Complete Task 1 (Geo Sync) to populate `navio_snapshot` table
2. Navigate to Dashboard
3. Click "Check for Changes" button
4. Review the Delta Summary card

### Expected Behavior
The delta check will:
1. Fetch current Navio API data
2. Compare against `navio_snapshot` table
3. Compute hash for each `geofence_geojson`
4. Identify:
   - New areas (in API but not in snapshot)
   - Removed areas (in snapshot but not in API)
   - Changed areas (name or geofence hash differs)
   - Unchanged areas

### First Run After Initial Sync
On the first run, the Delta Summary should show:
- "All Up to Date" (since snapshot was just updated by Geo Sync)
- OR show counts of new/changed if API data differs from what was synced

### Testing Polygon Change Detection
The `geofenceChanged` field in delta results tracks polygon modifications:
```typescript
// In DeltaSummary.tsx, already displays:
{summary.geofenceChanged > 0 && (
  <Badge variant="outline" className="border-blue-500 text-blue-600">
    <MapPin className="mr-1 h-3 w-3" />
    {summary.geofenceChanged}
  </Badge>
  // shows "polygon updates"
)}
```

---

## Execution Order

```text
1. Run Geo Sync (Dashboard)
        |
        v
2. Verify data populated (automatic)
        |
        v
3. Test Check for Changes
        |
        v
4. Implement Map Visualization
        |
        v
5. View polygons on NavioPreview Map tab
```

---

## Technical Summary

### Dependencies to Add
- `leaflet` - Mapping library
- `react-leaflet` - React bindings for Leaflet
- `@types/leaflet` - TypeScript definitions

### New Files
| File | Description |
|------|-------------|
| `src/components/map/DeliveryAreaMap.tsx` | Interactive map showing delivery polygons |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/NavioPreview.tsx` | Add Map tab to tabs component |
| `src/index.css` | Import Leaflet CSS |

### No Edge Function Changes Required
All backend functionality is already implemented and deployed.

---

## Success Criteria

| Task | Verification |
|------|--------------|
| Geo Sync | `areas` table has rows with `geofence_json` populated |
| Delta Check | Shows "All Up to Date" or accurate change counts |
| Map View | Polygons render correctly on OpenStreetMap tiles |
| Point-in-Polygon | `/check-delivery?lng=10.75&lat=59.92` returns matching areas |

