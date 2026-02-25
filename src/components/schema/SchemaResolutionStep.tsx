import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Plus, Minus, Info } from "lucide-react";
import type { SchemaChange } from "./SchemaDetectionStep";

interface SchemaResolutionStepProps {
  changes: SchemaChange[];
  onToggleChange: (id: string) => void;
}

const RESOLUTION_TEXT: Record<string, (change: SchemaChange) => { title: string; description: string; action: string }> = {
  renamed: (change) => ({
    title: `Field renamed: ${change.oldFieldSlug} → ${change.fieldSlug}`,
    description: `The field "${change.oldFieldSlug}" was removed from ${change.collectionLabel} and "${change.fieldSlug}" was added. This looks like a rename.`,
    action: `The system will update all internal references from "${change.oldFieldSlug}" to "${change.fieldSlug}" in the validation, import, and sync configurations.`,
  }),
  added: (change) => ({
    title: `New field: ${change.fieldSlug}`,
    description: `A new field "${change.fieldSlug}" (${change.fieldType}) was added to ${change.collectionLabel} in Webflow.`,
    action: `The system will add database columns (${change.fieldSlug}, ${change.fieldSlug}_en, ${change.fieldSlug}_sv) and update import/sync mappings to handle this field.`,
  }),
  removed: (change) => ({
    title: `Field removed: ${change.fieldSlug}`,
    description: `The field "${change.fieldSlug}" no longer exists in Webflow's ${change.collectionLabel} collection.`,
    action: `The system will remove it from the expected fields list. Existing database data will be preserved.`,
  }),
};

const TYPE_ICONS = {
  renamed: ArrowRightLeft,
  added: Plus,
  removed: Minus,
};

const TYPE_COLORS = {
  renamed: "border-blue-500/30 bg-blue-500/5",
  added: "border-green-500/30 bg-green-500/5",
  removed: "border-destructive/30 bg-destructive/5",
};

export function SchemaResolutionStep({ changes, onToggleChange }: SchemaResolutionStepProps) {
  const confirmedCount = changes.filter(c => c.confirmed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Review each change and confirm
        </h3>
        <Badge variant="outline">
          {confirmedCount} / {changes.length} confirmed
        </Badge>
      </div>

      {changes.map(change => {
        const resolver = RESOLUTION_TEXT[change.type];
        const resolution = resolver ? resolver(change) : { title: change.fieldSlug, description: "", action: "" };
        const Icon = TYPE_ICONS[change.type];
        const colorClass = TYPE_COLORS[change.type];

        return (
          <Card key={change.id} className={`transition-all ${colorClass} ${change.confirmed ? "ring-2 ring-primary/30" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={change.confirmed}
                  onCheckedChange={() => onToggleChange(change.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    {resolution.title}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {change.collectionLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pl-10 pt-0">
              <p className="text-sm text-muted-foreground mb-2">
                {resolution.description}
              </p>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-background/80 border text-xs">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{resolution.action}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
