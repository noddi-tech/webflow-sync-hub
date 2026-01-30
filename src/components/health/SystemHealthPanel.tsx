import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Activity, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollectionHealthCard } from "./CollectionHealthCard";
import { DataCompletenessCard } from "./DataCompletenessCard";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ValidationResults {
  collections: Record<string, {
    webflow_collection_name: string | null;
    collection_id: string | null;
    status: "ok" | "missing_fields" | "not_configured" | "error";
    expected_fields: string[];
    found_fields: string[];
    missing_in_webflow: string[];
    missing_required: string[];
    extra_in_webflow: string[];
    error_message?: string;
  }>;
  summary: {
    total: number;
    ok: number;
    missing_fields: number;
    not_configured: number;
    errors: number;
  };
  data_completeness?: Record<string, {
    total: number;
    seo_title: number;
    seo_meta_description: number;
    intro: number;
    name_en: number;
    name_sv: number;
  }>;
}

interface SystemHealthRecord {
  id: string;
  check_type: string;
  status: "healthy" | "warning" | "error";
  results: ValidationResults;
  summary: ValidationResults["summary"];
  checked_at: string;
  triggered_by: string;
}

export function SystemHealthPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch latest health check from database
  const { data: latestHealth, isLoading: isLoadingHealth } = useQuery({
    queryKey: ["system-health-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_health")
        .select("*")
        .eq("check_type", "webflow_validation")
        .order("checked_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return null;
      
      // Type cast the JSONB fields
      return {
        id: data.id,
        check_type: data.check_type,
        status: data.status as "healthy" | "warning" | "error",
        results: data.results as unknown as ValidationResults,
        summary: data.summary as unknown as ValidationResults["summary"],
        checked_at: data.checked_at,
        triggered_by: data.triggered_by,
      } satisfies SystemHealthRecord;
    },
  });

  // Run validation check
  const validateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("webflow-validate", {
        body: { store_results: true, triggered_by: "manual" },
      });
      if (error) throw error;
      return data as ValidationResults;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-health-latest"] });
      toast({
        title: "Health check complete",
        description: "System health has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Health check failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const results = latestHealth?.results;
  const summary = results?.summary;

  const getOverallStatus = () => {
    if (!summary) return "unknown";
    if (summary.errors > 0) return "error";
    if (summary.missing_fields > 0 || summary.not_configured > 0) return "warning";
    return "healthy";
  };

  const overallStatus = getOverallStatus();

  const StatusIcon = () => {
    switch (overallStatus) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="mb-8">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">System Health</CardTitle>
                <StatusIcon />
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-4">
              {latestHealth && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Last check: {formatDistanceToNow(new Date(latestHealth.checked_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Run Check
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoadingHealth ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !results ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No health checks have been run yet.</p>
                <Button
                  className="mt-4"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  Run First Health Check
                </Button>
              </div>
            ) : (
              <>
                {/* Summary Banner */}
                {overallStatus === "warning" && (
                  <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">
                        {summary?.missing_fields} collection(s) have missing fields, {summary?.not_configured} not configured
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Review the collection mappings below to ensure all fields are properly configured.
                      </p>
                    </div>
                  </div>
                )}

                {overallStatus === "error" && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">
                        {summary?.errors} collection(s) have errors
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Check the error messages below and verify your Webflow collection IDs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Collection Status Cards */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Collection Mappings
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {results.collections && Object.entries(results.collections).map(([key, collection]) => (
                      <CollectionHealthCard
                        key={key}
                        name={key}
                        collection={collection}
                      />
                    ))}
                  </div>
                </div>

                {/* Data Completeness */}
                {results.data_completeness && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Data Completeness
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(results.data_completeness).map(([entity, stats]) => (
                        <DataCompletenessCard
                          key={entity}
                          entity={entity}
                          stats={stats}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
