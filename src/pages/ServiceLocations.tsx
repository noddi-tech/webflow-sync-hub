import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, ExternalLink, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ServiceLocation {
  id: string;
  service_id: string;
  city_id: string;
  district_id: string | null;
  area_id: string | null;
  slug: string;
  canonical_url: string;
  seo_title: string;
  seo_meta_description: string;
  sitemap_priority: number | null;
  noindex: boolean | null;
  webflow_item_id: string | null;
  services?: { name: string };
  cities?: { name: string };
  districts?: { name: string } | null;
  areas?: { name: string } | null;
}

export default function ServiceLocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterService, setFilterService] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("");

  const { data: locations, isLoading } = useQuery({
    queryKey: ["service-locations", filterService, filterCity],
    queryFn: async () => {
      let query = supabase
        .from("service_locations")
        .select(`
          *,
          services(name),
          cities(name),
          districts(name),
          areas(name)
        `)
        .order("created_at", { ascending: false });

      if (filterService) query = query.eq("service_id", filterService);
      if (filterCity) query = query.eq("city_id", filterCity);

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceLocation[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id, name").order("name");
      return data || [];
    },
  });

  // Count partners per service location
  const { data: partnerCounts } = useQuery({
    queryKey: ["service-location-partner-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_location_partners")
        .select("service_location_id");
      
      const counts: Record<string, number> = {};
      data?.forEach((row) => {
        counts[row.service_location_id] = (counts[row.service_location_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Regenerate mutation - calls sync with only service_locations
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("webflow-sync", {
        body: { entity_type: "service_locations" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-locations"] });
      queryClient.invalidateQueries({ queryKey: ["service-location-partner-counts"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      
      const serviceLocations = data.synced?.service_locations;
      toast({
        title: "Regeneration Complete",
        description: serviceLocations 
          ? `Created ${serviceLocations.created} and updated ${serviceLocations.updated} service locations.`
          : "Service locations regenerated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Regeneration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearFilters = () => {
    setFilterService("");
    setFilterCity("");
  };

  const buildLocationString = (loc: ServiceLocation) => {
    const parts = [loc.areas?.name, loc.districts?.name, loc.cities?.name].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Service Locations</h1>
          <p className="text-muted-foreground mt-1">
            Computed SEO pages based on partner coverage (read-only)
          </p>
        </div>
        <Button 
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
          {regenerateMutation.isPending ? "Regenerating..." : "Regenerate All"}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Service Locations are automatically computed based on Partner Service Locations. 
                Each unique combination of Service + Location that has at least one partner creates a Service Location.
                These are synced to Webflow as SEO-optimized landing pages. Click "Regenerate All" to recompute from partner coverage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger>
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger>
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Cities</SelectItem>
                {cities?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{locations?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total Service Locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {locations?.filter((l) => l.webflow_item_id).length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Synced to Webflow</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {locations?.filter((l) => !l.webflow_item_id).length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Pending Sync</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : locations?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No service locations found. Add Partner Service Locations to generate them.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Partners</TableHead>
                <TableHead>SEO Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.services?.name}</TableCell>
                  <TableCell>{buildLocationString(loc)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {partnerCounts?.[loc.id] ?? 0} partners
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={loc.seo_title}>
                    {loc.seo_title}
                  </TableCell>
                  <TableCell>{loc.sitemap_priority ?? 0.5}</TableCell>
                  <TableCell>
                    {loc.webflow_item_id ? (
                      <Badge variant="default">Synced</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                    {loc.noindex && (
                      <Badge variant="destructive" className="ml-1">noindex</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {loc.canonical_url && (
                      <a
                        href={loc.canonical_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
