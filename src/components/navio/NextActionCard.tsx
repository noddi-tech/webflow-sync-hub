import { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Brain, 
  CheckCircle2, 
  Search,
  Upload,
  Sparkles,
  MapPinned,
  RefreshCw,
} from "lucide-react";
import { useNavioPipelineStatus } from "@/hooks/useNavioPipelineStatus";
import { cn } from "@/lib/utils";

interface NextActionCardProps {
  onCheckChanges?: () => void;
  onImport?: () => void;
  onGoToStaging?: () => void;
  onGeoSync?: () => void;
  isCheckingDelta?: boolean;
  isImporting?: boolean;
  isGeoSyncing?: boolean;
}

export const NextActionCard = forwardRef<HTMLDivElement, NextActionCardProps>(
  ({
    onCheckChanges,
    onImport,
    onGoToStaging,
    onGeoSync,
    isCheckingDelta,
    isImporting,
    isGeoSyncing,
  }, ref) => {
    const { data: status, isLoading } = useNavioPipelineStatus();

    if (isLoading || !status) {
      return null;
    }

    const { nextAction } = status;

    const urgencyStyles = {
      low: "border-muted bg-card",
      medium: "border-amber-500/30 bg-amber-500/5",
      high: "border-green-500/30 bg-green-500/5",
    };

    const getIcon = () => {
      switch (nextAction.type) {
        case "import":
          return <Brain className="h-5 w-5 text-primary" />;
        case "review":
          return <Search className="h-5 w-5 text-amber-500" />;
        case "commit":
          return <Upload className="h-5 w-5 text-green-500" />;
        case "sync":
          return <Search className="h-5 w-5 text-primary" />;
        case "geo_sync":
          return <MapPinned className="h-5 w-5 text-amber-500" />;
        case "none":
          return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        default:
          return <Sparkles className="h-5 w-5 text-primary" />;
      }
    };

    const getActionButton = () => {
      switch (nextAction.type) {
        case "import":
          return (
            <Button onClick={onImport} disabled={isImporting} size="sm">
              {isImporting ? "Importing..." : "Start AI Import"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          );
        case "review":
          return (
            <Button onClick={onGoToStaging} variant="secondary" size="sm">
              Review Staging
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          );
        case "commit":
          return (
            <Button onClick={onGoToStaging} size="sm" className="bg-green-600 hover:bg-green-700">
              Go to Commit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          );
        case "sync":
          // Check if this is a geo-sync message (missing geofences)
          if (nextAction.message.includes("geofence") && onGeoSync) {
            return (
              <Button 
                onClick={onGeoSync} 
                disabled={isGeoSyncing} 
                size="sm"
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isGeoSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <MapPinned className="mr-2 h-4 w-4" />
                    Run Geo Sync
                  </>
                )}
              </Button>
            );
          }
          return (
            <Button onClick={onCheckChanges} disabled={isCheckingDelta} variant="outline" size="sm">
              {isCheckingDelta ? "Checking..." : "Check for Changes"}
              <Search className="ml-2 h-4 w-4" />
            </Button>
          );
        case "geo_sync":
          return (
            <Button 
              onClick={onGeoSync} 
              disabled={isGeoSyncing} 
              size="sm"
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isGeoSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Run Geo Sync
                </>
              )}
            </Button>
          );
        case "none":
          return null;
        default:
          return null;
      }
    };

    return (
      <Card ref={ref} className={cn("transition-colors", urgencyStyles[nextAction.urgency])}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-full bg-background/80">
                {getIcon()}
              </div>
              <div>
                <p className="text-sm font-medium">Next Step</p>
                <p className="text-sm text-muted-foreground">{nextAction.message}</p>
              </div>
            </div>
            {getActionButton()}
          </div>
        </CardContent>
      </Card>
    );
  }
);
NextActionCard.displayName = "NextActionCard";
