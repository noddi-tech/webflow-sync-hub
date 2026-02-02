import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EntityProgress {
  name: string;
  current: number;
  total: number;
  status: "pending" | "in_progress" | "completed" | "error";
}

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | null;
  operation: "import" | "sync";
  entities: string[];
  onComplete?: () => void;
  source?: "webflow" | "navio";
}

export function SyncProgressDialog({
  open,
  onOpenChange,
  batchId,
  operation,
  entities,
  onComplete,
  source = "webflow",
}: SyncProgressDialogProps) {
  const sourceLabel = source === "navio" ? "Navio" : "Webflow";
  const [progress, setProgress] = useState<Record<string, EntityProgress>>({});
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Initialize progress for all entities
    const initial: Record<string, EntityProgress> = {};
    entities.forEach((entity) => {
      initial[entity] = {
        name: entity.charAt(0).toUpperCase() + entity.slice(1),
        current: 0,
        total: 0,
        status: "pending",
      };
    });
    setProgress(initial);
    setIsComplete(false);
  }, [entities, batchId]);

  useEffect(() => {
    if (!open || !batchId) return;

    const pollInterval = setInterval(async () => {
      const { data: logs } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true });

      if (!logs || logs.length === 0) return;

      const newProgress: Record<string, EntityProgress> = { ...progress };
      let allComplete = true;
      let hasAnyProgress = false;

      entities.forEach((entity) => {
        const entityLogs = logs.filter((log) => log.entity_type === entity);
        const progressLog = entityLogs.find((log) => log.status === "in_progress");
        const completedLog = entityLogs.find((log) => log.status === "complete");
        const errorLog = entityLogs.find((log) => log.status === "error");

        if (completedLog) {
          newProgress[entity] = {
            ...newProgress[entity],
            status: "completed",
            current: completedLog.current_item || completedLog.total_items || newProgress[entity].total || 0,
            total: completedLog.total_items || newProgress[entity].total || 0,
          };
          hasAnyProgress = true;
        } else if (errorLog) {
          newProgress[entity] = {
            ...newProgress[entity],
            status: "error",
          };
          hasAnyProgress = true;
          allComplete = false;
        } else if (progressLog) {
          newProgress[entity] = {
            ...newProgress[entity],
            current: progressLog.current_item || 0,
            total: progressLog.total_items || 0,
            status: "in_progress",
          };
          allComplete = false;
          hasAnyProgress = true;
        } else {
          allComplete = false;
        }
      });

      setProgress(newProgress);

      // Check for completion: any log with status "complete" for our entities
      const batchComplete = logs.some(
        (log) => log.status === "complete" && entities.includes(log.entity_type)
      );

      if (batchComplete || (hasAnyProgress && allComplete)) {
        setIsComplete(true);
        clearInterval(pollInterval);
        setTimeout(() => {
          onComplete?.();
          onOpenChange(false);
        }, 1500);
      }
    }, 1500); // Poll every 1.5 seconds for faster feedback

    return () => clearInterval(pollInterval);
  }, [open, batchId, entities, operation, onComplete, onOpenChange]);

  const totalProgress = Object.values(progress).reduce(
    (acc, p) => {
      acc.current += p.current;
      acc.total += p.total;
      return acc;
    },
    { current: 0, total: 0 }
  );

  const overallPercent =
    totalProgress.total > 0
      ? Math.round((totalProgress.current / totalProgress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isComplete
              ? `${operation === "import" ? "Import" : "Sync"} Complete`
              : `${operation === "import" ? "Importing from" : "Syncing to"} ${sourceLabel}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show connecting state when no progress yet */}
          {!Object.values(progress).some(p => p.status !== "pending") && !isComplete && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Connecting to {sourceLabel}...
              </p>
            </div>
          )}
          
          {entities.map((entity) => {
            const entityProgress = progress[entity];
            if (!entityProgress) return null;

            const percent =
              entityProgress.total > 0
                ? Math.round(
                    (entityProgress.current / entityProgress.total) * 100
                  )
                : 0;

            return (
              <div key={entity} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {entityProgress.status === "completed" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {entityProgress.status === "in_progress" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {entityProgress.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {entityProgress.status === "pending" && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}
                    <span
                      className={cn(
                        entityProgress.status === "completed" &&
                          "text-green-500",
                        entityProgress.status === "error" && "text-destructive"
                      )}
                    >
                      {entityProgress.name}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {entityProgress.total > 0
                      ? `${entityProgress.current}/${entityProgress.total}`
                      : entityProgress.status === "pending"
                      ? "Waiting..."
                      : "—"}
                  </span>
                </div>
                {entityProgress.status === "in_progress" && (
                  <Progress value={percent} className="h-2" />
                )}
              </div>
            );
          })}

          {!isComplete && totalProgress.total > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Overall Progress</span>
                <span className="text-muted-foreground">{overallPercent}%</span>
              </div>
              <Progress value={overallPercent} className="h-2" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
