import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Link2,
  MapPin,
  RefreshCw,
  Database,
  Search,
  Upload,
  Check,
  X,
  Activity,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { OperationLogEntry, OperationType } from "@/hooks/useNavioOperationLog";
import { formatDistanceToNow } from "date-fns";

interface OperationDetailDialogProps {
  log: OperationLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const operationLabels: Record<OperationType, string> = {
  delta_check: "Check for Changes",
  ai_import: "AI Import",
  geo_sync: "Geo Sync",
  commit: "Commit",
  approve: "Approve",
  reject: "Reject",
  coverage_check: "Coverage Check",
  deactivate_orphans: "Deactivate Orphans",
};

export function OperationDetailDialog({ log, open, onOpenChange }: OperationDetailDialogProps) {
  if (!log) return null;

  const details = log.details as Record<string, unknown> | null;
  const isCoverageCheck = log.operation_type === "coverage_check";
  const isDeactivateOrphans = log.operation_type === "deactivate_orphans";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">
              {operationLabels[log.operation_type] || log.operation_type}
            </DialogTitle>
            <StatusBadge status={log.status} />
          </div>
          <DialogDescription className="text-xs">
            {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
            {log.completed_at && log.status !== "started" && (
              <span className="ml-1">
                • Duration: {Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {isCoverageCheck && details ? (
            <CoverageCheckDetails details={details} log={log} onOpenChange={onOpenChange} />
          ) : isDeactivateOrphans && details ? (
            <DeactivateOrphansDetails details={details} />
          ) : details ? (
            <GenericDetails details={details} />
          ) : (
            <p className="text-sm text-muted-foreground">No details available.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Status Badge ────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    started: { label: "Running", variant: "secondary" as const, icon: <Clock className="h-3 w-3" /> },
    success: { label: "Success", variant: "default" as const, icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: "Failed", variant: "destructive" as const, icon: <XCircle className="h-3 w-3" /> },
  }[status] || { label: status, variant: "secondary" as const, icon: <Activity className="h-3 w-3" /> };

  return (
    <Badge variant={config.variant} className="text-xs gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ── Coverage Check Details ──────────────────────────────────

function CoverageCheckDetails({ details, log, onOpenChange }: {
  details: Record<string, unknown>;
  log: OperationLogEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const orphanedAreasByZone = details.orphanedAreasByZone as Record<string, { zoneName: string; city: string; areas: string[] }> | undefined;
  const removedZoneNames = details.removedZoneNames as string[] | undefined;
  const orphanedCount = (details.orphanedAreas as number) || 0;
  const removedZoneCount = (details.removedZones as number) || 0;
  const healthStatus = details.healthStatus as string | undefined;
  const cityBreakdown = details.cityBreakdown as Array<{ city: string; areas: number; uniqueZones: number; snapshotZones: number; synced: boolean }> | undefined;

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("navio-import", {
        body: { mode: "deactivate_orphans", batch_id: crypto.randomUUID() },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coverage-check-last"] });
      queryClient.invalidateQueries({ queryKey: ["navio-operation-log"] });
      toast.success("Areas deactivated", { description: data.message });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Deactivation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  return (
    <div className="space-y-4">
      {/* Health Status */}
      <div className="flex items-center gap-2">
        <Shield className={cn(
          "h-4 w-4",
          healthStatus === "healthy" ? "text-green-500" :
          healthStatus === "warning" ? "text-amber-500" : "text-red-500"
        )} />
        <span className="text-sm font-medium">
          {healthStatus === "healthy" ? "All delivery zones are active and aligned" :
           healthStatus === "warning" ? "Some cities may need syncing" :
           "Production data needs attention"}
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricItem label="API Zones" value={String(details.apiZones || 0)} />
        <MetricItem label="Coverage" value={`${details.coveragePercent || 0}%`} />
        <MetricItem label="Navio-linked" value={String(details.realNavioIds || 0)} />
        <MetricItem label="AI-discovered" value={String(details.aiDiscoveredIds || 0)} />
        <MetricItem label="Unique Polygons" value={String(details.uniquePolygons || 0)} />
        <MetricItem label="Cities" value={String(details.cities || 0)} />
      </div>

      {/* Orphaned Areas Section */}
      {orphanedCount > 0 && orphanedAreasByZone && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="h-4 w-4" />
              {removedZoneCount} Removed Zone{removedZoneCount !== 1 ? "s" : ""} — {orphanedCount} area{orphanedCount !== 1 ? "s" : ""} affected
            </div>
            <p className="text-xs text-muted-foreground">
              These Navio zones are no longer active in the API, but production areas are still marked as delivery zones:
            </p>
            <div className="space-y-2 max-h-48 overflow-auto">
              {Object.entries(orphanedAreasByZone).map(([navioId, data]) => (
                <div key={navioId} className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{data.zoneName}</span>
                    <Badge variant="outline" className="text-[10px]">{data.city}</Badge>
                  </div>
                  <p className="text-muted-foreground text-[10px]">
                    Navio zone <code className="bg-muted px-1 rounded">{data.zoneName}</code> is no longer active in the API
                  </p>
                  <div className="text-muted-foreground text-[10px]">
                    {data.areas.length} area{data.areas.length !== 1 ? "s" : ""}: {data.areas.slice(0, 5).join(", ")}
                    {data.areas.length > 5 && ` +${data.areas.length - 5} more`}
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              {deactivateMutation.isPending ? (
                <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-3 w-3" />
              )}
              Deactivate {orphanedCount} Area{orphanedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}

      {orphanedCount === 0 && (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            All delivery zones are active — no orphaned areas
          </div>
        </>
      )}

      {/* City Breakdown */}
      {cityBreakdown && cityBreakdown.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <MapPin className="h-3.5 w-3.5" />
              City Breakdown
            </div>
            <div className="space-y-0.5 max-h-40 overflow-auto">
              {cityBreakdown.map(c => (
                <div key={c.city} className="flex items-center justify-between text-[11px] px-1">
                  <span className="flex items-center gap-1">
                    {c.synced ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                    {c.city}
                  </span>
                  <span className="text-muted-foreground">
                    {c.areas} areas / {c.uniqueZones} zones
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Error message */}
      {details.error && (
        <>
          <Separator />
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            <strong>Error:</strong> {String(details.error)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Deactivate Orphans Details ──────────────────────────────

function DeactivateOrphansDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="text-sm">{String(details.message || "Operation complete")}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricItem label="Areas Deactivated" value={String(details.deactivatedAreas || 0)} />
        <MetricItem label="Removed Zones" value={String(details.removedZones || 0)} />
      </div>
      {details.error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          <strong>Error:</strong> {String(details.error)}
        </div>
      )}
    </div>
  );
}

// ── Generic Details ─────────────────────────────────────────

function GenericDetails({ details }: { details: Record<string, unknown> }) {
  const message = details.message ? String(details.message) : null;
  const entries = Object.entries(details).filter(
    ([key]) => key !== "message" && !key.startsWith("_")
  );

  return (
    <div className="space-y-3">
      {message && <div className="text-sm">{message}</div>}
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
              <span className="font-mono text-[11px]">
                {typeof value === "object" ? JSON.stringify(value).slice(0, 60) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      {details.error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          <strong>Error:</strong> {String(details.error)}
        </div>
      )}
    </div>
  );
}

// ── Metric Item ─────────────────────────────────────────────

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
