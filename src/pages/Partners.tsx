import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Check, X } from "lucide-react";
import { EntityTable } from "@/components/entities/EntityTable";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import { slugify } from "@/lib/slugify";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const partnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  area_ids: z.array(z.string()).optional(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

interface Partner {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  webflow_item_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Area {
  id: string;
  name: string;
  districts?: { name: string; cities?: { name: string } };
}

export default function Partners() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deletePartner, setDeletePartner] = useState<Partner | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: "",
      slug: "",
      address: "",
      phone: "",
      email: "",
      area_ids: [],
    },
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Partner[];
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
      return data as Area[];
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

  const createMutation = useMutation({
    mutationFn: async (values: PartnerFormValues) => {
      const { area_ids } = values;
      const { data: partner, error } = await supabase
        .from("partners")
        .insert({
          name: values.name,
          slug: values.slug,
          address: values.address || null,
          phone: values.phone || null,
          email: values.email || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (area_ids && area_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("partner_areas")
          .insert(area_ids.map((area_id) => ({ partner_id: partner.id, area_id })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      setSheetOpen(false);
      form.reset();
      toast({ title: "Partner created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PartnerFormValues }) => {
      const { area_ids, ...partnerData } = values;
      const { error } = await supabase.from("partners").update(partnerData).eq("id", id);
      if (error) throw error;

      // Update partner_areas
      await supabase.from("partner_areas").delete().eq("partner_id", id);
      if (area_ids && area_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("partner_areas")
          .insert(area_ids.map((area_id) => ({ partner_id: id, area_id })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setSheetOpen(false);
      setEditingPartner(null);
      form.reset();
      toast({ title: "Partner updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setDeletePartner(null);
      toast({ title: "Partner deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    form.reset({
      name: partner.name,
      slug: partner.slug,
      address: partner.address ?? "",
      phone: partner.phone ?? "",
      email: partner.email ?? "",
      area_ids: [],
    });
    setSheetOpen(true);
  };

  // Update form when partnerAreas loads
  useState(() => {
    if (partnerAreas && editingPartner) {
      form.setValue("area_ids", partnerAreas);
    }
  });

  const handleSubmit = (values: PartnerFormValues) => {
    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (!editingPartner) {
      form.setValue("slug", slugify(name));
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    {
      key: "webflow_item_id",
      label: "Synced",
      render: (value: string | null) => value ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  const selectedAreas = form.watch("area_ids") ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Partners</h1>
          <p className="text-muted-foreground mt-1">Manage partner records</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingPartner(null);
            form.reset();
          }
        }}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingPartner ? "Edit Partner" : "Add Partner"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} onChange={(e) => handleNameChange(e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="area_ids"
                  render={() => (
                    <FormItem>
                      <FormLabel>Areas ({selectedAreas.length} selected)</FormLabel>
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="space-y-2">
                          {areas.map((area) => (
                            <div key={area.id} className="flex items-center gap-2">
                              <Checkbox
                                id={area.id}
                                checked={selectedAreas.includes(area.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    form.setValue("area_ids", [...selectedAreas, area.id]);
                                  } else {
                                    form.setValue("area_ids", selectedAreas.filter((id) => id !== area.id));
                                  }
                                }}
                              />
                              <label htmlFor={area.id} className="text-sm cursor-pointer">
                                {area.name} ({area.districts?.cities?.name} / {area.districts?.name})
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingPartner ? "Update Partner" : "Create Partner"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <EntityTable
        columns={columns}
        data={partners}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeletePartner}
      />

      <DeleteDialog
        open={!!deletePartner}
        onOpenChange={() => setDeletePartner(null)}
        onConfirm={() => deletePartner && deleteMutation.mutate(deletePartner.id)}
        title="Delete Partner"
        description={`Are you sure you want to delete "${deletePartner?.name}"?`}
      />
    </div>
  );
}
