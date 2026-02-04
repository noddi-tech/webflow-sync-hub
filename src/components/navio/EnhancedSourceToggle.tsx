import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Database, Layers, CloudDownload } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapSource = "staging" | "production" | "snapshot";

interface EnhancedSourceToggleProps {
  value: MapSource;
  onChange: (value: MapSource) => void;
  stagingCount?: number;
  productionCount?: number;
  snapshotCount?: number;
  className?: string;
}

export function EnhancedSourceToggle({
  value,
  onChange,
  stagingCount = 0,
  productionCount = 0,
  snapshotCount = 0,
  className,
}: EnhancedSourceToggleProps) {
  const sources: Array<{
    id: MapSource;
    label: string;
    icon: React.ReactNode;
    count: number;
    description: string;
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
      description: "Live data",
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
      </div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as MapSource)}
        className="grid grid-cols-3 gap-2"
      >
        {sources.map((source) => (
          <Label
            key={source.id}
            htmlFor={source.id}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-all",
              value === source.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
            )}
          >
            <RadioGroupItem 
              value={source.id} 
              id={source.id} 
              className="sr-only" 
            />
            <div className="flex items-center gap-1.5">
              {source.icon}
              <span className="text-sm font-medium">{source.label}</span>
            </div>
            <Badge 
              variant={value === source.id ? "default" : "secondary"} 
              className="text-xs px-1.5 py-0"
            >
              {source.count > 0 ? source.count.toLocaleString() : "—"}
            </Badge>
            <span className="text-xs text-muted-foreground">{source.description}</span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
