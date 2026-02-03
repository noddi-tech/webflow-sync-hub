import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from "react-leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo } from "react";
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

interface StagingAreaMapProps {
  batchId?: string;
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

function getCityColor(cityName: string, cityIndex: number): string {
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

export function StagingAreaMap({ batchId }: StagingAreaMapProps) {
  const { data: areasWithGeo, isLoading } = useQuery({
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
      
      // Extract areas with geofences
      const areasWithGeo: Array<{
        id: number;
        name: string;
        city: string;
        countryCode: string;
        geofence: GeoJSON.Geometry;
      }> = [];
      
      const cityNames = new Set<string>();
      
      for (const entry of data || []) {
        cityNames.add(entry.city_name);
        const areas = (entry.navio_areas as unknown) as NavioArea[] | null;
        
        for (const area of areas || []) {
          if (area.geofence_geojson) {
            areasWithGeo.push({
              id: area.id,
              name: area.display_name || area.name,
              city: entry.city_name,
              countryCode: entry.country_code,
              geofence: area.geofence_geojson as GeoJSON.Geometry,
            });
          }
        }
      }
      
      return {
        areas: areasWithGeo,
        cities: Array.from(cityNames),
      };
    },
  });

  // Calculate bounds for all polygons
  const bounds = useMemo(() => {
    if (!areasWithGeo?.areas.length) return null;
    
    const L = (window as unknown as { L: typeof import("leaflet") }).L;
    if (!L) return null;
    
    const allCoords: [number, number][] = [];
    
    for (const area of areasWithGeo.areas) {
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
  }, [areasWithGeo?.areas]);

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full rounded-lg" />;
  }

  if (!areasWithGeo?.areas.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>No geofence data available in staging.</p>
          <p className="text-sm mt-2">Run an AI Import to fetch delivery areas with polygon data.</p>
        </CardContent>
      </Card>
    );
  }

  const cityColorMap = new Map<string, string>();
  areasWithGeo.cities.forEach((city, idx) => {
    cityColorMap.set(city, getCityColor(city, idx));
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground font-medium">Cities:</span>
        {areasWithGeo.cities.map((city) => (
          <div key={city} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: cityColorMap.get(city) }} 
            />
            <span>{city}</span>
            <span className="text-muted-foreground">
              ({areasWithGeo.areas.filter(a => a.city === city).length})
            </span>
          </div>
        ))}
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
          
          {areasWithGeo.areas.map((area) => (
            <GeoJSON
              key={area.id}
              data={{
                type: "Feature",
                properties: { name: area.name, city: area.city },
                geometry: area.geofence,
              } as GeoJSON.Feature}
              style={{
                color: cityColorMap.get(area.city) || "#3b82f6",
                weight: 2,
                fillOpacity: 0.2,
                opacity: 0.8,
              }}
            >
              <Popup>
                <div className="font-medium">{area.name}</div>
                <div className="text-sm text-muted-foreground">
                  {area.city} ({area.countryCode})
                </div>
              </Popup>
            </GeoJSON>
          ))}
          
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Showing {areasWithGeo.areas.length} delivery areas with polygon data from staging
      </p>
    </div>
  );
}
