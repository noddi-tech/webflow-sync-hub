import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { GeoJSON as GeoJSONType } from "leaflet";
import "leaflet/dist/leaflet.css";

interface NavioArea {
  id: number;
  name: string;
  display_name?: string;
  geofence_geojson?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  } | null;
}

interface AreaWithGeo {
  id: number | string;
  name: string;
  city: string;
  countryCode: string;
  geofence: GeoJSON.Geometry;
  sharedWith?: string[];
}

interface CityWithCount {
  id: string;
  name: string;
  country_code: string | null;
  area_count: number;
}

// Swap coordinates from [lat, lng] to [lng, lat] for GeoJSON compliance
function swapCoordinates(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  const swap = (coords: number[]): number[] => [coords[1], coords[0]];
  
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: (geometry as GeoJSON.Polygon).coordinates.map(ring =>
        ring.map(coord => swap(coord as unknown as number[]) as unknown as GeoJSON.Position)
      ),
    };
  }
  
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: (geometry as GeoJSON.MultiPolygon).coordinates.map(polygon =>
        polygon.map(ring => ring.map(coord => swap(coord as unknown as number[]) as unknown as GeoJSON.Position))
      ),
    };
  }
  
  return geometry;
}

// Helper to extract geometry from Feature-wrapped or raw GeoJSON
// needsSwap: true for Navio-sourced data (snapshot/staging), false for production
function extractGeometry(geofenceData: unknown, needsSwap: boolean = true): GeoJSON.Geometry | null {
  if (!geofenceData || typeof geofenceData !== 'object') return null;
  
  const geo = geofenceData as { type?: string; geometry?: GeoJSON.Geometry };
  
  // Handle Feature wrapper
  if (geo.type === "Feature" && geo.geometry) {
    return needsSwap ? swapCoordinates(geo.geometry) : geo.geometry;
  }
  
  // Handle direct Geometry
  if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
    return needsSwap ? swapCoordinates(geo as GeoJSON.Geometry) : (geo as GeoJSON.Geometry);
  }
  
  return null;
}

type MapSource = "staging" | "snapshot" | "production";

interface StagingAreaMapProps {
  batchId?: string;
  defaultSource?: MapSource;
}

// Color palette for cities
const CITY_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

function getCityColor(cityIndex: number): string {
  return CITY_COLORS[cityIndex % CITY_COLORS.length];
}

// Auto-fit bounds component
function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [bounds, map]);
  
  return null;
}

// Extract areas from staging queue data
function useStaging(batchId?: string) {
  return useQuery({
    queryKey: ["staging-geofences", batchId],
    queryFn: async () => {
      let query = supabase
        .from("navio_import_queue")
        .select("city_name, country_code, navio_areas");
      
      if (batchId && batchId !== "all") {
        query = query.eq("batch_id", batchId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const areasWithGeo: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      for (const entry of data || []) {
        cityNames.add(entry.city_name);
        const areas = (entry.navio_areas as unknown) as NavioArea[] | null;
        
        for (const area of areas || []) {
          if (area.geofence_geojson) {
            const geofence = extractGeometry(area.geofence_geojson, true); // Navio data needs swap
            if (geofence) {
              areasWithGeo.push({
                id: area.id,
                name: area.display_name || area.name,
                city: entry.city_name,
                countryCode: entry.country_code,
                geofence,
              });
            }
          }
        }
      }
      
      return {
        areas: areasWithGeo,
        cities: Array.from(cityNames),
      };
    },
  });
}

// Extract areas from snapshot table
function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot-geofences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navio_snapshot")
        .select("navio_service_area_id, name, display_name, city_name, country_code, geofence_json")
        .eq("is_active", true)
        .not("geofence_json", "is", null);
      
      if (error) throw error;
      
      const areasWithGeo: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      for (const entry of data || []) {
        const cityName = entry.city_name || "Unknown";
        cityNames.add(cityName);
        
        const geofence = extractGeometry(entry.geofence_json, true); // Navio data needs swap
        if (geofence) {
          areasWithGeo.push({
            id: entry.navio_service_area_id,
            name: entry.display_name || entry.name,
            city: cityName,
            countryCode: entry.country_code || "XX",
            geofence,
          });
        }
      }
      
      return {
        areas: areasWithGeo,
        cities: Array.from(cityNames),
      };
    },
  });
}

// Fetch all cities with their geofence counts (with pagination to bypass 1000-row limit)
function useCitiesWithCounts() {
  return useQuery({
    queryKey: ["cities-with-geofence-counts"],
    queryFn: async () => {
      const { data: citiesData, error } = await supabase
        .from("cities")
        .select("id, name, country_code")
        .order("name");
      
      if (error) throw error;
      
      // Paginate through ALL areas to get accurate counts
      const countMap = new Map<string, number>();
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: areaPage, error: areaError } = await supabase
          .from("areas")
          .select("city_id")
          .not("geofence_json", "is", null)
          .order("id")
          .range(from, from + pageSize - 1);
        
        if (areaError) throw areaError;
        if (!areaPage || areaPage.length === 0) break;
        
        for (const row of areaPage) {
          if (row.city_id) {
            countMap.set(row.city_id, (countMap.get(row.city_id) || 0) + 1);
          }
        }
        
        if (areaPage.length < pageSize) break;
        from += pageSize;
      }
      
      // Filter to cities that have geofenced areas and sort by count
      const citiesWithCounts: CityWithCount[] = (citiesData || [])
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

// Extract areas from production areas table with multi-city filter (with pagination + deduplication)
function useProduction(selectedCityIds: string[]) {
  return useQuery({
    queryKey: ["production-geofences", selectedCityIds],
    enabled: selectedCityIds.length > 0,
    queryFn: async () => {
      const allAreas: (AreaWithGeo & { _geoHash: string })[] = [];
      const cityNames = new Set<string>();
      
      // Paginate to get ALL areas for selected cities
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("areas")
          .select(`
            id, 
            name, 
            geofence_json,
            city:cities!areas_city_id_fkey(id, name, country_code)
          `)
          .in("city_id", selectedCityIds)
          .not("geofence_json", "is", null)
          .order("id")
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        for (const entry of data) {
          const city = entry.city as { id: string; name: string; country_code: string } | null;
          const cityName = city?.name || "Unknown";
          cityNames.add(cityName);
          
          // Production data IS in [lat, lng] format - NEEDS swap
          const geofence = extractGeometry(entry.geofence_json, true);
          if (geofence) {
            allAreas.push({
              id: entry.id,
              name: entry.name,
              city: cityName,
              countryCode: city?.country_code || "XX",
              geofence,
              // Store serialized geofence for deduplication
              _geoHash: JSON.stringify(entry.geofence_json),
            });
          }
        }
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      // DEDUPLICATE: Group by polygon hash, keep first, track all names
      const uniquePolygons = new Map<string, AreaWithGeo & { sharedWith: string[] }>();
      
      for (const area of allAreas) {
        const hash = area._geoHash;
        if (!uniquePolygons.has(hash)) {
          uniquePolygons.set(hash, { 
            id: area.id,
            name: area.name,
            city: area.city,
            countryCode: area.countryCode,
            geofence: area.geofence,
            sharedWith: [area.name],
          });
        } else {
          uniquePolygons.get(hash)!.sharedWith!.push(area.name);
        }
      }
      
      // Convert back to array
      const dedupedAreas = Array.from(uniquePolygons.values());
      
      return {
        areas: dedupedAreas,
        cities: Array.from(cityNames),
        totalBeforeDedup: allAreas.length,
      };
    },
  });
}

function MapContent({ 
  areas, 
  cities, 
  isLoading,
  activeSource,
  selectedCityIds,
  totalBeforeDedup,
}: { 
  areas: AreaWithGeo[]; 
  cities: string[]; 
  isLoading: boolean;
  totalBeforeDedup?: number;
  activeSource: MapSource;
  selectedCityIds: string[];
}) {
  // Compute key inside MapContent to force remount when data changes
  // Use slice() to avoid mutating the array with sort()
  const mapKey = useMemo(() => 
    `map-${activeSource}-${selectedCityIds.slice().sort().join('-')}-${areas.length}`, 
    [activeSource, selectedCityIds, areas.length]
  );

  // Calculate bounds for all polygons
  const bounds = useMemo(() => {
    if (!areas.length) return null;
    
    const L = (window as unknown as { L: typeof import("leaflet") }).L;
    if (!L) return null;
    
    const allCoords: [number, number][] = [];
    
    for (const area of areas) {
      try {
        const geojson = area.geofence;
        if (geojson.type === "Polygon") {
          const coords = (geojson as GeoJSON.Polygon).coordinates[0];
          for (const [lng, lat] of coords) {
            allCoords.push([lat, lng]);
          }
        } else if (geojson.type === "MultiPolygon") {
          const multiCoords = (geojson as GeoJSON.MultiPolygon).coordinates;
          for (const polygon of multiCoords) {
            for (const [lng, lat] of polygon[0]) {
              allCoords.push([lat, lng]);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to extract coords from area:", area.id);
      }
    }
    
    if (allCoords.length === 0) return null;
    
    return L.latLngBounds(allCoords);
  }, [areas]);

  if (!areas.length) {
    if (isLoading) {
      return (
        <div className="h-[500px] w-full rounded-lg border relative bg-muted/20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading delivery areas...</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-muted/20">
        <div className="max-w-md mx-auto space-y-2">
          <p className="font-medium">No geofence data available</p>
          <p className="text-sm">
            {cities.length === 0 
              ? "Run a Geo Sync or AI Import to fetch delivery areas with polygon data from Navio."
              : `Areas exist but none have polygon data yet. Run Geo Sync to populate geofences.`
            }
          </p>
        </div>
      </div>
    );
  }

  const cityColorMap = new Map<string, string>();
  cities.forEach((city, idx) => {
    cityColorMap.set(city, getCityColor(idx));
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground font-medium">Cities:</span>
        {cities.slice(0, 10).map((city) => (
          <div key={city} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: cityColorMap.get(city) }} 
            />
            <span>{city}</span>
            <span className="text-muted-foreground">
              ({areas.filter(a => a.city === city).length})
            </span>
          </div>
        ))}
        {cities.length > 10 && (
          <span className="text-muted-foreground">+{cities.length - 10} more</span>
        )}
      </div>

      {/* Map */}
      <div className="h-[500px] rounded-lg overflow-hidden border relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 z-[1000] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading delivery areas...</span>
            </div>
          </div>
        )}
        <MapContainer
          key={mapKey}
          center={[59.9, 10.75]}
          zoom={5}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {!isLoading && areas.map((area) => (
            <GeoJSON
              key={`${activeSource}-${area.id}`}
              data={{
                type: "Feature",
                properties: { name: area.name, city: area.city, countryCode: area.countryCode, sharedWith: area.sharedWith },
                geometry: area.geofence,
              } as GeoJSON.Feature}
              style={{
                color: cityColorMap.get(area.city) || "#3b82f6",
                weight: 2,
                fillOpacity: 0.2,
                opacity: 0.8,
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties || {};
                const shared = props.sharedWith || [];
                
                let popupContent = `<div style="font-weight: 500;">${props.name || "Unknown"}</div>`;
                
                if (shared.length > 1) {
                  popupContent += `
                    <div style="font-size: 0.75rem; color: #f59e0b; margin-top: 4px;">
                      ⚠️ Shared by ${shared.length} areas
                    </div>
                    <div style="font-size: 0.75rem; color: #6b7280; max-height: 100px; overflow: auto;">
                      ${shared.slice(0, 10).join(", ")}${shared.length > 10 ? `, +${shared.length - 10} more` : ""}
                    </div>
                  `;
                }
                
                popupContent += `<div style="font-size: 0.875rem; color: #6b7280;">${props.city || "Unknown"} (${props.countryCode || "XX"})</div>`;
                
                layer.bindPopup(popupContent);
              }}
            />
          ))}
          
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Showing {areas.length} unique polygon{areas.length !== 1 ? "s" : ""}
        {totalBeforeDedup && totalBeforeDedup > areas.length && (
          <span className="text-amber-500"> (from {totalBeforeDedup.toLocaleString()} areas)</span>
        )}
      </p>
    </div>
  );
}

// City tag selector component
function CityTagSelector({
  cities,
  selectedCityIds,
  onToggleCity,
  onSelectAll,
  onClearAll,
  isLoading,
}: {
  cities: CityWithCount[];
  selectedCityIds: string[];
  onToggleCity: (cityId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isLoading: boolean;
}) {
  const MAX_AREAS = 2000;
  const totalSelectedAreas = cities
    .filter(c => selectedCityIds.includes(c.id))
    .reduce((sum, c) => sum + c.area_count, 0);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Select cities to display:</span>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSelectAll}
            className="text-xs h-7"
          >
            Select All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearAll}
            className="text-xs h-7"
          >
            Clear
          </Button>
        </div>
      </div>
      
      {totalSelectedAreas > MAX_AREAS && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {totalSelectedAreas.toLocaleString()} areas selected. Consider selecting fewer cities for better performance.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-wrap gap-2">
        {cities.map((city, idx) => {
          const isSelected = selectedCityIds.includes(city.id);
          const color = getCityColor(idx);
          
          return (
            <button
              key={city.id}
              onClick={() => onToggleCity(city.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                "border cursor-pointer",
                isSelected 
                  ? "border-transparent text-white" 
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: color }}
              />
              {city.name} ({city.area_count.toLocaleString()})
            </button>
          );
        })}
      </div>
      
      {selectedCityIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedCityIds.length} cities selected · {totalSelectedAreas.toLocaleString()} areas
        </p>
      )}
    </div>
  );
}

export function StagingAreaMap({ batchId, defaultSource = "snapshot" }: StagingAreaMapProps) {
  const [activeSource, setActiveSource] = useState<MapSource>(defaultSource);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  
  const stagingQuery = useStaging(batchId);
  const snapshotQuery = useSnapshot();
  const citiesQuery = useCitiesWithCounts();
  const productionQuery = useProduction(selectedCityIds);
  
  // Auto-select top 3 cities when data loads
  useEffect(() => {
    if (citiesQuery.data && citiesQuery.data.length > 0 && selectedCityIds.length === 0) {
      const top3 = citiesQuery.data.slice(0, 3).map(c => c.id);
      setSelectedCityIds(top3);
    }
  }, [citiesQuery.data, selectedCityIds.length]);
  
  // Toggle a city on/off
  const toggleCity = (cityId: string) => {
    setSelectedCityIds(prev => 
      prev.includes(cityId) 
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    );
  };
  
  // Determine which data to show
  const currentQuery = 
    activeSource === "staging" ? stagingQuery :
    activeSource === "snapshot" ? snapshotQuery :
    productionQuery;

  return (
    <div className="space-y-4">
      <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as MapSource)}>
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
      </Tabs>
      
      {activeSource === "production" && (
        <CityTagSelector
          cities={citiesQuery.data || []}
          selectedCityIds={selectedCityIds}
          onToggleCity={toggleCity}
          onSelectAll={() => setSelectedCityIds(citiesQuery.data?.map(c => c.id) || [])}
          onClearAll={() => setSelectedCityIds([])}
          isLoading={citiesQuery.isLoading}
        />
      )}
      
      <MapContent 
        areas={currentQuery.data?.areas ?? []}
        cities={currentQuery.data?.cities ?? []}
        isLoading={currentQuery.isLoading}
        activeSource={activeSource}
        selectedCityIds={selectedCityIds}
        totalBeforeDedup={activeSource === "production" ? productionQuery.data?.totalBeforeDedup : undefined}
      />
    </div>
  );
}
