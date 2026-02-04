import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductionCity {
  id: string;
  name: string;
  country_code: string | null;
  is_delivery: boolean | null;
  district_count: number;
  area_count: number;
  areas_with_geofence: number;
}

export interface ProductionDistrict {
  id: string;
  name: string;
  city_id: string;
  city_name: string;
  is_delivery: boolean | null;
  area_count: number;
  areas_with_geofence: number;
}

export interface ProductionSummary {
  cities: number;
  districts: number;
  areas: number;
  areasWithGeofence: number;
  geofenceCoverage: number; // 0-100 percentage
}

export function useProductionData() {
  return useQuery({
    queryKey: ["production-data"],
    queryFn: async () => {
      // Fetch cities with counts
      const { data: cities, error: citiesError } = await supabase
        .from("cities")
        .select(`
          id,
          name,
          country_code,
          is_delivery,
          districts!districts_city_id_fkey(
            id,
            areas!areas_district_id_fkey(id, geofence_json)
          )
        `)
        .order("name");

      if (citiesError) throw citiesError;

      // Transform data
      const productionCities: ProductionCity[] = (cities || []).map(city => {
        const districts = (city.districts as Array<{
          id: string;
          areas: Array<{ id: string; geofence_json: unknown }>;
        }>) || [];
        
        let areaCount = 0;
        let areasWithGeo = 0;
        
        for (const district of districts) {
          const areas = district.areas || [];
          areaCount += areas.length;
          areasWithGeo += areas.filter(a => a.geofence_json != null).length;
        }

        return {
          id: city.id,
          name: city.name,
          country_code: city.country_code,
          is_delivery: city.is_delivery,
          district_count: districts.length,
          area_count: areaCount,
          areas_with_geofence: areasWithGeo,
        };
      });

      // Calculate summary
      const totalAreas = productionCities.reduce((acc, c) => acc + c.area_count, 0);
      const totalAreasWithGeo = productionCities.reduce((acc, c) => acc + c.areas_with_geofence, 0);
      
      const summary: ProductionSummary = {
        cities: productionCities.length,
        districts: productionCities.reduce((acc, c) => acc + c.district_count, 0),
        areas: totalAreas,
        areasWithGeofence: totalAreasWithGeo,
        geofenceCoverage: totalAreas > 0 ? Math.round((totalAreasWithGeo / totalAreas) * 100) : 0,
      };

      return { cities: productionCities, summary };
    },
    staleTime: 5000,
  });
}

export function useProductionDistricts(cityId?: string) {
  return useQuery({
    queryKey: ["production-districts", cityId],
    enabled: !!cityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select(`
          id,
          name,
          city_id,
          is_delivery,
          city:cities!districts_city_id_fkey(name),
          areas!areas_district_id_fkey(id, geofence_json)
        `)
        .eq("city_id", cityId!)
        .order("name");

      if (error) throw error;

      const districts: ProductionDistrict[] = (data || []).map(d => {
        const areas = (d.areas as Array<{ id: string; geofence_json: unknown }>) || [];
        return {
          id: d.id,
          name: d.name,
          city_id: d.city_id,
          city_name: (d.city as { name: string })?.name || "Unknown",
          is_delivery: d.is_delivery,
          area_count: areas.length,
          areas_with_geofence: areas.filter(a => a.geofence_json != null).length,
        };
      });

      return districts;
    },
  });
}
