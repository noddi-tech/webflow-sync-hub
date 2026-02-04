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
      // Run all lightweight queries in parallel - NO geofence_json fetching!
      const [citiesResult, districtsResult, areasResult, areasWithGeoResult] = await Promise.all([
        // Cities with basic info only
        supabase
          .from("cities")
          .select("id, name, country_code, is_delivery")
          .order("name"),
        
        // Districts with just city_id for aggregation
        supabase
          .from("districts")
          .select("id, city_id"),
        
        // Areas with just district_id for aggregation (NO geofence_json!)
        supabase
          .from("areas")
          .select("id, district_id, city_id"),
        
        // Count of areas WITH geofence using HEAD request (no data transfer)
        supabase
          .from("areas")
          .select("id, district_id, city_id")
          .not("geofence_json", "is", null),
      ]);

      if (citiesResult.error) throw citiesResult.error;
      if (districtsResult.error) throw districtsResult.error;
      if (areasResult.error) throw areasResult.error;
      if (areasWithGeoResult.error) throw areasWithGeoResult.error;

      const cities = citiesResult.data || [];
      const districts = districtsResult.data || [];
      const areas = areasResult.data || [];
      const areasWithGeo = areasWithGeoResult.data || [];

      // Build lookup maps for efficient aggregation
      const districtsByCity = new Map<string, string[]>();
      for (const district of districts) {
        const cityDistricts = districtsByCity.get(district.city_id) || [];
        cityDistricts.push(district.id);
        districtsByCity.set(district.city_id, cityDistricts);
      }

      const areasByCity = new Map<string, number>();
      const areasWithGeoByCity = new Map<string, number>();

      // Count areas per city
      for (const area of areas) {
        const cityId = area.city_id;
        if (cityId) {
          areasByCity.set(cityId, (areasByCity.get(cityId) || 0) + 1);
        }
      }

      // Count areas with geofence per city
      for (const area of areasWithGeo) {
        const cityId = area.city_id;
        if (cityId) {
          areasWithGeoByCity.set(cityId, (areasWithGeoByCity.get(cityId) || 0) + 1);
        }
      }

      // Transform to ProductionCity format
      const productionCities: ProductionCity[] = cities.map(city => ({
        id: city.id,
        name: city.name,
        country_code: city.country_code,
        is_delivery: city.is_delivery,
        district_count: districtsByCity.get(city.id)?.length || 0,
        area_count: areasByCity.get(city.id) || 0,
        areas_with_geofence: areasWithGeoByCity.get(city.id) || 0,
      }));

      // Calculate summary
      const totalAreas = areas.length;
      const totalAreasWithGeo = areasWithGeo.length;
      
      const summary: ProductionSummary = {
        cities: cities.length,
        districts: districts.length,
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
      // Fetch districts for the city
      const { data: districts, error: districtsError } = await supabase
        .from("districts")
        .select("id, name, city_id, is_delivery")
        .eq("city_id", cityId!)
        .order("name");

      if (districtsError) throw districtsError;

      // Fetch city name
      const { data: city } = await supabase
        .from("cities")
        .select("name")
        .eq("id", cityId!)
        .single();

      // Fetch areas for these districts (NO geofence_json!)
      const districtIds = (districts || []).map(d => d.id);
      
      const [areasResult, areasWithGeoResult] = await Promise.all([
        supabase
          .from("areas")
          .select("id, district_id")
          .in("district_id", districtIds),
        supabase
          .from("areas")
          .select("id, district_id")
          .in("district_id", districtIds)
          .not("geofence_json", "is", null),
      ]);

      const areas = areasResult.data || [];
      const areasWithGeo = areasWithGeoResult.data || [];

      // Build counts per district
      const areasByDistrict = new Map<string, number>();
      const areasWithGeoByDistrict = new Map<string, number>();

      for (const area of areas) {
        areasByDistrict.set(area.district_id, (areasByDistrict.get(area.district_id) || 0) + 1);
      }

      for (const area of areasWithGeo) {
        areasWithGeoByDistrict.set(area.district_id, (areasWithGeoByDistrict.get(area.district_id) || 0) + 1);
      }

      const result: ProductionDistrict[] = (districts || []).map(d => ({
        id: d.id,
        name: d.name,
        city_id: d.city_id,
        city_name: city?.name || "Unknown",
        is_delivery: d.is_delivery,
        area_count: areasByDistrict.get(d.id) || 0,
        areas_with_geofence: areasWithGeoByDistrict.get(d.id) || 0,
      }));

      return result;
    },
  });
}
