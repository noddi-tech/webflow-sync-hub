import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RefreshCw, Upload, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SyncProgressDialog } from "@/components/sync/SyncProgressDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EntityType = "service_categories" | "services" | "cities" | "districts" | "areas" | "partners" | "service_locations";

const ENTITIES: { value: EntityType; label: string }[] = [
  { value: "service_categories", label: "Service Categories" },
  { value: "services", label: "Services" },
  { value: "cities", label: "Cities" },
  { value: "districts", label: "Districts" },
  { value: "areas", label: "Areas" },
  { value: "partners", label: "Partners" },
  { value: "service_locations", label: "Service Locations" },
];

export default function WebflowSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEntities, setSelectedEntities] = useState<EntityType[]>([]);
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings-configured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ENTITIES.map(e => `webflow_${e.value}_collection_id`));
      
      const configured: Record<string, boolean> = {};
      data?.forEach((s) => {
        const entityType = s.key.replace("webflow_", "").replace("_collection_id", "");
        configured[entityType] = Boolean(s.value && s.value.trim() !== "");
      });
      
      return configured;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ entities, batchId }: { entities: EntityType[]; batchId: string }) => {
      const { data, error } = await supabase.functions.invoke("webflow-sync", {
        body: { 
          entity_type: entities.length === ENTITIES.length ? "all" : entities[0], 
          batch_id: batchId,
          entities: entities.length > 1 ? entities : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: ({ batchId }) => {
      setCurrentBatchId(batchId);
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

  const toggleEntity = (entity: EntityType) => {
    setSelectedEntities(prev =>
      prev.includes(entity)
        ? prev.filter(e => e !== entity)
        : [...prev, entity]
    );
  };

  const selectAll = () => {
    const configuredEntities = ENTITIES.filter(e => settings?.[e.value]).map(e => e.value);
    setSelectedEntities(configuredEntities);
  };

  const handleSync = () => {
    if (selectedEntities.length === 0) return;
    syncMutation.mutate({
      entities: selectedEntities,
      batchId: crypto.randomUUID(),
    });
  };

  const configuredCount = ENTITIES.filter(e => settings?.[e.value]).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Sync to Webflow</h1>
        <p className="text-muted-foreground mt-1">
          Push local changes to your Webflow CMS collections
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Select Collections
            </CardTitle>
            <CardDescription>
              Choose which collections to sync to Webflow. Only configured collections can be synced.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {configuredCount === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No Webflow collections configured. Go to Settings to add collection IDs.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {ENTITIES.map((entity) => {
                const isConfigured = settings?.[entity.value] ?? false;
                return (
                  <div key={entity.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={entity.value}
                      checked={selectedEntities.includes(entity.value)}
                      onCheckedChange={() => toggleEntity(entity.value)}
                      disabled={!isConfigured}
                    />
                    <Label
                      htmlFor={entity.value}
                      className={!isConfigured ? "text-muted-foreground" : ""}
                    >
                      {entity.label}
                      {!isConfigured && (
                        <span className="ml-2 text-xs text-muted-foreground">(not configured)</span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={configuredCount === 0}
              >
                Select All Configured
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEntities([])}
              >
                Clear Selection
              </Button>
            </div>

            <Button
              onClick={handleSync}
              disabled={selectedEntities.length === 0 || syncMutation.isPending}
              className="w-full"
            >
              {syncMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Sync {selectedEntities.length > 0 ? `${selectedEntities.length} Collection${selectedEntities.length > 1 ? 's' : ''}` : 'Selected'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <SyncProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        batchId={currentBatchId}
        operation="sync"
        entities={selectedEntities}
        source="webflow"
        onComplete={() => {}}
      />
    </div>
  );
}
