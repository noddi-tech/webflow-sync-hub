import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Check, X } from "lucide-react";
import { EntityTable } from "@/components/entities/EntityTable";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import { slugify } from "@/lib/slugify";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type City = Tables<"cities">;
type CityInsert = TablesInsert<"cities">;
type CityUpdate = TablesUpdate<"cities">;

interface CityFormData {
  name: string;
  name_en: string;
  name_sv: string;
  slug: string;
  slug_en: string;
  slug_sv: string;
  short_description: string;
  intro: string;
  intro_en: string;
  intro_sv: string;
  seo_title: string;
  seo_title_en: string;
  seo_title_sv: string;
  seo_meta_description: string;
  seo_meta_description_en: string;
  seo_meta_description_sv: string;
  sitemap_priority: number;
  is_delivery: boolean;
  noindex: boolean;
}

const emptyFormData: CityFormData = {
  name: "",
  name_en: "",
  name_sv: "",
  slug: "",
  slug_en: "",
  slug_sv: "",
  short_description: "",
  intro: "",
  intro_en: "",
  intro_sv: "",
  seo_title: "",
  seo_title_en: "",
  seo_title_sv: "",
  seo_meta_description: "",
  seo_meta_description_en: "",
  seo_meta_description_sv: "",
  sitemap_priority: 0.7,
  is_delivery: false,
  noindex: false,
};

export default function Cities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [deletingCity, setDeletingCity] = useState<City | null>(null);
  const [formData, setFormData] = useState<CityFormData>(emptyFormData);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CityInsert) => {
      const { error } = await supabase.from("cities").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "City created successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error creating city", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CityUpdate }) => {
      const { error } = await supabase.from("cities").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      toast({ title: "City updated successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error updating city", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "City deleted successfully" });
      setIsDeleteDialogOpen(false);
      setDeletingCity(null);
    },
    onError: (error) => {
      toast({ title: "Error deleting city", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCity(null);
    setFormData(emptyFormData);
  };

  const openCreateDialog = () => {
    setFormData(emptyFormData);
    setEditingCity(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (city: City) => {
    setEditingCity(city);
    setFormData({
      name: city.name || "",
      name_en: city.name_en || "",
      name_sv: city.name_sv || "",
      slug: city.slug || "",
      slug_en: city.slug_en || "",
      slug_sv: city.slug_sv || "",
      short_description: city.short_description || "",
      intro: city.intro || "",
      intro_en: city.intro_en || "",
      intro_sv: city.intro_sv || "",
      seo_title: city.seo_title || "",
      seo_title_en: city.seo_title_en || "",
      seo_title_sv: city.seo_title_sv || "",
      seo_meta_description: city.seo_meta_description || "",
      seo_meta_description_en: city.seo_meta_description_en || "",
      seo_meta_description_sv: city.seo_meta_description_sv || "",
      sitemap_priority: city.sitemap_priority ?? 0.7,
      is_delivery: city.is_delivery ?? false,
      noindex: (city as any).noindex ?? false,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (city: City) => {
    setDeletingCity(city);
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
      short_description: formData.short_description || null,
      intro: formData.intro || null,
      intro_en: formData.intro_en || null,
      intro_sv: formData.intro_sv || null,
      seo_title: formData.seo_title || null,
      seo_title_en: formData.seo_title_en || null,
      seo_title_sv: formData.seo_title_sv || null,
      seo_meta_description: formData.seo_meta_description || null,
      seo_meta_description_en: formData.seo_meta_description_en || null,
      seo_meta_description_sv: formData.seo_meta_description_sv || null,
      sitemap_priority: formData.sitemap_priority,
      is_delivery: formData.is_delivery,
      noindex: formData.noindex,
    };

    if (editingCity) {
      updateMutation.mutate({ id: editingCity.id, data: payload });
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
      key: "is_delivery",
      label: "Delivery",
      render: (value: boolean) => value ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />,
    },
    {
      key: "webflow_item_id",
      label: "Synced",
      render: (value: string | null) => value ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cities</h1>
          <p className="text-muted-foreground">Manage city records</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add City
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={cities}
        isLoading={isLoading}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCity ? "Edit City" : "Create City"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingCity?.shared_key && (
              <div className="space-y-2">
                <Label>Shared Key</Label>
                <Input value={editingCity.shared_key} disabled className="bg-muted" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sitemap_priority">Sitemap Priority</Label>
                <Input
                  id="sitemap_priority"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.sitemap_priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, sitemap_priority: parseFloat(e.target.value) || 0.7 }))}
                />
              </div>
              <div className="flex items-center gap-4 pt-8">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_delivery"
                    checked={formData.is_delivery}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_delivery: checked }))}
                  />
                  <Label htmlFor="is_delivery">Delivery Available</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="noindex"
                    checked={formData.noindex}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, noindex: checked }))}
                  />
                  <Label htmlFor="noindex">No Index</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="short_description">Short Description</Label>
              <Textarea
                id="short_description"
                value={formData.short_description}
                onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                rows={2}
              />
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
                {editingCity ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => deletingCity && deleteMutation.mutate(deletingCity.id)}
        title="Delete City"
        description={`Are you sure you want to delete "${deletingCity?.name}"? This will also delete all associated districts and areas.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
