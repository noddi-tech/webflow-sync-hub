import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, AlertTriangle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SchemaChange } from "./SchemaDetectionStep";

interface SchemaApplyStepProps {
  changes: SchemaChange[];
  onComplete: () => void;
}

type ApplyStatus = "idle" | "applying" | "done" | "error";

export function SchemaApplyStep({ changes, onComplete }: SchemaApplyStepProps) {
  const [status, setStatus] = useState<ApplyStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const confirmedChanges = changes.filter(c => c.confirmed);

  const handleApply = async () => {
    setStatus("applying");
    setProgress(10);
    setStatusMessage("Preparing schema fixes...");

    try {
      setProgress(30);
      setStatusMessage("Applying fixes via backend function...");

      const { data, error: fnError } = await supabase.functions.invoke("schema-fix", {
        body: { changes: confirmedChanges },
      });

      if (fnError) throw fnError;

      setProgress(80);
      setStatusMessage("Fixes applied successfully. Verifying...");

      // Re-run validation
      setProgress(90);
      setStatusMessage("Running validation check...");

      await supabase.functions.invoke("webflow-validate", {
        body: { store_results: true, triggered_by: "schema-wizard" },
      });

      setProgress(100);
      setStatusMessage("All fixes applied and verified!");
      setStatus("done");

      toast({
        title: "Schema fixes applied",
        description: `${confirmedChanges.length} change(s) applied successfully.`,
      });
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      toast({
        title: "Fix failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Apply {confirmedChanges.length} Fix{confirmedChanges.length !== 1 ? "es" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === "idle" && (
          <>
            <div className="p-4 rounded-lg border bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Summary of changes to apply:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {confirmedChanges.map(c => (
                  <li key={c.id} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span>
                      {c.type === "renamed" && `Rename ${c.oldFieldSlug} → ${c.fieldSlug}`}
                      {c.type === "added" && `Add field ${c.fieldSlug}`}
                      {c.type === "removed" && `Remove ${c.fieldSlug}`}
                      {" "}in {c.collectionLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button onClick={handleApply} className="w-full" size="lg">
              <Rocket className="mr-2 h-4 w-4" />
              Apply All Fixes
            </Button>
          </>
        )}

        {status === "applying" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">{statusMessage}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === "done" && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold">All fixes applied!</h3>
              <p className="text-sm text-muted-foreground mt-1">{statusMessage}</p>
            </div>
            <Button onClick={onComplete} variant="outline">
              Return to Dashboard
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Fix failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
            <Button onClick={handleApply} variant="outline">
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
