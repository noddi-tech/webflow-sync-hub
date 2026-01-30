import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { ValidationResultsDialog } from "@/components/settings/ValidationResultsDialog";

const SETTING_KEYS = [
  { key: "webflow_cities_collection_id", label: "Cities Collection ID", group: "collections" },
  { key: "webflow_districts_collection_id", label: "Districts Collection ID", group: "collections" },
  { key: "webflow_areas_collection_id", label: "Areas Collection ID", group: "collections" },
  { key: "webflow_service_categories_collection_id", label: "Service Categories Collection ID", group: "collections" },
  { key: "webflow_services_collection_id", label: "Services (Tjenester) Collection ID", group: "collections" },
  { key: "webflow_partners_collection_id", label: "Partners Collection ID", group: "collections" },
  { key: "webflow_service_locations_collection_id", label: "Service Locations Collection ID", group: "collections" },
  { key: "base_url", label: "Base URL", group: "general", placeholder: "https://www.noddi.no" },
];

interface ValidationResults {
  collections: Record<string, {
    webflow_collection_name: string | null;
    collection_id: string | null;
    status: "ok" | "missing_fields" | "not_configured" | "error";
    expected_fields: string[];
    found_fields: string[];
    missing_in_webflow: string[];
    missing_required: string[];
    extra_in_webflow: string[];
    error_message?: string;
  }>;
  summary: {
    total: number;
    ok: number;
    missing_fields: number;
    not_configured: number;
    errors: number;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value");
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach((s) => {
        settingsMap[s.key] = s.value ?? "";
      });
      return settingsMap;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      for (const [key, value] of Object.entries(values)) {
        const { error } = await supabase
          .from("settings")
          .upsert({ key, value }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Settings saved",
        description: "Your Webflow configuration has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("webflow-validate");
      if (error) throw error;
      return data as ValidationResults;
    },
    onSuccess: (data) => {
      setValidationResults(data);
      setValidationDialogOpen(true);
      
      const { summary } = data;
      if (summary.ok === summary.total) {
        toast({
          title: "All collections validated!",
          description: "All field mappings match your Webflow collections.",
        });
      } else if (summary.missing_fields > 0 || summary.errors > 0) {
        toast({
          title: "Validation complete",
          description: `${summary.ok} ready, ${summary.missing_fields} missing fields, ${summary.not_configured} not configured`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Validation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valuesToSave: Record<string, string> = {};
    SETTING_KEYS.forEach(({ key }) => {
      valuesToSave[key] = formValues[key] ?? settings?.[key] ?? "";
    });
    saveMutation.mutate(valuesToSave);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Webflow integration</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure general settings for the sync system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {SETTING_KEYS.filter(s => s.group === "general").map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
                    value={formValues[key] ?? settings?.[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webflow Collection IDs</CardTitle>
            <CardDescription>
              Enter the Collection IDs from your Webflow CMS. You can find these in Webflow's CMS settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {SETTING_KEYS.filter(s => s.group === "collections").map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    placeholder={placeholder || "Enter collection ID..."}
                    value={formValues[key] ?? settings?.[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Validate Collections
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <ValidationResultsDialog
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        results={validationResults}
      />
    </div>
  );
}
