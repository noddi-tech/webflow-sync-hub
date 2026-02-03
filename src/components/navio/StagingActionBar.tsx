import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Database, RefreshCw } from "lucide-react";

interface CommitProgress {
  current: number;
  total: number;
  currentCityName?: string;
  retryAttempt?: number;
  retryMax?: number;
}

interface StagingActionBarProps {
  selectedCount: number;
  approvedCount: number;
  onApprove: () => void;
  onReject: () => void;
  onCommit: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isCommitting: boolean;
  commitProgress?: CommitProgress | null;
}

export function StagingActionBar({
  selectedCount,
  approvedCount,
  onApprove,
  onReject,
  onCommit,
  isApproving,
  isRejecting,
  isCommitting,
  commitProgress,
}: StagingActionBarProps) {
  const showBar = selectedCount > 0 || approvedCount > 0;

  if (!showBar) return null;

  const progressPercent = commitProgress
    ? Math.round((commitProgress.current / commitProgress.total) * 100)
    : 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Card className="shadow-lg border-2 bg-background/95 backdrop-blur-sm">
        <CardContent className="py-3 px-4 flex items-center gap-4">
          {/* Selection Actions */}
          {selectedCount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {selectedCount} selected
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={isApproving || isCommitting}
                >
                  {isApproving ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  disabled={isRejecting || isCommitting}
                >
                  {isRejecting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-1" />
                  )}
                  Reject
                </Button>
              </div>
            </>
          )}

          {/* Separator when both sections visible */}
          {selectedCount > 0 && approvedCount > 0 && (
            <Separator orientation="vertical" className="h-8" />
          )}

          {/* Commit Section */}
          {approvedCount > 0 && (
            <div className="flex items-center gap-3">
              {isCommitting && commitProgress ? (
                <div className="flex items-center gap-3 min-w-[240px]">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate max-w-[140px]">
                        {commitProgress.retryAttempt 
                          ? `Retrying (${commitProgress.retryAttempt}/${commitProgress.retryMax})...`
                          : commitProgress.currentCityName || "Committing..."}
                      </span>
                      <span>{commitProgress.current}/{commitProgress.total}</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={onCommit}
                  disabled={isCommitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCommitting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-1" />
                  )}
                  Commit {approvedCount} Approved
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
