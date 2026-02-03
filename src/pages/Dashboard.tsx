import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Map, Layers, Users, FolderTree, Wrench, Link2, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { SystemHealthPanel } from "@/components/health/SystemHealthPanel";

export default function Dashboard() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["entity-counts"],
    queryFn: async () => {
      const [serviceCategories, services, cities, districts, areas, partners, partnerServiceLocations, serviceLocations] = await Promise.all([
        supabase.from("service_categories").select("id", { count: "exact", head: true }),
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("cities").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
        supabase.from("areas").select("id", { count: "exact", head: true }),
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("partner_service_locations").select("id", { count: "exact", head: true }),
        supabase.from("service_locations").select("id", { count: "exact", head: true }),
      ]);
      
      return {
        service_categories: serviceCategories.count ?? 0,
        services: services.count ?? 0,
        cities: cities.count ?? 0,
        districts: districts.count ?? 0,
        areas: areas.count ?? 0,
        partners: partners.count ?? 0,
        partner_service_locations: partnerServiceLocations.count ?? 0,
        service_locations: serviceLocations.count ?? 0,
      };
    },
  });

  const stats = [
    { name: "Service Categories", value: counts?.service_categories ?? 0, icon: FolderTree, href: "/service-categories" },
    { name: "Services", value: counts?.services ?? 0, icon: Wrench, href: "/services" },
    { name: "Cities", value: counts?.cities ?? 0, icon: MapPin, href: "/cities" },
    { name: "Districts", value: counts?.districts ?? 0, icon: Map, href: "/districts" },
    { name: "Areas", value: counts?.areas ?? 0, icon: Layers, href: "/areas" },
    { name: "Partners", value: counts?.partners ?? 0, icon: Users, href: "/partners" },
    { name: "Partner Coverage", value: counts?.partner_service_locations ?? 0, icon: Link2, href: "/partner-service-locations" },
    { name: "Service Locations", value: counts?.service_locations ?? 0, icon: Globe, href: "/service-locations" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your CMS content</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.name} to={stat.href} className="block">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-bold">{stat.value}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* System Health Panel */}
      <SystemHealthPanel />
    </div>
  );
}
