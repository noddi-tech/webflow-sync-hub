import { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  Search, 
  MapPinned, 
  Upload, 
  Check, 
  X, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  History,
} from "lucide-react";
import { useNavioOperationLog, type OperationType, type OperationStatus } from "@/hooks/useNavioOperationLog";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const operationIcons: Record<OperationType, React.ReactNode> = {
  delta_check: <Search className="h-4 w-4" />,
  ai_import: <Brain className="h-4 w-4" />,
  geo_sync: <MapPinned className="h-4 w-4" />,
  commit: <Upload className="h-4 w-4" />,
  approve: <Check className="h-4 w-4" />,
  reject: <X className="h-4 w-4" />,
};

const operationLabels: Record<OperationType, string> = {
  delta_check: "Check for Changes",
  ai_import: "AI Import",
  geo_sync: "Geo Sync",
  commit: "Commit",
  approve: "Approve",
  reject: "Reject",
};

const statusStyles: Record<OperationStatus, { badge: string; icon: React.ReactNode }> = {
  started: { 
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20", 
    icon: <Clock className="h-3 w-3" /> 
  },
  success: { 
    badge: "bg-green-500/10 text-green-500 border-green-500/20", 
    icon: <CheckCircle2 className="h-3 w-3" /> 
  },
  failed: { 
    badge: "bg-red-500/10 text-red-500 border-red-500/20", 
    icon: <XCircle className="h-3 w-3" /> 
  },
};

interface OperationHistoryTableProps {
  limit?: number;
  showHeader?: boolean;
}

export const OperationHistoryTable = forwardRef<HTMLDivElement, OperationHistoryTableProps>(
  ({ limit = 10, showHeader = true }, ref) => {
    const { logs, isLoading } = useNavioOperationLog(limit);

    if (isLoading) {
      return (
        <Card ref={ref}>
          {showHeader && (
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Operations
              </CardTitle>
            </CardHeader>
          )}
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (logs.length === 0) {
      return (
        <Card ref={ref}>
          {showHeader && (
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Operations
              </CardTitle>
            </CardHeader>
          )}
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No operations recorded yet</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Operations
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {logs.map(log => {
              const details = log.details as Record<string, unknown> | null;
              const detailsText = details 
                ? Object.entries(details)
                    .filter(([key]) => !key.startsWith("_"))
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(", ")
                : null;

              return (
                <div 
                  key={log.id} 
                  className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex-shrink-0 p-2 rounded-full bg-muted/50">
                    {operationIcons[log.operation_type] || <Activity className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {operationLabels[log.operation_type] || log.operation_type}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", statusStyles[log.status].badge)}
                      >
                        {statusStyles[log.status].icon}
                        <span className="ml-1 capitalize">{log.status}</span>
                      </Badge>
                    </div>
                    {detailsText && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {detailsText}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                      {log.completed_at && log.status !== "started" && (
                        <span className="ml-1">
                          • Duration: {Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
);
OperationHistoryTable.displayName = "OperationHistoryTable";
