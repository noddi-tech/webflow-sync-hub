import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Settings, ChevronDown, ChevronUp, Info, Copy, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface MissingFieldInfo {
  slug: string;
  type: string;
  required: boolean;
  description?: string;
}

interface FoundFieldInfo {
  slug: string;
  type: string;
  displayName: string;
  helpText: string;
  description: string;
}

interface CollectionHealthCardProps {
  name: string;
  collection: {
    webflow_collection_name: string | null;
    collection_id: string | null;
    status: "ok" | "missing_fields" | "not_configured" | "error";
    expected_fields: string[];
    found_fields: string[];
    found_fields_detailed?: FoundFieldInfo[];
    missing_in_webflow: string[];
    missing_in_webflow_typed?: MissingFieldInfo[];
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

// Map our internal types to Webflow UI names
const WEBFLOW_TYPE_LABELS: Record<string, string> = {
  PlainText: "Plain Text",
  RichText: "Rich Text",
  Number: "Number",
  Switch: "Switch",
  ItemRef: "Reference",
  ItemRefSet: "Multi-Reference",
};

// Group fields by type for easier batch creation
function groupFieldsByType(fields: MissingFieldInfo[]): Record<string, MissingFieldInfo[]> {
  return fields.reduce((acc, field) => {
    const type = field.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(field);
    return acc;
  }, {} as Record<string, MissingFieldInfo[]>);
}

export function CollectionHealthCard({ name, collection }: CollectionHealthCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
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

  const copyAllFieldSpecs = () => {
    const typedFields = collection.missing_in_webflow_typed || [];
    const groupedFields = groupFieldsByType(typedFields);
    
    let text = `Collection: ${COLLECTION_LABELS[name] || name}\nMissing Fields to Create in Webflow CMS Designer:\n\n`;
    
    for (const [type, fields] of Object.entries(groupedFields)) {
      const webflowType = WEBFLOW_TYPE_LABELS[type] || type;
      text += `${webflowType} Fields:\n`;
      for (const field of fields) {
        const requiredLabel = field.required ? " (REQUIRED)" : "";
        const desc = field.description ? ` - ${field.description}` : "";
        text += `- ${field.slug}${requiredLabel}${desc}\n`;
      }
      text += "\n";
    }
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "All missing field specs copied to clipboard",
    });
  };

  const getFieldDescription = (slug: string): string => {
    // First check found_fields_detailed
    const foundField = collection.found_fields_detailed?.find(f => f.slug === slug);
    if (foundField?.description) return foundField.description;
    if (foundField?.helpText) return foundField.helpText;
    
    // Then check missing_in_webflow_typed
    const missingField = collection.missing_in_webflow_typed?.find(f => f.slug === slug);
    if (missingField?.description) return missingField.description;
    
    return "";
  };

  const getFieldType = (slug: string): string => {
    const foundField = collection.found_fields_detailed?.find(f => f.slug === slug);
    if (foundField) return foundField.type;
    
    const missingField = collection.missing_in_webflow_typed?.find(f => f.slug === slug);
    if (missingField) return missingField.type;
    
    return "";
  };
  const hasDetails = collection.missing_in_webflow.length > 0 || 
                     collection.extra_in_webflow.length > 0 || 
                     collection.error_message;

  const typedMissingFields = collection.missing_in_webflow_typed || [];
  const groupedMissingFields = groupFieldsByType(typedMissingFields);

  const foundFieldsDetailed = collection.found_fields_detailed || [];

  return (
    <div className="border rounded-lg p-3 bg-card hover:border-primary/30 transition-colors">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-sm">{COLLECTION_LABELS[name] || name}</p>
              <button 
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                  setShowAllFields(!showAllFields);
                }}
              >
                {collection.found_fields.length} fields mapped {showAllFields ? "▲" : "▼"}
              </button>
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

          {/* Show All Mapped Fields */}
          {showAllFields && foundFieldsDetailed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Mapped Fields ({foundFieldsDetailed.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {foundFieldsDetailed.map((field) => {
                  const webflowType = WEBFLOW_TYPE_LABELS[field.type] || field.type;
                  const description = field.description || field.helpText;
                  
                  return (
                    <TooltipProvider key={field.slug}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-help bg-green-500/10 border-green-500/20"
                          >
                            {field.slug}
                            <Info className="h-2 w-2 ml-1 opacity-50" />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-medium">{field.displayName || field.slug}</p>
                          <p className="text-xs text-muted-foreground">Type: {webflowType}</p>
                          {description && (
                            <p className="text-xs mt-1">{description}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}

          {collection.missing_required.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Missing Required Fields
              </p>
              <div className="flex flex-wrap gap-1">
                {collection.missing_required.map((field) => {
                  const fieldInfo = typedMissingFields.find(f => f.slug === field);
                  const description = fieldInfo?.description || "";
                  return (
                    <TooltipProvider key={field}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="text-xs cursor-help">
                            {field} {fieldInfo && `(${WEBFLOW_TYPE_LABELS[fieldInfo.type] || fieldInfo.type})`}
                            <Info className="h-2 w-2 ml-1 opacity-50" />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-medium">{field}</p>
                          {description && (
                            <p className="text-xs mt-1">{description}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}

          {/* Missing Fields with Creation Guide */}
          {Object.keys(groupedMissingFields).length > 0 && (
            <div className="space-y-3">
              {/* Info Banner */}
              <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
                <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">
                    Create these fields in Webflow CMS Designer
                  </p>
                  <p className="text-muted-foreground">
                    Open your Webflow project → CMS Collections → {collection.webflow_collection_name || COLLECTION_LABELS[name]} → Add the missing fields below.
                  </p>
                </div>
              </div>

              {/* Fields grouped by type */}
              {Object.entries(groupedMissingFields).map(([type, fields]) => {
                const webflowType = WEBFLOW_TYPE_LABELS[type] || type;
                const isReference = type === "ItemRef" || type === "ItemRefSet";
                
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        {webflowType} Fields
                        {isReference && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  {type === "ItemRef" 
                                    ? "Single reference to another collection item"
                                    : "Multiple references to other collection items"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fields.map((field) => (
                        <TooltipProvider key={field.slug}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={field.required ? "destructive" : "outline"} 
                                className={`text-xs cursor-pointer hover:bg-accent ${!field.required ? 'bg-yellow-500/10' : ''}`}
                                onClick={() => copyFieldSlug(field.slug)}
                              >
                                {field.slug}
                                {field.required && " *"}
                                <Copy className="h-2 w-2 ml-1" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Click to copy slug. Create as "{webflowType}" in Webflow.
                                {field.required && " (Required field)"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Copy All Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={copyAllFieldSpecs}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy All Missing Field Specs
              </Button>
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
                        These fields exist in Webflow but are not yet mapped to your database. 
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
