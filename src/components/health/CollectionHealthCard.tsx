import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Settings, ChevronDown, ChevronUp, Info, Copy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface CollectionHealthCardProps {
  name: string;
  collection: {
    webflow_collection_name: string | null;
    collection_id: string | null;
    status: "ok" | "missing_fields" | "not_configured" | "error";
    expected_fields: string[];
    found_fields: string[];
    missing_in_webflow: string[];
    missing_required: string[];
    extra_in_webflow: string[];
    error_message?: string;
  };
}

const COLLECTION_LABELS: Record<string, string> = {
  cities: "Cities",
  districts: "Districts",
  areas: "Areas",
  service_categories: "Service Categories",
  services: "Services",
  partners: "Partners",
  service_locations: "Service Locations",
};

export function CollectionHealthCard({ name, collection }: CollectionHealthCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const getStatusIcon = () => {
    switch (collection.status) {
      case "ok":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "missing_fields":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "not_configured":
        return <Settings className="h-4 w-4 text-muted-foreground" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = () => {
    switch (collection.status) {
      case "ok":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Ready</Badge>;
      case "missing_fields":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Missing Fields</Badge>;
      case "not_configured":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Not Configured</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const copyFieldSlug = (slug: string) => {
    navigator.clipboard.writeText(slug);
    toast({
      title: "Copied!",
      description: `Field slug "${slug}" copied to clipboard`,
    });
  };

  const hasDetails = collection.missing_in_webflow.length > 0 || 
                     collection.extra_in_webflow.length > 0 || 
                     collection.error_message;

  return (
    <div className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-sm">{COLLECTION_LABELS[name] || name}</p>
              <p className="text-xs text-muted-foreground">
                {collection.found_fields.length} fields mapped
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {getStatusBadge()}
            {hasDetails && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {collection.error_message && (
            <div className="text-xs p-2 bg-destructive/10 text-destructive rounded">
              {collection.error_message}
            </div>
          )}

          {collection.missing_required.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Missing Required Fields
              </p>
              <div className="flex flex-wrap gap-1">
                {collection.missing_required.map((field) => (
                  <Badge key={field} variant="destructive" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {collection.missing_in_webflow.filter(f => !collection.missing_required.includes(f)).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Optional Fields Missing in Webflow
              </p>
              <div className="flex flex-wrap gap-1">
                {collection.missing_in_webflow
                  .filter(f => !collection.missing_required.includes(f))
                  .map((field) => (
                    <Badge key={field} variant="outline" className="text-xs bg-yellow-500/10">
                      {field}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {collection.extra_in_webflow.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Extra Webflow Fields
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        These fields exist in Webflow but are not yet mapped. 
                        They may need to be added to the field definitions for full sync support. Click to copy the slug.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-1">
                {collection.extra_in_webflow.map((field) => (
                  <TooltipProvider key={field}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => copyFieldSlug(field)}
                        >
                          {field}
                          <Copy className="h-2 w-2 ml-1" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Click to copy slug</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
