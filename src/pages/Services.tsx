import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityTable } from "@/components/entities/EntityTable";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { ServiceFormData, emptyServiceFormData } from "@/components/services/types";
import { ServiceContentFields } from "@/components/services/ServiceContentFields";
import { ServicePricingSection } from "@/components/services/ServicePricingSection";
import { ServiceStepsSection } from "@/components/services/ServiceStepsSection";
import { ServiceAdvancedSection } from "@/components/services/ServiceAdvancedSection";

type Service = Tables<"services">;
type ServiceCategory = Tables<"service_categories">;
type ServiceInsert = TablesInsert<"services">;
type ServiceUpdate = TablesUpdate<"services">;

export default function Services() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(emptyServiceFormData);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_categories(name)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ServiceCategory[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceInsert) => {
      const { error } = await supabase.from("services").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Service created successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error creating service", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ServiceUpdate }) => {
      const { error } = await supabase.from("services").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Service updated successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error updating service", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Service deleted successfully" });
      setIsDeleteDialogOpen(false);
      setDeletingService(null);
    },
    onError: (error) => {
      toast({ title: "Error deleting service", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setFormData(emptyServiceFormData);
  };

  const openCreateDialog = () => {
    setFormData(emptyServiceFormData);
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name || "",
      name_en: service.name_en || "",
      name_sv: service.name_sv || "",
      slug: service.slug || "",
      slug_en: service.slug_en || "",
      slug_sv: service.slug_sv || "",
      description: service.description || "",
      description_en: service.description_en || "",
      description_sv: service.description_sv || "",
      short_description: (service as any).short_description || "",
      short_description_en: (service as any).short_description_en || "",
      short_description_sv: (service as any).short_description_sv || "",
      seo_title: service.seo_title || "",
      seo_title_en: service.seo_title_en || "",
      seo_title_sv: service.seo_title_sv || "",
      seo_meta_description: service.seo_meta_description || "",
      seo_meta_description_en: service.seo_meta_description_en || "",
      seo_meta_description_sv: service.seo_meta_description_sv || "",
      intro: service.intro || "",
      intro_en: service.intro_en || "",
      intro_sv: service.intro_sv || "",
      service_includes: (service as any).service_includes || "",
      service_includes_en: (service as any).service_includes_en || "",
      service_includes_sv: (service as any).service_includes_sv || "",
      price: (service as any).price || "",
      price_from: (service as any).price_from || "",
      price_first_column: (service as any).price_first_column || "",
      price_first_column_en: (service as any).price_first_column_en || "",
      price_first_column_sv: (service as any).price_first_column_sv || "",
      price_second_column: (service as any).price_second_column || "",
      price_second_column_en: (service as any).price_second_column_en || "",
      price_second_column_sv: (service as any).price_second_column_sv || "",
      price_third_column: (service as any).price_third_column || "",
      price_third_column_en: (service as any).price_third_column_en || "",
      price_third_column_sv: (service as any).price_third_column_sv || "",
      step_1_text: (service as any).step_1_text || "",
      step_1_text_en: (service as any).step_1_text_en || "",
      step_1_text_sv: (service as any).step_1_text_sv || "",
      step_1_illustration: (service as any).step_1_illustration || "",
      step_2_text: (service as any).step_2_text || "",
      step_2_text_en: (service as any).step_2_text_en || "",
      step_2_text_sv: (service as any).step_2_text_sv || "",
      step_2_illustration: (service as any).step_2_illustration || "",
      step_3_text: (service as any).step_3_text || "",
      step_3_text_en: (service as any).step_3_text_en || "",
      step_3_text_sv: (service as any).step_3_text_sv || "",
      step_3_illustration: (service as any).step_3_illustration || "",
      icon_url: service.icon_url || "",
      sort_order: service.sort_order || 0,
      active: service.active ?? true,
      season_product: (service as any).season_product ?? false,
      service_type_schema: (service as any).service_type_schema || "",
      service_category_id: service.service_category_id || null,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (service: Service) => {
    setDeletingService(service);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      name_en: formData.name_en || null,
      name_sv: formData.name_sv || null,
      slug: formData.slug,
      slug_en: formData.slug_en || null,
      slug_sv: formData.slug_sv || null,
      description: formData.description || null,
      description_en: formData.description_en || null,
      description_sv: formData.description_sv || null,
      short_description: formData.short_description || null,
      short_description_en: formData.short_description_en || null,
      short_description_sv: formData.short_description_sv || null,
      seo_title: formData.seo_title || null,
      seo_title_en: formData.seo_title_en || null,
      seo_title_sv: formData.seo_title_sv || null,
      seo_meta_description: formData.seo_meta_description || null,
      seo_meta_description_en: formData.seo_meta_description_en || null,
      seo_meta_description_sv: formData.seo_meta_description_sv || null,
      intro: formData.intro || null,
      intro_en: formData.intro_en || null,
      intro_sv: formData.intro_sv || null,
      service_includes: formData.service_includes || null,
      service_includes_en: formData.service_includes_en || null,
      service_includes_sv: formData.service_includes_sv || null,
      price: formData.price || null,
      price_from: formData.price_from || null,
      price_first_column: formData.price_first_column || null,
      price_first_column_en: formData.price_first_column_en || null,
      price_first_column_sv: formData.price_first_column_sv || null,
      price_second_column: formData.price_second_column || null,
      price_second_column_en: formData.price_second_column_en || null,
      price_second_column_sv: formData.price_second_column_sv || null,
      price_third_column: formData.price_third_column || null,
      price_third_column_en: formData.price_third_column_en || null,
      price_third_column_sv: formData.price_third_column_sv || null,
      step_1_text: formData.step_1_text || null,
      step_1_text_en: formData.step_1_text_en || null,
      step_1_text_sv: formData.step_1_text_sv || null,
      step_1_illustration: formData.step_1_illustration || null,
      step_2_text: formData.step_2_text || null,
      step_2_text_en: formData.step_2_text_en || null,
      step_2_text_sv: formData.step_2_text_sv || null,
      step_2_illustration: formData.step_2_illustration || null,
      step_3_text: formData.step_3_text || null,
      step_3_text_en: formData.step_3_text_en || null,
      step_3_text_sv: formData.step_3_text_sv || null,
      step_3_illustration: formData.step_3_illustration || null,
      icon_url: formData.icon_url || null,
      sort_order: formData.sort_order,
      active: formData.active,
      season_product: formData.season_product,
      service_type_schema: formData.service_type_schema || null,
      service_category_id: formData.service_category_id || null,
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: payload as ServiceUpdate });
    } else {
      createMutation.mutate(payload as ServiceInsert);
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { 
      key: "service_categories", 
      label: "Category",
      render: (value: { name: string } | null) => value?.name || "—"
    },
    { key: "sort_order", label: "Order" },
    { 
      key: "active", 
      label: "Active",
      render: (value: boolean) => value ? "Yes" : "No"
    },
    {
      key: "webflow_item_id",
      label: "Synced",
      render: (value: string | null) => (
        <span className={value ? "text-green-600" : "text-muted-foreground"}>
          {value ? "✓" : "—"}
        </span>
      ),
    },
  ];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage services offered by partners</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={services}
        isLoading={isLoading}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Edit Service" : "Create Service"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingService?.shared_key && (
              <div className="space-y-2">
                <Label>Shared Key</Label>
                <Input
                  value={editingService.shared_key}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Read-only identifier used for syncing</p>
              </div>
            )}

            {/* Control Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_category_id">Category</Label>
                <Select
                  value={formData.service_category_id || "none"}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    service_category_id: value === "none" ? null : value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon_url">Icon URL</Label>
                <Input
                  id="icon_url"
                  value={formData.icon_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch
                  id="season_product"
                  checked={formData.season_product}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, season_product: checked }))}
                />
                <Label htmlFor="season_product">Season Product</Label>
              </div>
            </div>

            {/* Localized Content Tabs */}
            <Tabs defaultValue="no" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="no">Norwegian</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="sv">Swedish</TabsTrigger>
              </TabsList>

              <TabsContent value="no" className="space-y-4 mt-4">
                <ServiceContentFields formData={formData} setFormData={setFormData} locale="no" />
                <ServicePricingSection formData={formData} setFormData={setFormData} locale="no" />
                <ServiceStepsSection formData={formData} setFormData={setFormData} locale="no" />
              </TabsContent>

              <TabsContent value="en" className="space-y-4 mt-4">
                <ServiceContentFields formData={formData} setFormData={setFormData} locale="en" />
                <ServicePricingSection formData={formData} setFormData={setFormData} locale="en" />
                <ServiceStepsSection formData={formData} setFormData={setFormData} locale="en" />
              </TabsContent>

              <TabsContent value="sv" className="space-y-4 mt-4">
                <ServiceContentFields formData={formData} setFormData={setFormData} locale="sv" />
                <ServicePricingSection formData={formData} setFormData={setFormData} locale="sv" />
                <ServiceStepsSection formData={formData} setFormData={setFormData} locale="sv" />
              </TabsContent>
            </Tabs>

            {/* Advanced Section (not localized) */}
            <ServiceAdvancedSection formData={formData} setFormData={setFormData} />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingService ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => deletingService && deleteMutation.mutate(deletingService.id)}
        title="Delete Service"
        description={`Are you sure you want to delete "${deletingService?.name}"? This action cannot be undone.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
