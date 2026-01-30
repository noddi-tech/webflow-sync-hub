import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, XCircle, AlertCircle, Settings2 } from "lucide-react";

interface CollectionResult {
  webflow_collection_name: string | null;
  collection_id: string | null;
  status: "ok" | "missing_fields" | "not_configured" | "error";
  expected_fields: string[];
  found_fields: string[];
  missing_in_webflow: string[];
  missing_required: string[];
  extra_in_webflow: string[];
  error_message?: string;
}

interface ValidationResults {
  collections: Record<string, CollectionResult>;
  summary: {
    total: number;
    ok: number;
    missing_fields: number;
    not_configured: number;
    errors: number;
  };
}

interface ValidationResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ValidationResults | null;
}

const COLLECTION_DISPLAY_NAMES: Record<string, string> = {
  cities: "Cities",
  districts: "Districts",
  areas: "Areas",
  service_categories: "Service Categories",
  services: "Services",
  partners: "Partners",
  service_locations: "Service Locations",
};

function getStatusIcon(status: CollectionResult["status"]) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "missing_fields":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case "not_configured":
      return <Settings2 className="h-5 w-5 text-muted-foreground" />;
    case "error":
      return <XCircle className="h-5 w-5 text-destructive" />;
  }
}

function getStatusBadge(status: CollectionResult["status"]) {
  switch (status) {
    case "ok":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ready</Badge>;
    case "missing_fields":
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Missing Fields</Badge>;
    case "not_configured":
      return <Badge variant="secondary">Not Configured</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
  }
}

export function ValidationResultsDialog({
  open,
  onOpenChange,
  results,
}: ValidationResultsDialogProps) {
  if (!results) return null;

  const { collections, summary } = results;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Webflow Collection Validation</DialogTitle>
          <DialogDescription>
            Comparing your configured collections against expected field mappings
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 py-4">
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{summary.ok}</div>
            <div className="text-xs text-muted-foreground">Ready</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-600">{summary.missing_fields}</div>
            <div className="text-xs text-muted-foreground">Missing Fields</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-2xl font-bold text-muted-foreground">{summary.not_configured}</div>
            <div className="text-xs text-muted-foreground">Not Configured</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold text-destructive">{summary.errors}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <Accordion type="multiple" className="w-full">
            {Object.entries(collections).map(([key, result]) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">
                      {COLLECTION_DISPLAY_NAMES[key] || key}
                    </span>
                    {result.webflow_collection_name && (
                      <span className="text-sm text-muted-foreground">
                        ({result.webflow_collection_name})
                      </span>
                    )}
                    <div className="ml-auto mr-4">
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-8 space-y-3">
                    {result.status === "not_configured" && (
                      <p className="text-sm text-muted-foreground">
                        Configure the Collection ID in Settings to validate this collection.
                      </p>
                    )}

                    {result.status === "error" && (
                      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                        {result.error_message}
                      </div>
                    )}

                    {result.missing_required.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-destructive mb-1">
                          Missing Required Fields:
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {result.missing_required.map((field) => (
                            <Badge key={field} variant="destructive" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.missing_in_webflow.length > 0 &&
                      result.missing_in_webflow.filter(
                        (f) => !result.missing_required.includes(f)
                      ).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-yellow-600 mb-1">
                            Missing Optional Fields:
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {result.missing_in_webflow
                              .filter((f) => !result.missing_required.includes(f))
                              .map((field) => (
                                <Badge
                                  key={field}
                                  variant="outline"
                                  className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                >
                                  {field}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}

                    {result.extra_in_webflow.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">
                          Extra Fields in Webflow (not mapped):
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {result.extra_in_webflow.map((field) => (
                            <Badge key={field} variant="secondary" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.status === "ok" && (
                      <p className="text-sm text-green-600">
                        ✓ All expected fields are present in Webflow
                      </p>
                    )}

                    {result.found_fields.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          Show all {result.found_fields.length} fields found
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.found_fields.map((field) => (
                            <Badge key={field} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
