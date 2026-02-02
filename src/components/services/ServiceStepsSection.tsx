import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, ListOrdered } from "lucide-react";
import { useState } from "react";
import type { ServiceFormData } from "./types";

interface ServiceStepsSectionProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  locale: "no" | "en" | "sv";
}

export function ServiceStepsSection({ formData, setFormData, locale }: ServiceStepsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Field suffix for localized text fields (illustrations are not localized)
  const suffix = locale === "no" ? "" : `_${locale}`;
  
  const getTextField = (base: string): string => {
    const key = base + suffix;
    return (formData as any)[key] || "";
  };
  
  const setTextField = (base: string, value: string) => {
    const key = base + suffix;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">How It Works (Steps)</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0 space-y-4">
        {/* Step 1 */}
        <div className="space-y-2 p-3 border rounded bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">Step 1</p>
          <div className="space-y-2">
            <Label>Text</Label>
            <Textarea
              value={getTextField("step_1_text")}
              onChange={(e) => setTextField("step_1_text", e.target.value)}
              rows={2}
              placeholder="What happens in step 1..."
            />
          </div>
          {/* Illustration URL only on Norwegian tab */}
          {locale === "no" && (
            <div className="space-y-2">
              <Label>Illustration URL</Label>
              <Input
                value={formData.step_1_illustration}
                onChange={(e) => setFormData(prev => ({ ...prev, step_1_illustration: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="space-y-2 p-3 border rounded bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">Step 2</p>
          <div className="space-y-2">
            <Label>Text</Label>
            <Textarea
              value={getTextField("step_2_text")}
              onChange={(e) => setTextField("step_2_text", e.target.value)}
              rows={2}
              placeholder="What happens in step 2..."
            />
          </div>
          {locale === "no" && (
            <div className="space-y-2">
              <Label>Illustration URL</Label>
              <Input
                value={formData.step_2_illustration}
                onChange={(e) => setFormData(prev => ({ ...prev, step_2_illustration: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-2 p-3 border rounded bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">Step 3</p>
          <div className="space-y-2">
            <Label>Text</Label>
            <Textarea
              value={getTextField("step_3_text")}
              onChange={(e) => setTextField("step_3_text", e.target.value)}
              rows={2}
              placeholder="What happens in step 3..."
            />
          </div>
          {locale === "no" && (
            <div className="space-y-2">
              <Label>Illustration URL</Label>
              <Input
                value={formData.step_3_illustration}
                onChange={(e) => setFormData(prev => ({ ...prev, step_3_illustration: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
