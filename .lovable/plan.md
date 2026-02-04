

# Fix: Production Map Coordinates and Add City Filter

## Root Cause Identified

The production geofence data in `areas.geofence_json` is stored as `[latitude, longitude]`, NOT `[longitude, latitude]` as I previously assumed. The database sample shows:
- `coord0_0: 59.75` (latitude for Lierstranda, Norway - correct!)
- `coord0_1: 10.22` (longitude for Lierstranda, Norway - correct!)

But in GeoJSON standard and Leaflet, coordinates must be `[longitude, latitude]`. So the production data **does need coordinate swapping**, just like the snapshot data.

The previous fix incorrectly set `needsSwap: false` for production, causing polygons to render in the Indian Ocean (swapping lat/lng puts European coordinates in the ocean).

## Solution

### File: `src/components/map/StagingAreaMap.tsx`

### Change 1: Fix Production Coordinate Swapping

```tsx
// Line 243: Change from false to true
const geofence = extractGeometry(entry.geofence_json, true); // Production data ALSO needs swap
```

### Change 2: Add City Filter Dropdown for Production Tab

Add a city selector dropdown so users can filter production areas by city instead of loading all 4,898 at once:

```tsx
// Add state for selected city
const [selectedCity, setSelectedCity] = useState<string | null>(null);

// Modify useProduction to accept optional city filter
function useProduction(cityFilter?: string | null) {
  return useQuery({
    queryKey: ["production-geofences", cityFilter],
    queryFn: async () => {
      // First, get list of all cities with geofence counts
      const { data: citiesData } = await supabase
        .from("cities")
        .select("id, name, country_code")
        .order("name");
      
      // Build query for areas
      let query = supabase
        .from("areas")
        .select(`
          id, 
          name, 
          geofence_json,
          city:cities!areas_city_id_fkey(id, name, country_code)
        `)
        .not("geofence_json", "is", null);
      
      // Apply city filter if selected
      if (cityFilter) {
        query = query.eq("city_id", cityFilter);
      } else {
        // If no filter, limit to first 100 to show something
        query = query.limit(100);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Process areas and apply coordinate swapping
      const areasWithGeo = [];
      const cityNames = new Set<string>();
      
      for (const entry of data || []) {
        const city = entry.city;
        const cityName = city?.name || "Unknown";
        cityNames.add(cityName);
        
        // Production data IS in [lat, lng] format - NEEDS swap
        const geofence = extractGeometry(entry.geofence_json, true);
        if (geofence) {
          areasWithGeo.push({
            id: entry.id,
            name: entry.name,
            city: cityName,
            countryCode: city?.country_code || "XX",
            geofence,
          });
        }
      }
      
      return {
        areas: areasWithGeo,
        cities: Array.from(cityNames),
        availableCities: citiesData || [],
      };
    },
  });
}
```

### Change 3: Update Tab Labels

Make the tab labels clearer as requested:

```tsx
<TabsList className="grid w-full grid-cols-3">
  <TabsTrigger value="snapshot" className="text-xs">
    Navio Snapshot ({snapshotQuery.data?.areas.length ?? "..."})
  </TabsTrigger>
  <TabsTrigger value="staging" className="text-xs">
    Import Staging ({stagingQuery.data?.areas.length ?? "..."})
  </TabsTrigger>
  <TabsTrigger value="production" className="text-xs">
    Live Production ({productionQuery.data?.areas.length ?? "..."})
  </TabsTrigger>
</TabsList>
```

### Change 4: Add City Selector UI for Production Tab

```tsx
// When production tab is active, show city selector
{activeSource === "production" && (
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">Filter by city:</span>
    <Select value={selectedCity || "all"} onValueChange={(v) => setSelectedCity(v === "all" ? null : v)}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All cities (first 100)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All cities (first 100)</SelectItem>
        {productionQuery.data?.availableCities?.map((city) => (
          <SelectItem key={city.id} value={city.id}>
            {city.name} ({city.country_code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

## Summary of Changes

| Issue | Before | After |
|-------|--------|-------|
| Coordinate swap for production | `needsSwap: false` (wrong) | `needsSwap: true` (correct) |
| Production data loading | All 4,898 areas at once | City dropdown filter, default 100 |
| Tab labels | "Snapshot / Staging / Production" | "Navio Snapshot / Import Staging / Live Production" |

## Expected Outcome

1. Production polygons will render correctly in Scandinavia (not Indian Ocean)
2. Faster map loading with city-based filtering
3. Clearer terminology for each data source

## Data Source Definitions (Updated Labels)

| Tab | Label | Source | Description |
|-----|-------|--------|-------------|
| 1 | **Navio Snapshot** | `navio_snapshot` table | Last fetched state from external Navio API |
| 2 | **Import Staging** | `navio_import_queue` table | Pending data awaiting approval |
| 3 | **Live Production** | `areas` table | Active delivery areas used by the app |

