import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Map, Layers, Users, RefreshCw, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: counts, isLoading } = useQuery({
    queryKey: ["entity-counts"],
    queryFn: async () => {
      const [cities, districts, areas, partners] = await Promise.all([
        supabase.from("cities").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
        supabase.from("areas").select("id", { count: "exact", head: true }),
        supabase.from("partners").select("id", { count: "exact", head: true }),
      ]);
      
      return {
        cities: cities.count ?? 0,
        districts: districts.count ?? 0,
        areas: areas.count ?? 0,
        partners: partners.count ?? 0,
      };
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-configured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "webflow_cities_collection_id",
          "webflow_districts_collection_id",
          "webflow_areas_collection_id",
          "webflow_partners_collection_id",
        ]);
      
      const configured = data?.filter((s) => s.value && s.value.trim() !== "");
      return {
        hasCollectionIds: (configured?.length ?? 0) > 0,
        configuredCount: configured?.length ?? 0,
      };
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("webflow-import", {
        body: { entity_type: "all" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      const total = Object.values(data.imported as Record<string, number>).reduce(
        (sum, count) => sum + count,
        0
      );
      toast({
        title: "Import Complete",
        description: `Successfully imported ${total} items from Webflow.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("webflow-sync", {
        body: { entity_type: "all" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const synced = data.synced as Record<string, { created: number; updated: number }>;
      const totalCreated = Object.values(synced).reduce((sum, s) => sum + s.created, 0);
      const totalUpdated = Object.values(synced).reduce((sum, s) => sum + s.updated, 0);
      toast({
        title: "Sync Complete",
        description: `Created ${totalCreated} and updated ${totalUpdated} items in Webflow.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stats = [
    { name: "Cities", value: counts?.cities ?? 0, icon: MapPin, href: "/cities" },
    { name: "Districts", value: counts?.districts ?? 0, icon: Map, href: "/districts" },
    { name: "Areas", value: counts?.areas ?? 0, icon: Layers, href: "/areas" },
    { name: "Partners", value: counts?.partners ?? 0, icon: Users, href: "/partners" },
  ];

  const isConfigured = settings?.hasCollectionIds ?? false;
  const isSyncing = importMutation.isPending || syncMutation.isPending;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Webflow CMS content</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name}>
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
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import from Webflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Pull existing data from your Webflow CMS collections into the local database.
            </p>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!isConfigured || isSyncing}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import Data
            </Button>
            {!isConfigured && (
              <p className="text-xs text-muted-foreground mt-2">
                Configure Webflow collection IDs in Settings first
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync to Webflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Push local changes to your Webflow CMS collections.
            </p>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={!isConfigured || isSyncing}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Changes
            </Button>
            {!isConfigured && (
              <p className="text-xs text-muted-foreground mt-2">
                Configure Webflow collection IDs in Settings first
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
