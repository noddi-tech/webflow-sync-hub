

# Complete Fix: Production Map with Multi-Select City Tags

## Current Problems Identified

### Problem 1: Missing Cities (e.g., Oslo)
The current implementation uses `.limit(100)` when no city filter is selected. The database shows:
- **First 100 areas happen to be:** Göteborg (45), Lillestrøm (20), Stockholm (19), Lier (16)
- **Oslo (573 areas) is NOT in the first 100 rows** because of default database ordering

### Problem 2: Single-Select Dropdown
The current dropdown only allows selecting ONE city at a time. The user wants multi-select tags where multiple cities can be toggled on/off.

### Problem 3: No City Count Information
Users can't see how many areas each city has until they select it.

---

## Database Verification

| City | Country | Areas with Geofence |
|------|---------|---------------------|
| Göteborg | SE | 1,113 |
| München | DE | 962 |
| Oslo | NO | 573 |
| Stockholm | SE | 508 |
| Bergen | NO | 379 |
| Kristiansand | NO | 338 |
| Trondheim | NO | 269 |
| Toronto | CA | 267 |
| + 10 more cities | | |
| **Total** | | **4,898** |

---

## Solution Design

### UI Changes
1. **Replace dropdown with clickable tag badges**
2. **Show all cities with area counts**
3. **Multi-select: toggle cities on/off**
4. **Default: show first 3-5 cities pre-selected** (so map isn't empty)
5. **"Select All" / "Clear All" buttons** for convenience

### Data Fetching Strategy
1. **Always fetch city list with counts first** (fast, lightweight query)
2. **Fetch areas only for selected cities** (paginated if needed)
3. **Limit total rendered polygons to ~2,000** at once for performance

---

## Implementation Plan

### File: `src/components/map/StagingAreaMap.tsx`

### Step 1: Create City List Hook (Separate from Areas)

Fetch all cities with their geofence counts upfront:

```typescript
interface CityWithCount {
  id: string;
  name: string;
  country_code: string | null;
  area_count: number;
}

function useCitiesWithCounts() {
  return useQuery({
    queryKey: ["cities-with-geofence-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select(`
          id, 
          name, 
          country_code
        `)
        .order("name");
      
      if (error) throw error;
      
      // Get area counts per city (separate lightweight query)
      const { data: counts } = await supabase
        .from("areas")
        .select("city_id")
        .not("geofence_json", "is", null);
      
      // Build count map
      const countMap = new Map<string, number>();
      for (const row of counts || []) {
        countMap.set(row.city_id, (countMap.get(row.city_id) || 0) + 1);
      }
      
      // Filter to cities that have geofenced areas
      const citiesWithCounts: CityWithCount[] = (data || [])
        .map(city => ({
          ...city,
          area_count: countMap.get(city.id) || 0
        }))
        .filter(city => city.area_count > 0)
        .sort((a, b) => b.area_count - a.area_count);
      
      return citiesWithCounts;
    },
    staleTime: 60000, // Cache for 1 minute
  });
}
```

### Step 2: Update useProduction to Accept Multiple Cities

```typescript
function useProduction(selectedCityIds: string[]) {
  return useQuery({
    queryKey: ["production-geofences", selectedCityIds],
    enabled: selectedCityIds.length > 0,
    queryFn: async () => {
      const allAreas: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      // Fetch areas for each selected city
      for (const cityId of selectedCityIds) {
        const { data, error } = await supabase
          .from("areas")
          .select(`
            id, 
            name, 
            geofence_json,
            city:cities!areas_city_id_fkey(id, name, country_code)
          `)
          .eq("city_id", cityId)
          .not("geofence_json", "is", null);
        
        if (error) throw error;
        
        for (const entry of data || []) {
          const city = entry.city as { name: string; country_code: string } | null;
          const cityName = city?.name || "Unknown";
          cityNames.add(cityName);
          
          const geofence = extractGeometry(entry.geofence_json, true);
          if (geofence) {
            allAreas.push({
              id: entry.id,
              name: entry.name,
              city: cityName,
              countryCode: city?.country_code || "XX",
              geofence,
            });
          }
        }
      }
      
      return {
        areas: allAreas,
        cities: Array.from(cityNames),
      };
    },
  });
}
```

### Step 3: Add State for Selected Cities (Multi-Select)

```typescript
// In StagingAreaMap component
const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
const citiesQuery = useCitiesWithCounts();

// Auto-select top 3 cities when data loads
useEffect(() => {
  if (citiesQuery.data && selectedCityIds.length === 0) {
    const top3 = citiesQuery.data.slice(0, 3).map(c => c.id);
    setSelectedCityIds(top3);
  }
}, [citiesQuery.data]);

// Toggle a city on/off
const toggleCity = (cityId: string) => {
  setSelectedCityIds(prev => 
    prev.includes(cityId) 
      ? prev.filter(id => id !== cityId)
      : [...prev, cityId]
  );
};
```

### Step 4: Create Tag-Based City Selector UI

```tsx
// City tags with toggle behavior
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium">Select cities to display:</span>
    <div className="flex gap-2">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setSelectedCityIds(citiesQuery.data?.map(c => c.id) || [])}
      >
        Select All
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setSelectedCityIds([])}
      >
        Clear
      </Button>
    </div>
  </div>
  
  <div className="flex flex-wrap gap-2">
    {citiesQuery.data?.map((city, idx) => {
      const isSelected = selectedCityIds.includes(city.id);
      const color = getCityColor(idx);
      
      return (
        <button
          key={city.id}
          onClick={() => toggleCity(city.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
            "border cursor-pointer",
            isSelected 
              ? "border-transparent text-white" 
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
          )}
          style={isSelected ? { backgroundColor: color } : undefined}
        >
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: color }}
          />
          {city.name} ({city.area_count})
        </button>
      );
    })}
  </div>
</div>
```

---

## Performance Safeguards

### Limit Total Polygons
Add a warning if too many cities are selected:

```typescript
const MAX_AREAS = 2000;
const totalSelectedAreas = citiesQuery.data
  ?.filter(c => selectedCityIds.includes(c.id))
  .reduce((sum, c) => sum + c.area_count, 0) || 0;

{totalSelectedAreas > MAX_AREAS && (
  <Alert variant="warning">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      {totalSelectedAreas} areas selected. Consider selecting fewer cities for better performance.
    </AlertDescription>
  </Alert>
)}
```

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| City selector | Single dropdown | Multi-select tags |
| Default view | Random first 100 areas | Top 3 cities pre-selected |
| City list | Buried in dropdown | Visible tags with counts |
| Data fetching | All or one city | Only selected cities |
| Performance | Could load 4,898 at once | Controlled by selection |

---

## Expected Result

1. All 18 cities visible as clickable tags
2. Each tag shows area count (e.g., "Oslo (573)")
3. Tags can be toggled on/off individually
4. Top 3 cities auto-selected on load (Göteborg, München, Oslo)
5. Map only renders areas for selected cities
6. Performance warning if too many areas selected

