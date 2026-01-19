import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Check, X } from "lucide-react";
import { EntityTable } from "@/components/entities/EntityTable";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import { slugify } from "@/lib/slugify";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const areaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  short_description: z.string().optional(),
  is_delivery: z.boolean().default(false),
  district_id: z.string().min(1, "District is required"),
});

type AreaFormValues = z.infer<typeof areaSchema>;

interface Area {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  is_delivery: boolean | null;
  district_id: string;
  webflow_item_id: string | null;
  created_at: string;
  updated_at: string;
  districts?: { name: string; cities?: { name: string } };
}

interface District {
  id: string;
  name: string;
  cities?: { name: string };
}

export default function Areas() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deleteArea, setDeleteArea] = useState<Area | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: "",
      slug: "",
      short_description: "",
      is_delivery: false,
      district_id: "",
    },
  });

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*, districts(name, cities(name))")
        .order("name");
      if (error) throw error;
      return data as Area[];
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
      return data as District[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: AreaFormValues) => {
      const { error } = await supabase.from("areas").insert({
        name: values.name,
        slug: values.slug,
        short_description: values.short_description || null,
        is_delivery: values.is_delivery,
        district_id: values.district_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      setSheetOpen(false);
      form.reset();
      toast({ title: "Area created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AreaFormValues }) => {
      const { error } = await supabase.from("areas").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setSheetOpen(false);
      setEditingArea(null);
      form.reset();
      toast({ title: "Area updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      setDeleteArea(null);
      toast({ title: "Area deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    form.reset({
      name: area.name,
      slug: area.slug,
      short_description: area.short_description ?? "",
      is_delivery: area.is_delivery ?? false,
      district_id: area.district_id,
    });
    setSheetOpen(true);
  };

  const handleSubmit = (values: AreaFormValues) => {
    if (editingArea) {
      updateMutation.mutate({ id: editingArea.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (!editingArea) {
      form.setValue("slug", slugify(name));
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "districts",
      label: "District",
      render: (_: any, row: Area) => row.districts?.name ?? "-",
    },
    {
      key: "city",
      label: "City",
      render: (_: any, row: Area) => row.districts?.cities?.name ?? "-",
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Areas</h1>
          <p className="text-muted-foreground mt-1">Manage area records</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingArea(null);
            form.reset();
          }
        }}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Area
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editingArea ? "Edit Area" : "Add Area"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="district_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a district" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {districts.map((district) => (
                            <SelectItem key={district.id} value={district.id}>
                              {district.name} ({district.cities?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="short_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_delivery"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Delivery Available</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingArea ? "Update Area" : "Create Area"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <EntityTable
        columns={columns}
        data={areas}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeleteArea}
      />

      <DeleteDialog
        open={!!deleteArea}
        onOpenChange={() => setDeleteArea(null)}
        onConfirm={() => deleteArea && deleteMutation.mutate(deleteArea.id)}
        title="Delete Area"
        description={`Are you sure you want to delete "${deleteArea?.name}"?`}
      />
    </div>
  );
}
