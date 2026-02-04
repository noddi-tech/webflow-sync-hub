import { useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin } from "lucide-react";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, GeoJsonObject } from "geojson";
import type { PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

interface DeliveryArea {
  id: string;
  name: string;
  geofence_json: Polygon | MultiPolygon | null;
  district_name: string;
  city_name: string;
}

// Generate distinct colors for different cities
const cityColors: Record<string, string> = {};
const colorPalette = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
  "#14b8a6", // teal
];

function getCityColor(cityName: string): string {
  if (!cityColors[cityName]) {
    const index = Object.keys(cityColors).length % colorPalette.length;
    cityColors[cityName] = colorPalette[index];
  }
  return cityColors[cityName];
}

export function DeliveryAreaMap() {
  const { data: areas, isLoading, error } = useQuery({
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
        // Cast through unknown to satisfy TypeScript - the actual data is valid GeoJSON
        geofence_json: a.geofence_json as unknown as Polygon | MultiPolygon | null,
        district_name: (a.districts as { name: string }).name,
        city_name: (a.cities as { name: string }).name,
      }));
    },
  });

  // Create a FeatureCollection from all areas for proper bounds calculation
  const featureCollection = useMemo<FeatureCollection | null>(() => {
    if (!areas?.length) return null;
    
    const features: Feature[] = areas
      .filter(area => area.geofence_json)
      .map(area => ({
        type: "Feature" as const,
        properties: {
          id: area.id,
          name: area.name,
          district: area.district_name,
          city: area.city_name,
        },
        geometry: area.geofence_json!,
      }));
    
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [areas]);

  // Center on Norway by default
  const defaultCenter: [number, number] = [59.9, 10.75];
  const defaultZoom = 5;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[500px] w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
        <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
        <p className="text-lg font-medium">Failed to load delivery areas</p>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  if (!areas?.length) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
        <MapPin className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No delivery areas with polygons</p>
        <p className="text-sm">Run "Geo Sync" on the Dashboard to import geofence data from Navio.</p>
      </div>
    );
  }

  // Count stats
  const cityCounts = areas.reduce<Record<string, number>>((acc, area) => {
    acc[area.city_name] = (acc[area.city_name] || 0) + 1;
    return acc;
  }, {});

  const styleFeature = (feature: Feature | undefined): PathOptions => {
    const cityName = feature?.properties?.city || "";
    return {
      color: getCityColor(cityName),
      fillColor: getCityColor(cityName),
      fillOpacity: 0.3,
      weight: 2,
    };
  };

  return (
    <div className="space-y-4">
      <MapContainer 
        center={defaultCenter} 
        zoom={defaultZoom} 
        className="h-[500px] w-full rounded-lg border"
        style={{ zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {areas?.map(area => (
          area.geofence_json && (
            <GeoJSON 
              key={area.id}
              data={area.geofence_json}
              style={() => styleFeature({ 
                type: "Feature", 
                properties: { city: area.city_name }, 
                geometry: area.geofence_json as Polygon | MultiPolygon 
              })}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`
                  <div style="font-size: 0.875rem;">
                    <p style="font-weight: 600;">${area.name}</p>
                    <p style="color: #6b7280;">
                      ${area.district_name}, ${area.city_name}
                    </p>
                  </div>
                `);
              }}
            />
          )
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(cityCounts).map(([city, count]) => (
          <Badge 
            key={city} 
            variant="outline" 
            className="flex items-center gap-1.5"
            style={{ borderColor: getCityColor(city), color: getCityColor(city) }}
          >
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: getCityColor(city) }}
            />
            {city} ({count})
          </Badge>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Showing {areas.length} delivery areas across {Object.keys(cityCounts).length} cities
      </p>
    </div>
  );
}
