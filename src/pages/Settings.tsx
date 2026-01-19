import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const SETTING_KEYS = [
  { key: "webflow_cities_collection_id", label: "Cities Collection ID" },
  { key: "webflow_districts_collection_id", label: "Districts Collection ID" },
  { key: "webflow_areas_collection_id", label: "Areas Collection ID" },
  { key: "webflow_partners_collection_id", label: "Partners Collection ID" },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});

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

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Webflow Collection IDs</CardTitle>
          <CardDescription>
            Enter the Collection IDs from your Webflow CMS. You can find these in Webflow's CMS settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {SETTING_KEYS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  placeholder="Enter collection ID..."
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
    </div>
  );
}
