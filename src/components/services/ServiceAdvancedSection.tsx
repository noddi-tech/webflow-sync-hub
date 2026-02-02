import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { useState } from "react";
import type { ServiceFormData } from "./types";

interface ServiceAdvancedSectionProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
}

export function ServiceAdvancedSection({ formData, setFormData }: ServiceAdvancedSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Advanced / Schema.org</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="service_type_schema">Service Type (Schema.org)</Label>
          <Input
            id="service_type_schema"
            value={formData.service_type_schema}
            onChange={(e) => setFormData(prev => ({ ...prev, service_type_schema: e.target.value }))}
            placeholder="e.g., AutoRepair, CarWash"
          />
          <p className="text-xs text-muted-foreground">
            Schema.org service type for structured data. See <a href="https://schema.org/Service" target="_blank" rel="noreferrer" className="underline">schema.org/Service</a>
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
