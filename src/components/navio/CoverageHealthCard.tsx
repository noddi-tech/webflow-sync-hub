import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Shield,
  MapPin,
  Database,
  Radio,
  ChevronDown,
  ChevronUp,
  Brain,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CoverageCheckResult {
  apiStatus: {
    liveZoneCount: number;
    zonesWithGeofence: number;
    snapshotCount: number;
    snapshotStale: boolean;
    missingFromSnapshot: number;
    removedFromApi: number;
  };
  geofenceCoverage: {
    totalAreas: number;
    withGeofence: number;
    missingGeofence: number;
    coveragePercent: number;
    uniquePolygons: number;
  };
  navioLinkage: {
    realNavioIds: number;
    aiDiscoveredIds: number;
    noNavioId: number;
  };
  healthStatus: "healthy" | "warning" | "needs_attention";
  areasNeedingAttention: Array<{ id: string; name: string; city: string; issue: string }>;
  // Legacy fields for backwards compatibility
  snapshotFreshness?: {
    isUpToDate: boolean;
    apiCount: number;
    snapshotCount: number;
    missingFromSnapshot: number;
    removedFromApi: number;
  };
  coverageAlignment?: {
    navioAreasTotal: number;
    navioAreasCovered: number;
    navioAreasUncovered: number;
    productionAreasTotal: number;
    productionAreasAligned: number;
    productionAreasOrphaned: number;
  };
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
      
      const { geofenceCoverage, navioLinkage } = data;
      
      if (geofenceCoverage.coveragePercent >= 95) {
        toast.success("Coverage check complete", {
          description: `${geofenceCoverage.coveragePercent}% geofence coverage (${geofenceCoverage.withGeofence.toLocaleString()} areas)`,
        });
      } else {
        toast.warning("Coverage gaps detected", {
          description: `${geofenceCoverage.coveragePercent}% coverage, ${geofenceCoverage.missingGeofence} areas missing geofences`,
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

  // Handle both new and legacy data structures
  const getDisplayData = () => {
    if (!result) return null;
    
    // New structure
    if (result.geofenceCoverage) {
      return {
        apiStatus: result.apiStatus,
        geofenceCoverage: result.geofenceCoverage,
        navioLinkage: result.navioLinkage,
        healthStatus: result.healthStatus,
        areasNeedingAttention: result.areasNeedingAttention || [],
      };
    }
    
    // Legacy structure - convert
    const legacy = result as unknown as {
      snapshotFreshness: { isUpToDate: boolean; apiCount: number; snapshotCount: number };
      coverageAlignment: { productionAreasTotal: number; productionAreasAligned: number; productionAreasOrphaned: number };
    };
    
    return {
      apiStatus: {
        liveZoneCount: legacy.snapshotFreshness?.apiCount || 0,
        zonesWithGeofence: legacy.snapshotFreshness?.apiCount || 0,
        snapshotCount: legacy.snapshotFreshness?.snapshotCount || 0,
        snapshotStale: !legacy.snapshotFreshness?.isUpToDate,
        missingFromSnapshot: 0,
        removedFromApi: 0,
      },
      geofenceCoverage: {
        totalAreas: legacy.coverageAlignment?.productionAreasTotal || 0,
        withGeofence: legacy.coverageAlignment?.productionAreasAligned || 0,
        missingGeofence: (legacy.coverageAlignment?.productionAreasTotal || 0) - (legacy.coverageAlignment?.productionAreasAligned || 0),
        coveragePercent: Math.round(((legacy.coverageAlignment?.productionAreasAligned || 0) / Math.max(legacy.coverageAlignment?.productionAreasTotal || 1, 1)) * 100),
        uniquePolygons: 0,
      },
      navioLinkage: {
        realNavioIds: 0,
        aiDiscoveredIds: legacy.coverageAlignment?.productionAreasOrphaned || 0,
        noNavioId: 0,
      },
      healthStatus: "warning" as const,
      areasNeedingAttention: [],
    };
  };

  const displayData = getDisplayData();

  // Determine health badge
  const getHealthBadge = () => {
    if (!displayData) return { label: "Check Needed", variant: "secondary" as const };
    
    if (displayData.healthStatus === "healthy" || displayData.geofenceCoverage.coveragePercent >= 95) {
      return { label: "Healthy", variant: "default" as const };
    } else if (displayData.healthStatus === "warning" || displayData.geofenceCoverage.coveragePercent >= 80) {
      return { label: "Warning", variant: "secondary" as const };
    }
    return { label: "Needs Attention", variant: "destructive" as const };
  };

  const healthBadge = getHealthBadge();

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={cn(
              "h-4 w-4",
              !displayData ? "text-muted-foreground" :
              displayData.geofenceCoverage.coveragePercent >= 95 ? "text-green-500" :
              displayData.geofenceCoverage.coveragePercent >= 80 ? "text-amber-500" : "text-red-500"
            )} />
            <CardTitle className="text-sm">Data Alignment Check</CardTitle>
          </div>
          {displayData && (
            <Badge variant={healthBadge.variant} className="text-xs">
              {healthBadge.label}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Verify production data completeness
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-3">
        {displayData ? (
          <>
            {/* API Status */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Radio className={cn(
                  "h-3.5 w-3.5",
                  displayData.apiStatus.snapshotStale ? "text-amber-500" : "text-green-500"
                )} />
                <span>Navio API Status</span>
              </div>
              <span className="text-muted-foreground">
                {displayData.apiStatus.liveZoneCount} zones
                {displayData.apiStatus.snapshotStale && (
                  <span className="text-amber-500 ml-1">• stale</span>
                )}
              </span>
            </div>

            {/* Geofence Coverage - Primary Metric */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Geofence Coverage</span>
                </div>
                <span className={cn(
                  "font-medium",
                  displayData.geofenceCoverage.coveragePercent >= 95 ? "text-green-500" :
                  displayData.geofenceCoverage.coveragePercent >= 80 ? "text-amber-500" : "text-red-500"
                )}>
                  {displayData.geofenceCoverage.coveragePercent}%
                </span>
              </div>
              <Progress value={displayData.geofenceCoverage.coveragePercent} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{displayData.geofenceCoverage.withGeofence.toLocaleString()} with polygons</span>
                {displayData.geofenceCoverage.uniquePolygons > 0 && (
                  <span>{displayData.geofenceCoverage.uniquePolygons} unique shapes</span>
                )}
              </div>
            </div>

            {/* Navio ID Linkage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Navio ID Linkage</span>
                </div>
                <span className="text-muted-foreground">
                  {displayData.navioLinkage.realNavioIds.toLocaleString()} linked
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-5">
                <Brain className="h-3 w-3" />
                <span>
                  {displayData.navioLinkage.aiDiscoveredIds.toLocaleString()} AI-discovered 
                  <span className="text-muted-foreground/70"> (share parent geofences)</span>
                </span>
              </div>
            </div>

            {/* Production Areas Summary */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>Production Areas</span>
              </div>
              <span className="text-muted-foreground">
                {displayData.geofenceCoverage.totalAreas.toLocaleString()} total
              </span>
            </div>

            {/* Expandable Details - Only show if there are issues */}
            {displayData.areasNeedingAttention.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      {displayData.areasNeedingAttention.length} areas need attention
                    </span>
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="max-h-24 overflow-auto text-[10px] space-y-0.5 pl-4">
                    {displayData.areasNeedingAttention.slice(0, 10).map((area) => (
                      <div key={area.id} className="text-muted-foreground">
                        {area.name} <span className="text-muted-foreground/60">({area.city})</span>
                      </div>
                    ))}
                    {displayData.areasNeedingAttention.length > 10 && (
                      <div className="text-muted-foreground/60">
                        +{displayData.areasNeedingAttention.length - 10} more...
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Success message when no issues */}
            {displayData.areasNeedingAttention.length === 0 && displayData.geofenceCoverage.coveragePercent >= 95 && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>All areas have geofence coverage</span>
              </div>
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
          variant={displayData ? "outline" : "default"}
          className="w-full"
        >
          {isLoading ? (
            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Shield className="mr-2 h-3 w-3" />
          )}
          {displayData ? "Recheck Coverage" : "Check Coverage"}
        </Button>
      </CardContent>
    </Card>
  );
}
