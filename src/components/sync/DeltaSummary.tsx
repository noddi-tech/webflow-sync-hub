import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Plus, Minus, RefreshCw, MapPin } from "lucide-react";

export interface DeltaSummary {
  new: number;
  removed: number;
  changed: number;
  geofenceChanged: number;
  unchanged: number;
}

export interface DeltaCheckResult {
  hasChanges: boolean;
  summary: DeltaSummary;
  affectedCities: string[];
  newAreas: Array<{ id: number; name: string; city_name?: string; hasGeofence?: boolean }>;
  removedAreas: Array<{ navio_service_area_id: number; name: string; city_name?: string }>;
  changedAreas: Array<{ id: number; name: string; oldName?: string; city_name?: string; geofenceChanged?: boolean }>;
  isFirstImport?: boolean;
}

interface DeltaSummaryCardProps {
  deltaResult: DeltaCheckResult;
  onStartImport: () => void;
  isImporting: boolean;
}

export function DeltaSummaryCard({ deltaResult, onStartImport, isImporting }: DeltaSummaryCardProps) {
  const { summary, hasChanges, affectedCities, isFirstImport } = deltaResult;
  const totalAreas = summary.new + summary.removed + summary.changed + summary.unchanged;

  if (isFirstImport) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-blue-600" />
            First Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No previous snapshot found. This will perform a full import of all {summary.new} delivery areas.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{summary.new} areas</Badge>
            <span className="text-muted-foreground">to import</span>
          </div>
          <Button onClick={onStartImport} disabled={isImporting} className="w-full">
            {isImporting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Start Full Import
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasChanges) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            All Up to Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All {summary.unchanged} delivery areas match the current Navio data. No import needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Delta Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">
              <Plus className="mr-1 h-3 w-3" />
              {summary.new}
            </Badge>
            <span className="text-muted-foreground">new areas</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">
              <Minus className="mr-1 h-3 w-3" />
              {summary.removed}
            </Badge>
            <span className="text-muted-foreground">removed</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{summary.changed}</Badge>
            <span className="text-muted-foreground">changed</span>
          </div>
          {summary.geofenceChanged > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                <MapPin className="mr-1 h-3 w-3" />
                {summary.geofenceChanged}
              </Badge>
              <span className="text-muted-foreground">polygon updates</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{summary.unchanged}</Badge>
            <span className="text-muted-foreground">unchanged</span>
          </div>
        </div>

        {affectedCities.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Affected cities: </span>
            <span className="text-muted-foreground">
              {affectedCities.slice(0, 5).join(", ")}
              {affectedCities.length > 5 && ` +${affectedCities.length - 5} more`}
            </span>
          </div>
        )}

        {summary.removed > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Areas Removed from Navio</AlertTitle>
            <AlertDescription className="text-xs">
              {summary.removed} area(s) no longer exist in Navio. Review before committing.
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={onStartImport} disabled={isImporting} className="w-full">
          {isImporting ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Import Changes Only
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Only {affectedCities.length} cities will be processed (vs {totalAreas > 0 ? Math.round(summary.unchanged / totalAreas * 100) : 0}% skipped)
        </p>
      </CardContent>
    </Card>
  );
}
