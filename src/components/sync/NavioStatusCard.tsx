import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Database, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export interface NavioStatus {
  snapshotCount: number;
  lastSnapshotUpdate: string | null;
  productionAreasCount: number;
  stagingPendingCount: number;
  stagingApprovedCount: number;
  isLoading: boolean;
}

export function useNavioStatus() {
  return useQuery({
    queryKey: ["navio-status"],
    queryFn: async (): Promise<Omit<NavioStatus, "isLoading">> => {
      const [snapshotResult, areasResult, stagingCitiesResult] = await Promise.all([
        supabase.from("navio_snapshot").select("snapshot_at", { count: "exact", head: false }).limit(1).order("snapshot_at", { ascending: false }),
        supabase.from("areas").select("id", { count: "exact", head: true }),
        supabase.from("navio_staging_cities").select("status", { count: "exact" }),
      ]);

      const pendingCount = stagingCitiesResult.data?.filter(c => c.status === "pending").length || 0;
      const approvedCount = stagingCitiesResult.data?.filter(c => c.status === "approved").length || 0;

      return {
        snapshotCount: snapshotResult.count || 0,
        lastSnapshotUpdate: snapshotResult.data?.[0]?.snapshot_at || null,
        productionAreasCount: areasResult.count || 0,
        stagingPendingCount: pendingCount,
        stagingApprovedCount: approvedCount,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

interface NavioStatusCardProps {
  className?: string;
}

export function NavioStatusCard({ className }: NavioStatusCardProps) {
  const { data: status, isLoading } = useNavioStatus();

  if (isLoading || !status) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-6 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasSnapshot = status.snapshotCount > 0;
  const hasApprovedData = status.stagingApprovedCount > 0;
  const needsCommit = !hasSnapshot && hasApprovedData;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          System Status
          {hasSnapshot ? (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
              Snapshot Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              <Clock className="mr-1 h-3 w-3" />
              No Snapshot
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Snapshot Areas</p>
            <p className="font-medium text-lg">
              {status.snapshotCount > 0 ? status.snapshotCount.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Production Areas</p>
            <p className="font-medium text-lg">
              {status.productionAreasCount > 0 ? status.productionAreasCount.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending in Staging</p>
            <p className="font-medium text-lg">
              {status.stagingPendingCount > 0 ? status.stagingPendingCount.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved (Ready)</p>
            <p className={`font-medium text-lg ${status.stagingApprovedCount > 0 ? "text-green-600" : ""}`}>
              {status.stagingApprovedCount > 0 ? status.stagingApprovedCount.toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {needsCommit && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Commit Required</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              You have {status.stagingApprovedCount} approved cities waiting to be committed.
              Commit them to populate the snapshot and enable delta checking.
            </AlertDescription>
            <Button asChild size="sm" className="mt-3" variant="outline">
              <Link to="/navio-preview">Go to Preview & Commit</Link>
            </Button>
          </Alert>
        )}

        {hasSnapshot && status.lastSnapshotUpdate && (
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDistanceToNow(new Date(status.lastSnapshotUpdate))} ago
          </p>
        )}

        {!hasSnapshot && !hasApprovedData && (
          <p className="text-xs text-muted-foreground">
            No snapshot or approved data. Run an AI Import to discover areas, then approve and commit them.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
