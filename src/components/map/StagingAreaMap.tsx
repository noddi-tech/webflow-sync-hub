import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
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
function extractGeometry(geofenceData: unknown): GeoJSON.Geometry | null {
  if (!geofenceData || typeof geofenceData !== 'object') return null;
  
  const geo = geofenceData as { type?: string; geometry?: GeoJSON.Geometry };
  
  // Handle Feature wrapper
  if (geo.type === "Feature" && geo.geometry) {
    return swapCoordinates(geo.geometry);
  }
  
  // Handle direct Geometry
  if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
    return swapCoordinates(geo as GeoJSON.Geometry);
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
            const geofence = extractGeometry(area.geofence_geojson);
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
        
        const geofence = extractGeometry(entry.geofence_json);
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

// Extract areas from production areas table
function useProduction() {
  return useQuery({
    queryKey: ["production-geofences"],
    queryFn: async () => {
      // Reduced limit from 1000 to 300 to prevent timeout with large geofence_json payloads
      const { data, error } = await supabase
        .from("areas")
        .select(`
          id, 
          name, 
          geofence_json,
          city:cities!areas_city_id_fkey(id, name, country_code)
        `)
        .not("geofence_json", "is", null)
        .limit(300);
      
      if (error) throw error;
      
      const areasWithGeo: AreaWithGeo[] = [];
      const cityNames = new Set<string>();
      
      for (const entry of data || []) {
        const city = entry.city as { id: string; name: string; country_code: string } | null;
        const cityName = city?.name || "Unknown";
        cityNames.add(cityName);
        
        const geofence = extractGeometry(entry.geofence_json);
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
      };
    },
  });
}

function MapContent({ 
  areas, 
  cities, 
  isLoading 
}: { 
  areas: AreaWithGeo[]; 
  cities: string[]; 
  isLoading: boolean;
}) {
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

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full rounded-lg" />;
  }

  if (!areas.length) {
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
      <div className="h-[500px] rounded-lg overflow-hidden border">
        <MapContainer
          center={[59.9, 10.75]}
          zoom={5}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {areas.map((area) => (
            <GeoJSON
              key={`${area.id}`}
              data={{
                type: "Feature",
                properties: { name: area.name, city: area.city, countryCode: area.countryCode },
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
                layer.bindPopup(`
                  <div style="font-weight: 500;">${props.name || "Unknown"}</div>
                  <div style="font-size: 0.875rem; color: #6b7280;">
                    ${props.city || "Unknown"} (${props.countryCode || "XX"})
                  </div>
                `);
              }}
            />
          ))}
          
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Showing {areas.length} delivery areas with polygon data
      </p>
    </div>
  );
}

export function StagingAreaMap({ batchId, defaultSource = "snapshot" }: StagingAreaMapProps) {
  const [activeSource, setActiveSource] = useState<MapSource>(defaultSource);
  
  const stagingQuery = useStaging(batchId);
  const snapshotQuery = useSnapshot();
  const productionQuery = useProduction();
  
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
            Snapshot ({snapshotQuery.data?.areas.length ?? "..."})
          </TabsTrigger>
          <TabsTrigger value="staging" className="text-xs">
            Staging ({stagingQuery.data?.areas.length ?? "..."})
          </TabsTrigger>
          <TabsTrigger value="production" className="text-xs">
            Production ({productionQuery.data?.areas.length ?? "..."})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <MapContent 
        areas={currentQuery.data?.areas ?? []}
        cities={currentQuery.data?.cities ?? []}
        isLoading={currentQuery.isLoading}
      />
    </div>
  );
}
