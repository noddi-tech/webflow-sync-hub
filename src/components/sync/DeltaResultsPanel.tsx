import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, RefreshCw, MapPin, ChevronDown, AlertTriangle, Pencil } from "lucide-react";
import type { DeltaCheckResult } from "./DeltaSummary";

interface DeltaResultsPanelProps {
  result: DeltaCheckResult;
  onStartImport: () => void;
  isImporting: boolean;
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key] || "Unknown");
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function DeltaResultsPanel({ result, onStartImport, isImporting }: DeltaResultsPanelProps) {
  const [newAreasOpen, setNewAreasOpen] = useState(false);
  const [removedAreasOpen, setRemovedAreasOpen] = useState(false);
  const [changedAreasOpen, setChangedAreasOpen] = useState(false);

  const { summary, hasChanges, affectedCities, isFirstImport, newAreas, removedAreas, changedAreas } = result;

  if (isFirstImport) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-blue-600" />
            First Import Detected
          </CardTitle>
          <CardDescription>
            No previous snapshot found. This will perform a full import of all Navio delivery areas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {summary.new.toLocaleString()} areas
            </Badge>
            <span className="text-muted-foreground">discovered from Navio API</span>
          </div>
          <Button onClick={onStartImport} disabled={isImporting} className="w-full">
            {isImporting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Start Full AI Import
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            AI will classify areas into cities and districts
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasChanges) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-green-800 dark:text-green-200">
            <RefreshCw className="h-4 w-4" />
            All Up to Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700 dark:text-green-300">
            All {summary.unchanged.toLocaleString()} delivery areas match the current Navio data. No import needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalChanges = summary.new + summary.removed + summary.changed;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Delta Check Results</CardTitle>
        <CardDescription>
          Found {totalChanges.toLocaleString()} changes across {affectedCities.length} cities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {summary.new > 0 && (
            <Badge className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-1 h-3 w-3" />
              {summary.new} new
            </Badge>
          )}
          {summary.removed > 0 && (
            <Badge variant="destructive">
              <Minus className="mr-1 h-3 w-3" />
              {summary.removed} removed
            </Badge>
          )}
          {summary.changed > 0 && (
            <Badge variant="secondary">
              <Pencil className="mr-1 h-3 w-3" />
              {summary.changed} changed
            </Badge>
          )}
          {summary.geofenceChanged > 0 && (
            <Badge variant="outline" className="border-blue-500 text-blue-600">
              <MapPin className="mr-1 h-3 w-3" />
              {summary.geofenceChanged} polygon updates
            </Badge>
          )}
          <Badge variant="outline">
            {summary.unchanged.toLocaleString()} unchanged
          </Badge>
        </div>

        {/* Expandable sections */}
        <div className="space-y-2">
          {/* New Areas */}
          {newAreas.length > 0 && (
            <Collapsible open={newAreasOpen} onOpenChange={setNewAreasOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded-lg transition-colors">
                <Plus className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">New Areas ({newAreas.length})</span>
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${newAreasOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-60 rounded-md border p-3 mt-2">
                  {Object.entries(groupBy(newAreas, "city_name")).map(([city, areas]) => (
                    <div key={city} className="mb-3">
                      <p className="font-medium text-sm text-foreground">{city}</p>
                      <ul className="pl-4 mt-1 space-y-0.5">
                        {areas.map((area) => (
                          <li key={area.id} className="text-sm text-muted-foreground flex items-center gap-2">
                            {area.name}
                            {area.hasGeofence && <MapPin className="h-3 w-3 text-blue-500" />}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Changed Areas */}
          {changedAreas.length > 0 && (
            <Collapsible open={changedAreasOpen} onOpenChange={setChangedAreasOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded-lg transition-colors">
                <Pencil className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-sm">Changed Areas ({changedAreas.length})</span>
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${changedAreasOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-60 rounded-md border p-3 mt-2">
                  {Object.entries(groupBy(changedAreas, "city_name")).map(([city, areas]) => (
                    <div key={city} className="mb-3">
                      <p className="font-medium text-sm text-foreground">{city}</p>
                      <ul className="pl-4 mt-1 space-y-0.5">
                        {areas.map((area) => (
                          <li key={area.id} className="text-sm text-muted-foreground flex items-center gap-2">
                            {area.oldName ? (
                              <span>
                                <span className="line-through text-muted-foreground/60">{area.oldName}</span>
                                {" → "}
                                {area.name}
                              </span>
                            ) : (
                              area.name
                            )}
                            {area.geofenceChanged && (
                              <span title="Polygon updated">
                                <MapPin className="h-3 w-3 text-blue-500" />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Removed Areas */}
          {removedAreas.length > 0 && (
            <Collapsible open={removedAreasOpen} onOpenChange={setRemovedAreasOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded-lg transition-colors">
                <Minus className="h-4 w-4 text-red-600" />
                <span className="font-medium text-sm">Removed Areas ({removedAreas.length})</span>
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${removedAreasOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 mt-2">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-xs text-destructive">
                      These areas no longer exist in Navio. They will be flagged as inactive.
                    </p>
                  </div>
                  <ScrollArea className="h-40">
                    {Object.entries(groupBy(removedAreas, "city_name")).map(([city, areas]) => (
                      <div key={city} className="mb-2">
                        <p className="font-medium text-sm text-foreground">{city}</p>
                        <ul className="pl-4 mt-1 space-y-0.5">
                          {areas.map((area) => (
                            <li key={area.navio_service_area_id} className="text-sm text-muted-foreground">
                              {area.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Affected cities summary */}
        {affectedCities.length > 0 && (
          <div className="text-sm border-t pt-3">
            <span className="font-medium">Affected cities: </span>
            <span className="text-muted-foreground">
              {affectedCities.slice(0, 5).join(", ")}
              {affectedCities.length > 5 && ` +${affectedCities.length - 5} more`}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={onStartImport} disabled={isImporting} className="flex-1">
            {isImporting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Import {totalChanges} Changes
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Only {affectedCities.length} cities will be processed ({Math.round(summary.unchanged / (summary.unchanged + totalChanges) * 100)}% skipped)
        </p>
      </CardContent>
    </Card>
  );
}
