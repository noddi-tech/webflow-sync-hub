import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  RefreshCw, 
  Shield,
  MapPin,
  Radio,
  ChevronDown,
  ChevronUp,
  Brain,
  Link2,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CityBreakdownEntry {
  city: string;
  areas: number;
  uniqueZones: number;
  snapshotZones: number;
  synced: boolean;
}

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
  cityBreakdown?: CityBreakdownEntry[];
  healthStatus: "healthy" | "warning" | "needs_attention";
  areasNeedingAttention: Array<{ id: string; name: string; city: string; issue: string }>;
}

export function CoverageHealthCard() {
  const queryClient = useQueryClient();
  const [showCities, setShowCities] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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
      
      const cities = data.cityBreakdown?.length || 0;
      const { uniquePolygons, totalAreas } = data.geofenceCoverage;
      toast.success("Coverage check complete", {
        description: `${cities} cities verified — ${uniquePolygons} unique zones across ${totalAreas.toLocaleString()} areas`,
      });
    },
    onError: (error) => {
      toast.error("Coverage check failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const result = checkCoverageMutation.data || lastCheck?.result;
  const isLoading = checkCoverageMutation.isPending;

  const getHealthBadge = () => {
    if (!result) return { label: "Check Needed", variant: "secondary" as const };
    
    switch (result.healthStatus) {
      case "healthy":
        return { label: "Healthy", variant: "default" as const };
      case "warning":
        return { label: "Warning", variant: "secondary" as const };
      case "needs_attention":
        return { label: "Needs Attention", variant: "destructive" as const };
      default:
        return { label: "Check Needed", variant: "secondary" as const };
    }
  };

  const healthBadge = getHealthBadge();
  const cityBreakdown = result?.cityBreakdown || [];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={cn(
              "h-4 w-4",
              !result ? "text-muted-foreground" :
              result.healthStatus === "healthy" ? "text-green-500" :
              result.healthStatus === "warning" ? "text-amber-500" : "text-red-500"
            )} />
            <CardTitle className="text-sm">Data Alignment Check</CardTitle>
          </div>
          {result && (
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
        {result ? (
          <>
            {/* API Status */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Radio className={cn(
                  "h-3.5 w-3.5",
                  result.apiStatus.snapshotStale ? "text-amber-500" : "text-green-500"
                )} />
                <span>Navio API</span>
              </div>
              <span className="text-muted-foreground">
                {result.apiStatus.liveZoneCount} zones
                {result.apiStatus.snapshotStale ? (
                  <span className="text-amber-500 ml-1">• stale</span>
                ) : (
                  <span className="text-green-500 ml-1">• in sync</span>
                )}
              </span>
            </div>

            {/* City Coverage - Collapsible Table */}
            <Collapsible open={showCities} onOpenChange={setShowCities}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs px-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    City Coverage ({cityBreakdown.length} cities)
                  </span>
                  {showCities ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              
              {/* Always show top 5 */}
              <div className="space-y-0.5 mt-1">
                {cityBreakdown.slice(0, 5).map((city) => (
                  <CityRow key={city.city} city={city} />
                ))}
              </div>

              <CollapsibleContent className="space-y-0.5">
                {cityBreakdown.slice(5).map((city) => (
                  <CityRow key={city.city} city={city} />
                ))}
              </CollapsibleContent>
              
              {cityBreakdown.length > 5 && !showCities && (
                <button 
                  onClick={() => setShowCities(true)}
                  className="text-[10px] text-muted-foreground hover:text-foreground mt-1 pl-5"
                >
                  +{cityBreakdown.length - 5} more cities…
                </button>
              )}
            </Collapsible>

            {/* Navio ID Linkage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Navio ID Linkage</span>
                </div>
                <span className="text-muted-foreground">
                  {result.navioLinkage.realNavioIds.toLocaleString()} linked
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-5">
                <Brain className="h-3 w-3" />
                <span>
                  {result.navioLinkage.aiDiscoveredIds.toLocaleString()} AI-discovered
                </span>
              </div>
            </div>

            {/* Summary line */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>Total</span>
              </div>
              <span className="text-muted-foreground">
                {result.geofenceCoverage.uniquePolygons} unique geofences across {result.geofenceCoverage.totalAreas.toLocaleString()} areas
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground pl-5">
              All neighborhoods inherit their parent Navio zone polygon
            </p>

            {/* Areas needing attention */}
            {result.areasNeedingAttention.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      {result.areasNeedingAttention.length} areas need attention
                    </span>
                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="max-h-24 overflow-auto text-[10px] space-y-0.5 pl-4">
                    {result.areasNeedingAttention.slice(0, 10).map((area) => (
                      <div key={area.id} className="text-muted-foreground">
                        {area.name} <span className="text-muted-foreground/60">({area.city})</span>
                      </div>
                    ))}
                    {result.areasNeedingAttention.length > 10 && (
                      <div className="text-muted-foreground/60">
                        +{result.areasNeedingAttention.length - 10} more...
                      </div>
                    )}
                  </div>
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

function CityRow({ city }: { city: CityBreakdownEntry }) {
  return (
    <div className="flex items-center justify-between text-[11px] pl-5 pr-1">
      <span className="truncate flex-1 min-w-0">{city.city}</span>
      <span className="text-muted-foreground whitespace-nowrap ml-2">
        {city.areas.toLocaleString()} areas / {city.uniqueZones} zones
      </span>
    </div>
  );
}
