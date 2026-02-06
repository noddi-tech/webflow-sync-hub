import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Shield,
  MapPin,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface CoverageCheckResult {
  snapshotFreshness: {
    isUpToDate: boolean;
    apiCount: number;
    snapshotCount: number;
    missingFromSnapshot: number;
    removedFromApi: number;
  };
  coverageAlignment: {
    navioAreasTotal: number;
    navioAreasCovered: number;
    navioAreasUncovered: number;
    productionAreasTotal: number;
    productionAreasAligned: number;
    productionAreasOrphaned: number;
  };
  uncoveredNavioAreas: Array<{ id: number; name: string; city: string }>;
  orphanedProductionAreas: Array<{ id: string; name: string; city: string }>;
}

export function CoverageHealthCard() {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  // Query for last check result from settings
  const { data: lastCheck } = useQuery({
    queryKey: ["coverage-check-last"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value, updated_at")
        .eq("key", "navio_coverage_check")
        .maybeSingle();
      
      if (data?.value) {
        return {
          result: JSON.parse(data.value) as CoverageCheckResult,
          checkedAt: data.updated_at,
        };
      }
      return null;
    },
  });

  const checkCoverageMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("navio-import", {
        body: { mode: "coverage_check", batch_id: crypto.randomUUID() },
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data as CoverageCheckResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coverage-check-last"] });
      queryClient.invalidateQueries({ queryKey: ["navio-operation-log"] });
      
      const covered = data.coverageAlignment.navioAreasCovered;
      const total = data.coverageAlignment.navioAreasTotal;
      const orphaned = data.coverageAlignment.productionAreasOrphaned;
      
      if (data.coverageAlignment.navioAreasUncovered === 0 && orphaned === 0) {
        toast.success("Coverage check complete", {
          description: `All ${total} Navio zones are covered in production`,
        });
      } else {
        toast.warning("Coverage gaps detected", {
          description: `${covered}/${total} zones covered, ${orphaned} orphaned areas`,
        });
      }
    },
    onError: (error) => {
      toast.error("Coverage check failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const result = checkCoverageMutation.data || lastCheck?.result;
  const isLoading = checkCoverageMutation.isPending;

  // Calculate overall health status
  const getHealthStatus = () => {
    if (!result) return { status: "unknown", color: "text-muted-foreground" };
    
    const { snapshotFreshness, coverageAlignment } = result;
    
    if (!snapshotFreshness.isUpToDate || coverageAlignment.navioAreasUncovered > 5) {
      return { status: "warning", color: "text-amber-500" };
    }
    
    if (coverageAlignment.navioAreasUncovered === 0 && snapshotFreshness.isUpToDate) {
      return { status: "healthy", color: "text-green-500" };
    }
    
    return { status: "ok", color: "text-blue-500" };
  };

  const health = getHealthStatus();

  const coveragePercent = result 
    ? Math.round((result.coverageAlignment.navioAreasCovered / Math.max(result.coverageAlignment.navioAreasTotal, 1)) * 100)
    : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${health.color}`} />
            <CardTitle className="text-sm">Coverage Check</CardTitle>
          </div>
          {result && (
            <Badge 
              variant={health.status === "healthy" ? "default" : health.status === "warning" ? "destructive" : "secondary"}
              className="text-xs"
            >
              {health.status === "healthy" ? "Aligned" : health.status === "warning" ? "Gaps Found" : "Check Needed"}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Verify production data matches Navio API
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-3">
        {result ? (
          <>
            {/* Snapshot Freshness */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {result.snapshotFreshness.isUpToDate ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span>Snapshot Status</span>
              </div>
              <span className="text-muted-foreground">
                {result.snapshotFreshness.apiCount} API / {result.snapshotFreshness.snapshotCount} stored
              </span>
            </div>

            {/* Coverage Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Navio Zone Coverage</span>
                </div>
                <span className={coveragePercent === 100 ? "text-green-500" : "text-amber-500"}>
                  {coveragePercent}%
                </span>
              </div>
              <Progress value={coveragePercent} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{result.coverageAlignment.navioAreasCovered} covered</span>
                <span>{result.coverageAlignment.navioAreasUncovered} gaps</span>
              </div>
            </div>

            {/* Production Areas */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>Production Areas</span>
              </div>
              <span className="text-muted-foreground">
                {result.coverageAlignment.productionAreasAligned.toLocaleString()} aligned / {result.coverageAlignment.productionAreasOrphaned} orphaned
              </span>
            </div>

            {/* Expandable Details */}
            {(result.uncoveredNavioAreas.length > 0 || result.orphanedProductionAreas.length > 0) && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                    <span>View Details</span>
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {result.uncoveredNavioAreas.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium flex items-center gap-1 text-amber-600">
                        <XCircle className="h-3 w-3" />
                        Uncovered Navio Zones ({result.uncoveredNavioAreas.length})
                      </div>
                      <div className="max-h-24 overflow-auto text-[10px] space-y-0.5 pl-4">
                        {result.uncoveredNavioAreas.slice(0, 10).map((area) => (
                          <div key={area.id} className="text-muted-foreground">
                            {area.name} <span className="text-muted-foreground/60">({area.city})</span>
                          </div>
                        ))}
                        {result.uncoveredNavioAreas.length > 10 && (
                          <div className="text-muted-foreground/60">
                            +{result.uncoveredNavioAreas.length - 10} more...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {result.orphanedProductionAreas.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium flex items-center gap-1 text-orange-600">
                        <AlertTriangle className="h-3 w-3" />
                        Orphaned Production Areas ({result.orphanedProductionAreas.length})
                      </div>
                      <div className="max-h-24 overflow-auto text-[10px] space-y-0.5 pl-4">
                        {result.orphanedProductionAreas.slice(0, 10).map((area) => (
                          <div key={area.id} className="text-muted-foreground">
                            {area.name} <span className="text-muted-foreground/60">({area.city})</span>
                          </div>
                        ))}
                        {result.orphanedProductionAreas.length > 10 && (
                          <div className="text-muted-foreground/60">
                            +{result.orphanedProductionAreas.length - 10} more...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Last checked time */}
            {lastCheck?.checkedAt && (
              <div className="text-[10px] text-muted-foreground text-center">
                Last checked: {new Date(lastCheck.checkedAt).toLocaleString()}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-2">
            No coverage data. Run a check to verify alignment.
          </div>
        )}

        <div className="flex-1" />
        <Button
          onClick={() => checkCoverageMutation.mutate()}
          disabled={isLoading}
          size="sm"
          variant={result ? "outline" : "default"}
          className="w-full"
        >
          {isLoading ? (
            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Shield className="mr-2 h-3 w-3" />
          )}
          {result ? "Recheck Coverage" : "Check Coverage"}
        </Button>
      </CardContent>
    </Card>
  );
}
