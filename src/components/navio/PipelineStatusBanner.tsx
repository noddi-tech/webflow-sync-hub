import { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Database, 
  Layers, 
  CloudDownload, 
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useNavioPipelineStatus } from "@/hooks/useNavioPipelineStatus";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface StageCardProps {
  label: string;
  icon: React.ReactNode;
  count: number;
  secondaryCount?: number;
  secondaryLabel?: string;
  status: "empty" | "has-data" | "warning" | "success";
  showArrow?: boolean;
}

const StageCard = forwardRef<HTMLDivElement, StageCardProps>(
  ({ label, icon, count, secondaryCount, secondaryLabel, status, showArrow = true }, ref) => {
    const statusStyles = {
      empty: "border-muted-foreground/20 bg-muted/30",
      "has-data": "border-primary/30 bg-primary/5",
      warning: "border-amber-500/30 bg-amber-500/5",
      success: "border-green-500/30 bg-green-500/5",
    };

    const statusIcon = {
      empty: <Clock className="h-3 w-3 text-muted-foreground" />,
      "has-data": <Database className="h-3 w-3 text-primary" />,
      warning: <AlertCircle className="h-3 w-3 text-amber-500" />,
      success: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    };

    return (
      <div ref={ref} className="flex items-center gap-2">
        <div className={cn(
          "flex-1 rounded-lg border p-4 transition-colors",
          statusStyles[status]
        )}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {icon}
            <span className="font-medium uppercase tracking-wide">{label}</span>
            {statusIcon[status]}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {count > 0 ? count.toLocaleString() : "—"}
            </span>
            {secondaryCount !== undefined && secondaryCount > 0 && (
              <span className="text-sm text-muted-foreground">
                ({secondaryCount} {secondaryLabel})
              </span>
            )}
          </div>
        </div>
        {showArrow && (
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
        )}
      </div>
    );
  }
);
StageCard.displayName = "StageCard";

export const PipelineStatusBanner = forwardRef<HTMLDivElement>((_, ref) => {
  const { data: status, isLoading } = useNavioPipelineStatus();

  if (isLoading) {
    return (
      <Card ref={ref}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-20 flex-1 rounded-lg" />
                {i < 3 && <Skeleton className="h-4 w-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const { stages, lastSnapshotUpdate } = status;

  return (
    <Card ref={ref}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              NAVIO PIPELINE
            </Badge>
          </div>
          {lastSnapshotUpdate && (
            <span className="text-xs text-muted-foreground">
              Snapshot updated {formatDistanceToNow(new Date(lastSnapshotUpdate))} ago
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-0">
          <StageCard
            label="Snapshot"
            icon={<CloudDownload className="h-3 w-3" />}
            count={stages.snapshot.count}
            status={stages.snapshot.status}
          />
          <StageCard
            label="Staging"
            icon={<Layers className="h-3 w-3" />}
            count={stages.staging.count}
            secondaryCount={stages.staging.secondaryCount}
            secondaryLabel={stages.staging.secondaryLabel}
            status={stages.staging.status}
          />
          <StageCard
            label="Production"
            icon={<Database className="h-3 w-3" />}
            count={stages.production.count}
            secondaryCount={stages.production.secondaryCount}
            secondaryLabel={stages.production.secondaryLabel}
            status={stages.production.status}
            showArrow={false}
          />
        </div>

        {/* Staging breakdown */}
        {(status.stagingPending > 0 || status.stagingApproved > 0) && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-3">
            {status.stagingPending > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {status.stagingPending} pending review
              </Badge>
            )}
            {status.stagingApproved > 0 && (
              <Badge variant="default" className="bg-green-500 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {status.stagingApproved} approved (ready to commit)
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
PipelineStatusBanner.displayName = "PipelineStatusBanner";
