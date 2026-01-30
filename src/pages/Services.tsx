import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { slugify } from "@/lib/slugify";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Service = Tables<"services">;
type ServiceCategory = Tables<"service_categories">;
type ServiceInsert = TablesInsert<"services">;
type ServiceUpdate = TablesUpdate<"services">;

interface ServiceFormData {
  name: string;
  name_en: string;
  name_sv: string;
  slug: string;
  slug_en: string;
  slug_sv: string;
  description: string;
  description_en: string;
  description_sv: string;
  seo_title: string;
  seo_title_en: string;
  seo_title_sv: string;
  seo_meta_description: string;
  seo_meta_description_en: string;
  seo_meta_description_sv: string;
  intro: string;
  intro_en: string;
  intro_sv: string;
  icon_url: string;
  sort_order: number;
  active: boolean;
  service_category_id: string | null;
}

const emptyFormData: ServiceFormData = {
  name: "",
  name_en: "",
  name_sv: "",
  slug: "",
  slug_en: "",
  slug_sv: "",
  description: "",
  description_en: "",
  description_sv: "",
  seo_title: "",
  seo_title_en: "",
  seo_title_sv: "",
  seo_meta_description: "",
  seo_meta_description_en: "",
  seo_meta_description_sv: "",
  intro: "",
  intro_en: "",
  intro_sv: "",
  icon_url: "",
  sort_order: 0,
  active: true,
  service_category_id: null,
};

export default function Services() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(emptyFormData);

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
    setFormData(emptyFormData);
  };

  const openCreateDialog = () => {
    setFormData(emptyFormData);
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
      seo_title: service.seo_title || "",
      seo_title_en: service.seo_title_en || "",
      seo_title_sv: service.seo_title_sv || "",
      seo_meta_description: service.seo_meta_description || "",
      seo_meta_description_en: service.seo_meta_description_en || "",
      seo_meta_description_sv: service.seo_meta_description_sv || "",
      intro: service.intro || "",
      intro_en: service.intro_en || "",
      intro_sv: service.intro_sv || "",
      icon_url: service.icon_url || "",
      sort_order: service.sort_order || 0,
      active: service.active ?? true,
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
      seo_title: formData.seo_title || null,
      seo_title_en: formData.seo_title_en || null,
      seo_title_sv: formData.seo_title_sv || null,
      seo_meta_description: formData.seo_meta_description || null,
      seo_meta_description_en: formData.seo_meta_description_en || null,
      seo_meta_description_sv: formData.seo_meta_description_sv || null,
      intro: formData.intro || null,
      intro_en: formData.intro_en || null,
      intro_sv: formData.intro_sv || null,
      icon_url: formData.icon_url || null,
      sort_order: formData.sort_order,
      active: formData.active,
      service_category_id: formData.service_category_id || null,
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleNameChange = (value: string, locale: "no" | "en" | "sv") => {
    if (locale === "no") {
      setFormData(prev => ({
        ...prev,
        name: value,
        slug: slugify(value),
      }));
    } else if (locale === "en") {
      setFormData(prev => ({
        ...prev,
        name_en: value,
        slug_en: slugify(value),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        name_sv: value,
        slug_sv: slugify(value),
      }));
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <Tabs defaultValue="no" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="no">Norwegian</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="sv">Swedish</TabsTrigger>
              </TabsList>

              <TabsContent value="no" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value, "no")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro">Intro</Label>
                  <Textarea
                    id="intro"
                    value={formData.intro}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_title">SEO Title</Label>
                  <Input
                    id="seo_title"
                    value={formData.seo_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_meta_description">SEO Meta Description</Label>
                  <Textarea
                    id="seo_meta_description"
                    value={formData.seo_meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description: e.target.value }))}
                    rows={2}
                  />
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name_en">Name (EN)</Label>
                    <Input
                      id="name_en"
                      value={formData.name_en}
                      onChange={(e) => handleNameChange(e.target.value, "en")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug_en">Slug (EN)</Label>
                    <Input
                      id="slug_en"
                      value={formData.slug_en}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug_en: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description_en">Description (EN)</Label>
                  <Textarea
                    id="description_en"
                    value={formData.description_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, description_en: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro_en">Intro (EN)</Label>
                  <Textarea
                    id="intro_en"
                    value={formData.intro_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro_en: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_title_en">SEO Title (EN)</Label>
                  <Input
                    id="seo_title_en"
                    value={formData.seo_title_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_title_en: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_meta_description_en">SEO Meta Description (EN)</Label>
                  <Textarea
                    id="seo_meta_description_en"
                    value={formData.seo_meta_description_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description_en: e.target.value }))}
                    rows={2}
                  />
                </div>
              </TabsContent>

              <TabsContent value="sv" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name_sv">Name (SV)</Label>
                    <Input
                      id="name_sv"
                      value={formData.name_sv}
                      onChange={(e) => handleNameChange(e.target.value, "sv")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug_sv">Slug (SV)</Label>
                    <Input
                      id="slug_sv"
                      value={formData.slug_sv}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug_sv: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description_sv">Description (SV)</Label>
                  <Textarea
                    id="description_sv"
                    value={formData.description_sv}
                    onChange={(e) => setFormData(prev => ({ ...prev, description_sv: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro_sv">Intro (SV)</Label>
                  <Textarea
                    id="intro_sv"
                    value={formData.intro_sv}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro_sv: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_title_sv">SEO Title (SV)</Label>
                  <Input
                    id="seo_title_sv"
                    value={formData.seo_title_sv}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_title_sv: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_meta_description_sv">SEO Meta Description (SV)</Label>
                  <Textarea
                    id="seo_meta_description_sv"
                    value={formData.seo_meta_description_sv}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description_sv: e.target.value }))}
                    rows={2}
                  />
                </div>
              </TabsContent>
            </Tabs>

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
