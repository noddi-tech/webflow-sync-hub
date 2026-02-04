import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Database, Layers, CloudDownload, AlertTriangle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MapSource = "staging" | "production" | "snapshot";

interface EnhancedSourceToggleProps {
  value: MapSource;
  onChange: (value: MapSource) => void;
  stagingCount?: number;
  productionCount?: number;
  productionGeoCount?: number;
  snapshotCount?: number;
  className?: string;
}

export function EnhancedSourceToggle({
  value,
  onChange,
  stagingCount = 0,
  productionCount = 0,
  productionGeoCount = 0,
  snapshotCount = 0,
  className,
}: EnhancedSourceToggleProps) {
  const productionNeedsGeoSync = productionCount > 0 && productionGeoCount === 0;
  
  const sources: Array<{
    id: MapSource;
    label: string;
    icon: React.ReactNode;
    count: number;
    geoCount?: number;
    description: string;
    warning?: string;
  }> = [
    {
      id: "staging",
      label: "Staging",
      icon: <Layers className="h-4 w-4" />,
      count: stagingCount,
      description: "Pending changes",
    },
    {
      id: "production",
      label: "Production",
      icon: <Database className="h-4 w-4" />,
      count: productionCount,
      geoCount: productionGeoCount,
      description: "Live data",
      warning: productionNeedsGeoSync 
        ? `${productionCount.toLocaleString()} areas exist but none have geofence data. Run Geo Sync to fix.`
        : undefined,
    },
    {
      id: "snapshot",
      label: "Snapshot",
      icon: <CloudDownload className="h-4 w-4" />,
      count: snapshotCount,
      description: "Navio cache",
    },
  ];

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Data Source</span>
        {productionNeedsGeoSync && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Geo Sync needed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px] text-xs">
                  Production areas have no geofence polygons. Run Geo Sync to populate map data.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as MapSource)}
        className="grid grid-cols-3 gap-2"
      >
        {sources.map((source) => (
          <TooltipProvider key={source.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label
                  htmlFor={source.id}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-all relative",
                    value === source.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50",
                    source.warning && "border-amber-300"
                  )}
                >
                  <RadioGroupItem 
                    value={source.id} 
                    id={source.id} 
                    className="sr-only" 
                  />
                  {source.warning && (
                    <div className="absolute -top-1 -right-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {source.icon}
                    <span className="text-sm font-medium">{source.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant={value === source.id ? "default" : "secondary"} 
                      className={cn(
                        "text-xs px-1.5 py-0",
                        source.id === "production" && productionNeedsGeoSync && "bg-amber-500/20 text-amber-700"
                      )}
                    >
                      {source.id === "production" ? (
                        <>
                          <MapPin className="h-3 w-3 mr-0.5" />
                          {productionGeoCount > 0 ? productionGeoCount.toLocaleString() : "0"}
                        </>
                      ) : (
                        source.count > 0 ? source.count.toLocaleString() : "—"
                      )}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{source.description}</span>
                </Label>
              </TooltipTrigger>
              {source.warning && (
                <TooltipContent>
                  <p className="max-w-[200px] text-xs">{source.warning}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ))}
      </RadioGroup>
    </div>
  );
}
