import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightLeft, Plus, Minus, AlertTriangle } from "lucide-react";

export interface SchemaChange {
  id: string;
  type: "renamed" | "added" | "removed";
  collection: string;
  collectionLabel: string;
  fieldSlug: string;
  fieldType: string;
  oldFieldSlug?: string; // For renames
  description: string;
  confirmed: boolean;
}

interface SchemaDetectionStepProps {
  changes: SchemaChange[];
  onNext: () => void;
}

const CHANGE_ICONS = {
  renamed: ArrowRightLeft,
  added: Plus,
  removed: Minus,
};

const CHANGE_COLORS = {
  renamed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  added: "bg-green-500/10 text-green-600 border-green-500/20",
  removed: "bg-destructive/10 text-destructive border-destructive/20",
};

const CHANGE_LABELS = {
  renamed: "Renamed",
  added: "New Field",
  removed: "Removed",
};

export function SchemaDetectionStep({ changes, onNext }: SchemaDetectionStepProps) {
  const grouped = {
    renamed: changes.filter(c => c.type === "renamed"),
    added: changes.filter(c => c.type === "added"),
    removed: changes.filter(c => c.type === "removed"),
  };

  const totalChanges = changes.length;

  if (totalChanges === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
            <AlertTriangle className="h-6 w-6 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Schema Changes Detected</h3>
          <p className="text-muted-foreground">
            All Webflow collections are fully aligned with the app's expected schema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {totalChanges} change{totalChanges !== 1 ? "s" : ""} detected in Webflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {grouped.renamed.length > 0 && (
              <Badge variant="outline" className={CHANGE_COLORS.renamed}>
                <ArrowRightLeft className="h-3 w-3 mr-1" />
                {grouped.renamed.length} renamed
              </Badge>
            )}
            {grouped.added.length > 0 && (
              <Badge variant="outline" className={CHANGE_COLORS.added}>
                <Plus className="h-3 w-3 mr-1" />
                {grouped.added.length} new
              </Badge>
            )}
            {grouped.removed.length > 0 && (
              <Badge variant="outline" className={CHANGE_COLORS.removed}>
                <Minus className="h-3 w-3 mr-1" />
                {grouped.removed.length} removed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {(Object.entries(grouped) as [keyof typeof grouped, SchemaChange[]][]).map(([type, items]) => {
        if (items.length === 0) return null;
        const Icon = CHANGE_ICONS[type];
        
        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {CHANGE_LABELS[type]} Fields ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map(change => (
                  <div
                    key={change.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={CHANGE_COLORS[type]}>
                        {type === "renamed" && change.oldFieldSlug
                          ? `${change.oldFieldSlug} → ${change.fieldSlug}`
                          : change.fieldSlug}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        in <span className="font-medium text-foreground">{change.collectionLabel}</span>
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {change.fieldType}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
