import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type District = Tables<"districts"> & { cities?: { name: string } };
type DistrictInsert = TablesInsert<"districts">;
type DistrictUpdate = TablesUpdate<"districts">;

interface DistrictFormData {
  city_id: string;
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

const emptyFormData: DistrictFormData = {
  city_id: "",
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
  sitemap_priority: 0.6,
  is_delivery: false,
  noindex: false,
};

export default function Districts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [deletingDistrict, setDeletingDistrict] = useState<District | null>(null);
  const [formData, setFormData] = useState<DistrictFormData>(emptyFormData);

  const { data: districts = [], isLoading } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select("*, cities(name)")
        .order("name");
      if (error) throw error;
      return data as District[];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DistrictInsert) => {
      const { error } = await supabase.from("districts").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "District created successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error creating district", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DistrictUpdate }) => {
      const { error } = await supabase.from("districts").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      toast({ title: "District updated successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error updating district", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("districts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "District deleted successfully" });
      setIsDeleteDialogOpen(false);
      setDeletingDistrict(null);
    },
    onError: (error) => {
      toast({ title: "Error deleting district", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDistrict(null);
    setFormData(emptyFormData);
  };

  const openCreateDialog = () => {
    setFormData(emptyFormData);
    setEditingDistrict(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (district: District) => {
    setEditingDistrict(district);
    setFormData({
      city_id: district.city_id || "",
      name: district.name || "",
      name_en: district.name_en || "",
      name_sv: district.name_sv || "",
      slug: district.slug || "",
      slug_en: district.slug_en || "",
      slug_sv: district.slug_sv || "",
      short_description: district.short_description || "",
      intro: district.intro || "",
      intro_en: district.intro_en || "",
      intro_sv: district.intro_sv || "",
      seo_title: district.seo_title || "",
      seo_title_en: district.seo_title_en || "",
      seo_title_sv: district.seo_title_sv || "",
      seo_meta_description: district.seo_meta_description || "",
      seo_meta_description_en: district.seo_meta_description_en || "",
      seo_meta_description_sv: district.seo_meta_description_sv || "",
      sitemap_priority: district.sitemap_priority ?? 0.6,
      is_delivery: district.is_delivery ?? false,
      noindex: (district as any).noindex ?? false,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (district: District) => {
    setDeletingDistrict(district);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      city_id: formData.city_id,
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

    if (editingDistrict) {
      updateMutation.mutate({ id: editingDistrict.id, data: payload });
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
      key: "cities",
      label: "City",
      render: (_: unknown, row: District) => row.cities?.name ?? "-",
    },
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
          <h1 className="text-3xl font-bold">Districts</h1>
          <p className="text-muted-foreground">Manage district records</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add District
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={districts}
        isLoading={isLoading}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDistrict ? "Edit District" : "Create District"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingDistrict?.shared_key && (
              <div className="space-y-2">
                <Label>Shared Key</Label>
                <Input value={editingDistrict.shared_key} disabled className="bg-muted" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="city_id">City *</Label>
              <Select
                value={formData.city_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, city_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  onChange={(e) => setFormData(prev => ({ ...prev, sitemap_priority: parseFloat(e.target.value) || 0.6 }))}
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
                {editingDistrict ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => deletingDistrict && deleteMutation.mutate(deletingDistrict.id)}
        title="Delete District"
        description={`Are you sure you want to delete "${deletingDistrict?.name}"? This will also delete all associated areas.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
