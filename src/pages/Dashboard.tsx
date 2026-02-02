import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Map, Layers, Users, RefreshCw, Upload, ChevronDown, FolderTree, Wrench, Link2, Globe, Download, Brain, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SyncProgressDialog } from "@/components/sync/SyncProgressDialog";
import { SystemHealthPanel } from "@/components/health/SystemHealthPanel";
import { useNavioImport } from "@/hooks/useNavioImport";

type EntityType = "all" | "service_categories" | "services" | "cities" | "districts" | "areas" | "partners" | "service_locations";

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "all", label: "All Entities" },
  { value: "service_categories", label: "Service Categories" },
  { value: "services", label: "Services" },
  { value: "cities", label: "Cities" },
  { value: "districts", label: "Districts" },
  { value: "areas", label: "Areas" },
  { value: "partners", label: "Partners" },
  { value: "service_locations", label: "Service Locations" },
];

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentOperation, setCurrentOperation] = useState<"import" | "sync">("import");
  const [currentEntities, setCurrentEntities] = useState<string[]>([]);
  const [currentSource, setCurrentSource] = useState<"webflow" | "navio">("webflow");

  // Use the new incremental Navio import hook
  const { cityProgress, navioIncrementalImport, isImporting: isNavioImporting } = useNavioImport();

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

  const { data: settings } = useQuery({
    queryKey: ["settings-configured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "webflow_service_categories_collection_id",
          "webflow_services_collection_id",
          "webflow_cities_collection_id",
          "webflow_districts_collection_id",
          "webflow_areas_collection_id",
          "webflow_partners_collection_id",
          "webflow_service_locations_collection_id",
        ]);
      
      const configured: Record<string, boolean> = {};
      data?.forEach((s) => {
        const entityType = s.key.replace("webflow_", "").replace("_collection_id", "");
        configured[entityType] = Boolean(s.value && s.value.trim() !== "");
      });
      
      return {
        hasCollectionIds: Object.values(configured).some(Boolean),
        configuredEntities: configured,
      };
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ entityType, batchId }: { entityType: EntityType; batchId: string }) => {
      const { data, error } = await supabase.functions.invoke("webflow-import", {
        body: { entity_type: entityType, batch_id: batchId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: ({ entityType, batchId }) => {
      const entities = entityType === "all" 
        ? ["service_categories", "services", "cities", "districts", "areas", "partners", "service_locations"]
        : [entityType];
      setCurrentEntities(entities);
      setCurrentOperation("import");
      setCurrentBatchId(batchId);
      setCurrentSource("webflow");
      setProgressOpen(true);
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
      setProgressOpen(false);
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => setProgressOpen(false), 1500);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ entityType, batchId }: { entityType: EntityType; batchId: string }) => {
      const { data, error } = await supabase.functions.invoke("webflow-sync", {
        body: { entity_type: entityType, batch_id: batchId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: ({ entityType, batchId }) => {
      const entities = entityType === "all" 
        ? ["service_categories", "services", "cities", "districts", "areas", "partners", "service_locations"]
        : [entityType];
      setCurrentEntities(entities);
      setCurrentOperation("sync");
      setCurrentBatchId(batchId);
      setCurrentSource("webflow");
      setProgressOpen(true);
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
      setProgressOpen(false);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => setProgressOpen(false), 1500);
    },
  });

  // Legacy Navio mutations removed - using useNavioImport hook instead

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

  const isConfigured = settings?.hasCollectionIds ?? false;
  const configuredEntities = settings?.configuredEntities ?? {};
  const isSyncing = importMutation.isPending || syncMutation.isPending || isNavioImporting;

  const isEntityConfigured = (entity: EntityType) => {
    if (entity === "all") return isConfigured;
    return configuredEntities[entity] ?? false;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Webflow CMS content</p>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!isConfigured || isSyncing}>
                  {importMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Import Data
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ENTITY_OPTIONS.map((option, index) => (
                  <div key={option.value}>
                    {index === 1 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => importMutation.mutate({ entityType: option.value, batchId: crypto.randomUUID() })}
                      disabled={!isEntityConfigured(option.value)}
                    >
                      {option.label}
                      {!isEntityConfigured(option.value) && option.value !== "all" && (
                        <span className="ml-2 text-xs text-muted-foreground">(not configured)</span>
                      )}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!isConfigured || isSyncing}>
                  {syncMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Changes
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ENTITY_OPTIONS.map((option, index) => (
                  <div key={option.value}>
                    {index === 1 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => syncMutation.mutate({ entityType: option.value, batchId: crypto.randomUUID() })}
                      disabled={!isEntityConfigured(option.value)}
                    >
                      {option.label}
                      {!isEntityConfigured(option.value) && option.value !== "all" && (
                        <span className="ml-2 text-xs text-muted-foreground">(not configured)</span>
                      )}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
              <Brain className="h-5 w-5" />
              Import from Navio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Fetch delivery areas from Navio and use AI to organize them into Cities, Districts, and Areas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => navioIncrementalImport.mutate({ batchId: crypto.randomUUID() })}
                disabled={isSyncing}
              >
                {isNavioImporting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Fetch & Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SyncProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        batchId={currentBatchId}
        operation={currentOperation}
        entities={currentEntities}
        source={currentSource}
        cityProgress={cityProgress}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
        }}
      />
    </div>
  );
}
