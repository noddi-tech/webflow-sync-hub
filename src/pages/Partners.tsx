import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type Partner = Tables<"partners">;
type PartnerInsert = TablesInsert<"partners">;
type PartnerUpdate = TablesUpdate<"partners">;

interface PartnerFormData {
  name: string;
  name_en: string;
  name_sv: string;
  slug: string;
  slug_en: string;
  slug_sv: string;
  description: string;
  description_en: string;
  description_sv: string;
  description_summary: string;
  heading_text: string;
  heading_text_2: string;
  address: string;
  phone: string;
  email: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  logo_url: string;
  noddi_logo_url: string;
  rating: number | null;
  active: boolean;
  // SEO fields
  seo_title: string;
  seo_title_en: string;
  seo_title_sv: string;
  seo_meta_description: string;
  seo_meta_description_en: string;
  seo_meta_description_sv: string;
  intro: string;
  intro_en: string;
  intro_sv: string;
  // Junction table IDs
  area_ids: string[];
  service_ids: string[];
  city_ids: string[];
  district_ids: string[];
}

const emptyFormData: PartnerFormData = {
  name: "",
  name_en: "",
  name_sv: "",
  slug: "",
  slug_en: "",
  slug_sv: "",
  description: "",
  description_en: "",
  description_sv: "",
  description_summary: "",
  heading_text: "",
  heading_text_2: "",
  address: "",
  phone: "",
  email: "",
  website_url: "",
  instagram_url: "",
  facebook_url: "",
  logo_url: "",
  noddi_logo_url: "",
  rating: null,
  active: true,
  // SEO fields
  seo_title: "",
  seo_title_en: "",
  seo_title_sv: "",
  seo_meta_description: "",
  seo_meta_description_en: "",
  seo_meta_description_sv: "",
  intro: "",
  intro_en: "",
  intro_sv: "",
  // Junction table IDs
  area_ids: [],
  service_ids: [],
  city_ids: [],
  district_ids: [],
};

export default function Partners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(emptyFormData);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name, districts(name, cities(name))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
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

  const { data: districts = [] } = useQuery({
    queryKey: ["districts-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select("id, name, cities(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: partnerAreas } = useQuery({
    queryKey: ["partner-areas", editingPartner?.id],
    queryFn: async () => {
      if (!editingPartner) return [];
      const { data, error } = await supabase
        .from("partner_areas")
        .select("area_id")
        .eq("partner_id", editingPartner.id);
      if (error) throw error;
      return data.map((pa) => pa.area_id);
    },
    enabled: !!editingPartner,
  });

  const { data: partnerServices } = useQuery({
    queryKey: ["partner-services", editingPartner?.id],
    queryFn: async () => {
      if (!editingPartner) return [];
      const { data, error } = await supabase
        .from("partner_services")
        .select("service_id")
        .eq("partner_id", editingPartner.id);
      if (error) throw error;
      return data.map((ps) => ps.service_id);
    },
    enabled: !!editingPartner,
  });

  const { data: partnerCities } = useQuery({
    queryKey: ["partner-cities", editingPartner?.id],
    queryFn: async () => {
      if (!editingPartner) return [];
      const { data, error } = await supabase
        .from("partner_cities")
        .select("city_id")
        .eq("partner_id", editingPartner.id);
      if (error) throw error;
      return data.map((pc) => pc.city_id);
    },
    enabled: !!editingPartner,
  });

  const { data: partnerDistricts } = useQuery({
    queryKey: ["partner-districts", editingPartner?.id],
    queryFn: async () => {
      if (!editingPartner) return [];
      const { data, error } = await supabase
        .from("partner_districts")
        .select("district_id")
        .eq("partner_id", editingPartner.id);
      if (error) throw error;
      return data.map((pd) => pd.district_id);
    },
    enabled: !!editingPartner,
  });

  useEffect(() => {
    if (partnerAreas && editingPartner) {
      setFormData(prev => ({ ...prev, area_ids: partnerAreas }));
    }
  }, [partnerAreas, editingPartner]);

  useEffect(() => {
    if (partnerServices && editingPartner) {
      setFormData(prev => ({ ...prev, service_ids: partnerServices }));
    }
  }, [partnerServices, editingPartner]);

  useEffect(() => {
    if (partnerCities && editingPartner) {
      setFormData(prev => ({ ...prev, city_ids: partnerCities }));
    }
  }, [partnerCities, editingPartner]);

  useEffect(() => {
    if (partnerDistricts && editingPartner) {
      setFormData(prev => ({ ...prev, district_ids: partnerDistricts }));
    }
  }, [partnerDistricts, editingPartner]);

  const createMutation = useMutation({
    mutationFn: async (values: PartnerFormData) => {
      const { area_ids, service_ids, city_ids, district_ids, ...partnerData } = values;
      const { data: partner, error } = await supabase
        .from("partners")
        .insert({
          ...partnerData,
          rating: partnerData.rating || null,
          email: partnerData.email || null,
        } as PartnerInsert)
        .select()
        .single();
      if (error) throw error;

      if (area_ids.length > 0) {
        const { error: areaError } = await supabase
          .from("partner_areas")
          .insert(area_ids.map((area_id) => ({ partner_id: partner.id, area_id })));
        if (areaError) throw areaError;
      }

      if (service_ids.length > 0) {
        const { error: serviceError } = await supabase
          .from("partner_services")
          .insert(service_ids.map((service_id) => ({ partner_id: partner.id, service_id })));
        if (serviceError) throw serviceError;
      }

      if (city_ids.length > 0) {
        const { error: cityError } = await supabase
          .from("partner_cities")
          .insert(city_ids.map((city_id) => ({ partner_id: partner.id, city_id })));
        if (cityError) throw cityError;
      }

      if (district_ids.length > 0) {
        const { error: districtError } = await supabase
          .from("partner_districts")
          .insert(district_ids.map((district_id) => ({ partner_id: partner.id, district_id })));
        if (districtError) throw districtError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Partner created successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error creating partner", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PartnerFormData }) => {
      const { area_ids, service_ids, city_ids, district_ids, ...partnerData } = values;
      const { error } = await supabase
        .from("partners")
        .update({
          ...partnerData,
          rating: partnerData.rating || null,
          email: partnerData.email || null,
        } as PartnerUpdate)
        .eq("id", id);
      if (error) throw error;

      // Update areas
      await supabase.from("partner_areas").delete().eq("partner_id", id);
      if (area_ids.length > 0) {
        const { error: areaError } = await supabase
          .from("partner_areas")
          .insert(area_ids.map((area_id) => ({ partner_id: id, area_id })));
        if (areaError) throw areaError;
      }

      // Update services
      await supabase.from("partner_services").delete().eq("partner_id", id);
      if (service_ids.length > 0) {
        const { error: serviceError } = await supabase
          .from("partner_services")
          .insert(service_ids.map((service_id) => ({ partner_id: id, service_id })));
        if (serviceError) throw serviceError;
      }

      // Update cities
      await supabase.from("partner_cities").delete().eq("partner_id", id);
      if (city_ids.length > 0) {
        const { error: cityError } = await supabase
          .from("partner_cities")
          .insert(city_ids.map((city_id) => ({ partner_id: id, city_id })));
        if (cityError) throw cityError;
      }

      // Update districts
      await supabase.from("partner_districts").delete().eq("partner_id", id);
      if (district_ids.length > 0) {
        const { error: districtError } = await supabase
          .from("partner_districts")
          .insert(district_ids.map((district_id) => ({ partner_id: id, district_id })));
        if (districtError) throw districtError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-areas"] });
      queryClient.invalidateQueries({ queryKey: ["partner-services"] });
      queryClient.invalidateQueries({ queryKey: ["partner-cities"] });
      queryClient.invalidateQueries({ queryKey: ["partner-districts"] });
      toast({ title: "Partner updated successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error updating partner", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Partner deleted successfully" });
      setIsDeleteDialogOpen(false);
      setDeletingPartner(null);
    },
    onError: (error) => {
      toast({ title: "Error deleting partner", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPartner(null);
    setFormData(emptyFormData);
  };

  const openCreateDialog = () => {
    setFormData(emptyFormData);
    setEditingPartner(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name || "",
      name_en: partner.name_en || "",
      name_sv: partner.name_sv || "",
      slug: partner.slug || "",
      slug_en: partner.slug_en || "",
      slug_sv: partner.slug_sv || "",
      description: partner.description || "",
      description_en: partner.description_en || "",
      description_sv: partner.description_sv || "",
      description_summary: partner.description_summary || "",
      heading_text: partner.heading_text || "",
      heading_text_2: (partner as any).heading_text_2 || "",
      address: partner.address || "",
      phone: partner.phone || "",
      email: partner.email || "",
      website_url: partner.website_url || "",
      instagram_url: partner.instagram_url || "",
      facebook_url: partner.facebook_url || "",
      logo_url: partner.logo_url || "",
      noddi_logo_url: partner.noddi_logo_url || "",
      rating: partner.rating ?? null,
      active: partner.active ?? true,
      // SEO fields - cast needed until types regenerate
      seo_title: (partner as any).seo_title || "",
      seo_title_en: (partner as any).seo_title_en || "",
      seo_title_sv: (partner as any).seo_title_sv || "",
      seo_meta_description: (partner as any).seo_meta_description || "",
      seo_meta_description_en: (partner as any).seo_meta_description_en || "",
      seo_meta_description_sv: (partner as any).seo_meta_description_sv || "",
      intro: (partner as any).intro || "",
      intro_en: (partner as any).intro_en || "",
      intro_sv: (partner as any).intro_sv || "",
      // Junction IDs will be populated by useEffects
      area_ids: [],
      service_ids: [],
      city_ids: [],
      district_ids: [],
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (partner: Partner) => {
    setDeletingPartner(partner);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner.id, values: formData });
    } else {
      createMutation.mutate(formData);
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

  const toggleSelection = (id: string, field: "area_ids" | "service_ids" | "city_ids" | "district_ids") => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter(i => i !== id)
        : [...prev[field], id],
    }));
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    {
      key: "active",
      label: "Active",
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
          <h1 className="text-3xl font-bold">Partners</h1>
          <p className="text-muted-foreground">Manage partner records</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={partners}
        isLoading={isLoading}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? "Edit Partner" : "Create Partner"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingPartner?.shared_key && (
              <div className="space-y-2">
                <Label>Shared Key</Label>
                <Input value={editingPartner.shared_key} disabled className="bg-muted" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noddi_logo_url">Noddi Logo URL</Label>
                <Input
                  id="noddi_logo_url"
                  value={formData.noddi_logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, noddi_logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.rating ?? ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, rating: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website_url">Website URL</Label>
                <Input
                  id="website_url"
                  value={formData.website_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_url">Instagram URL</Label>
                <Input
                  id="instagram_url"
                  value={formData.instagram_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook_url">Facebook URL</Label>
                <Input
                  id="facebook_url"
                  value={formData.facebook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heading_text">Heading Text</Label>
                <Input
                  id="heading_text"
                  value={formData.heading_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, heading_text: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heading_text_2">Heading Text 2</Label>
                <Input
                  id="heading_text_2"
                  value={formData.heading_text_2}
                  onChange={(e) => setFormData(prev => ({ ...prev, heading_text_2: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_summary">Description Summary</Label>
              <Textarea
                id="description_summary"
                value={formData.description_summary}
                onChange={(e) => setFormData(prev => ({ ...prev, description_summary: e.target.value }))}
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_title">SEO Title</Label>
                  <Input
                    id="seo_title"
                    value={formData.seo_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                    placeholder="Page title for search engines"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_meta_description">SEO Meta Description</Label>
                  <Textarea
                    id="seo_meta_description"
                    value={formData.seo_meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description: e.target.value }))}
                    rows={2}
                    placeholder="Meta description for search engines"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro">Intro Content</Label>
                  <Textarea
                    id="intro"
                    value={formData.intro}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro: e.target.value }))}
                    rows={3}
                    placeholder="Rich text intro content"
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
                <div className="space-y-2">
                  <Label htmlFor="intro_en">Intro Content (EN)</Label>
                  <Textarea
                    id="intro_en"
                    value={formData.intro_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro_en: e.target.value }))}
                    rows={3}
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
                <div className="space-y-2">
                  <Label htmlFor="intro_sv">Intro Content (SV)</Label>
                  <Textarea
                    id="intro_sv"
                    value={formData.intro_sv}
                    onChange={(e) => setFormData(prev => ({ ...prev, intro_sv: e.target.value }))}
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Services ({formData.service_ids.length} selected)</Label>
                <ScrollArea className="h-28 border rounded-md p-3">
                  <div className="space-y-2">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={formData.service_ids.includes(service.id)}
                          onCheckedChange={() => toggleSelection(service.id, "service_ids")}
                        />
                        <label htmlFor={`service-${service.id}`} className="text-sm cursor-pointer">
                          {service.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Areas ({formData.area_ids.length} selected)</Label>
                <ScrollArea className="h-28 border rounded-md p-3">
                  <div className="space-y-2">
                    {areas.map((area) => (
                      <div key={area.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`area-${area.id}`}
                          checked={formData.area_ids.includes(area.id)}
                          onCheckedChange={() => toggleSelection(area.id, "area_ids")}
                        />
                        <label htmlFor={`area-${area.id}`} className="text-sm cursor-pointer">
                          {area.name} ({area.districts?.cities?.name} / {area.districts?.name})
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Cities ({formData.city_ids.length} selected)</Label>
                <ScrollArea className="h-28 border rounded-md p-3">
                  <div className="space-y-2">
                    {cities.map((city) => (
                      <div key={city.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`city-${city.id}`}
                          checked={formData.city_ids.includes(city.id)}
                          onCheckedChange={() => toggleSelection(city.id, "city_ids")}
                        />
                        <label htmlFor={`city-${city.id}`} className="text-sm cursor-pointer">
                          {city.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Districts ({formData.district_ids.length} selected)</Label>
                <ScrollArea className="h-28 border rounded-md p-3">
                  <div className="space-y-2">
                    {districts.map((district) => (
                      <div key={district.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`district-${district.id}`}
                          checked={formData.district_ids.includes(district.id)}
                          onCheckedChange={() => toggleSelection(district.id, "district_ids")}
                        />
                        <label htmlFor={`district-${district.id}`} className="text-sm cursor-pointer">
                          {district.name} ({district.cities?.name})
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPartner ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => deletingPartner && deleteMutation.mutate(deletingPartner.id)}
        title="Delete Partner"
        description={`Are you sure you want to delete "${deletingPartner?.name}"?`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
