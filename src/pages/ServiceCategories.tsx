import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { EntityTable } from "@/components/entities/EntityTable";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Plus } from "lucide-react";
import { slugify } from "@/lib/slugify";
import type { Tables } from "@/integrations/supabase/types";

type ServiceCategory = Tables<"service_categories">;

const columns = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug" },
  { key: "sort_order", label: "Order" },
  {
    key: "active",
    label: "Active",
    render: (value: boolean) => (
      <span className={value ? "text-green-600" : "text-muted-foreground"}>
        {value ? "Active" : "Inactive"}
      </span>
    ),
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

export default function ServiceCategories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCategory | null>(null);
  const [deleteItem, setDeleteItem] = useState<ServiceCategory | null>(null);
  const [activeLocale, setActiveLocale] = useState("no");

  const [formData, setFormData] = useState({
    shared_key: "",
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
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ServiceCategory[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        shared_key: data.shared_key || null,
        name: data.name,
        name_en: data.name_en || null,
        name_sv: data.name_sv || null,
        slug: data.slug,
        slug_en: data.slug_en || null,
        slug_sv: data.slug_sv || null,
        description: data.description || null,
        description_en: data.description_en || null,
        description_sv: data.description_sv || null,
        seo_title: data.seo_title || null,
        seo_title_en: data.seo_title_en || null,
        seo_title_sv: data.seo_title_sv || null,
        seo_meta_description: data.seo_meta_description || null,
        seo_meta_description_en: data.seo_meta_description_en || null,
        seo_meta_description_sv: data.seo_meta_description_sv || null,
        intro: data.intro || null,
        intro_en: data.intro_en || null,
        intro_sv: data.intro_sv || null,
        icon_url: data.icon_url || null,
        sort_order: data.sort_order,
        active: data.active,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("service_categories")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_categories")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_categories"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({
        title: editingItem ? "Category updated" : "Category created",
        description: "Service category has been saved successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_categories"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({
        title: "Category deleted",
        description: "Service category has been removed.",
      });
      setDeleteItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (item?: ServiceCategory) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        shared_key: item.shared_key || "",
        name: item.name,
        name_en: item.name_en || "",
        name_sv: item.name_sv || "",
        slug: item.slug,
        slug_en: item.slug_en || "",
        slug_sv: item.slug_sv || "",
        description: item.description || "",
        description_en: item.description_en || "",
        description_sv: item.description_sv || "",
        seo_title: item.seo_title || "",
        seo_title_en: item.seo_title_en || "",
        seo_title_sv: item.seo_title_sv || "",
        seo_meta_description: item.seo_meta_description || "",
        seo_meta_description_en: item.seo_meta_description_en || "",
        seo_meta_description_sv: item.seo_meta_description_sv || "",
        intro: item.intro || "",
        intro_en: item.intro_en || "",
        intro_sv: item.intro_sv || "",
        icon_url: item.icon_url || "",
        sort_order: item.sort_order || 0,
        active: item.active ?? true,
      });
    } else {
      setEditingItem(null);
      setFormData({
        shared_key: "",
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
      });
    }
    setActiveLocale("no");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleNameChange = (value: string, locale: string) => {
    const nameKey = locale === "no" ? "name" : `name_${locale}`;
    const slugKey = locale === "no" ? "slug" : `slug_${locale}`;
    setFormData((prev) => ({
      ...prev,
      [nameKey]: value,
      [slugKey]: slugify(value),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const renderLocalizedFields = (locale: string) => {
    const nameKey = locale === "no" ? "name" : `name_${locale}`;
    const slugKey = locale === "no" ? "slug" : `slug_${locale}`;
    const descKey = locale === "no" ? "description" : `description_${locale}`;
    const seoTitleKey = locale === "no" ? "seo_title" : `seo_title_${locale}`;
    const seoMetaKey = locale === "no" ? "seo_meta_description" : `seo_meta_description_${locale}`;
    const introKey = locale === "no" ? "intro" : `intro_${locale}`;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name {locale === "no" ? "(Norwegian) *" : `(${locale.toUpperCase()})`}</Label>
            <Input
              value={(formData as Record<string, unknown>)[nameKey] as string}
              onChange={(e) => handleNameChange(e.target.value, locale)}
              required={locale === "no"}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={(formData as Record<string, unknown>)[slugKey] as string}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, [slugKey]: e.target.value }))
              }
              required={locale === "no"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={(formData as Record<string, unknown>)[descKey] as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [descKey]: e.target.value }))
            }
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>SEO Title</Label>
          <Input
            value={(formData as Record<string, unknown>)[seoTitleKey] as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [seoTitleKey]: e.target.value }))
            }
            placeholder={`Tjenester innen ${(formData as Record<string, unknown>)[nameKey] || "[Category]"}`}
          />
        </div>

        <div className="space-y-2">
          <Label>SEO Meta Description</Label>
          <Textarea
            value={(formData as Record<string, unknown>)[seoMetaKey] as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [seoMetaKey]: e.target.value }))
            }
            rows={2}
            placeholder="Finn tjenester innen [Category] i ditt område."
          />
        </div>

        <div className="space-y-2">
          <Label>Intro Content</Label>
          <Textarea
            value={(formData as Record<string, unknown>)[introKey] as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [introKey]: e.target.value }))
            }
            rows={3}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Service Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage service category groupings
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={categories}
        isLoading={isLoading}
        onEdit={handleOpenDialog}
        onDelete={setDeleteItem}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Service Category" : "Add Service Category"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shared Key</Label>
                <Input
                  value={formData.shared_key}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, shared_key: e.target.value }))
                  }
                  placeholder="Unique identifier for syncing"
                  disabled={!!editingItem}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sort_order: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon URL</Label>
                <Input
                  value={formData.icon_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, icon_url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                />
                <Label>Active</Label>
              </div>
            </div>

            <Tabs value={activeLocale} onValueChange={setActiveLocale}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="no">Norwegian</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="sv">Swedish</TabsTrigger>
              </TabsList>
              <TabsContent value="no" className="mt-4">
                {renderLocalizedFields("no")}
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                {renderLocalizedFields("en")}
              </TabsContent>
              <TabsContent value="sv" className="mt-4">
                {renderLocalizedFields("sv")}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingItem ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        title="Delete Service Category"
        description={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
