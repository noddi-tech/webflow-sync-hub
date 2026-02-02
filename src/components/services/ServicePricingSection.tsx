import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { useState } from "react";
import type { ServiceFormData } from "./types";

interface ServicePricingSectionProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  locale: "no" | "en" | "sv";
}

export function ServicePricingSection({ formData, setFormData, locale }: ServicePricingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Field suffix for localized fields
  const suffix = locale === "no" ? "" : `_${locale}`;
  
  const getField = (base: string): string => {
    const key = base + suffix;
    return (formData as any)[key] || "";
  };
  
  const setField = (base: string, value: string) => {
    const key = base + suffix;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Pricing</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0 space-y-4">
        {/* Only show base price fields on Norwegian tab */}
        {locale === "no" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="e.g., 499 kr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_from">Price From</Label>
              <Input
                id="price_from"
                value={formData.price_from}
                onChange={(e) => setFormData(prev => ({ ...prev, price_from: e.target.value }))}
                placeholder="e.g., Fra 299 kr"
              />
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>First Column Description</Label>
            <Textarea
              value={getField("price_first_column")}
              onChange={(e) => setField("price_first_column", e.target.value)}
              rows={2}
              placeholder="Pricing tier 1 description..."
            />
          </div>
          <div className="space-y-2">
            <Label>Second Column Description</Label>
            <Textarea
              value={getField("price_second_column")}
              onChange={(e) => setField("price_second_column", e.target.value)}
              rows={2}
              placeholder="Pricing tier 2 description..."
            />
          </div>
          <div className="space-y-2">
            <Label>Third Column Description</Label>
            <Textarea
              value={getField("price_third_column")}
              onChange={(e) => setField("price_third_column", e.target.value)}
              rows={2}
              placeholder="Pricing tier 3 description..."
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
