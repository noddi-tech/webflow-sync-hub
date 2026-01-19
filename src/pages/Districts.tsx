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

const districtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  short_description: z.string().optional(),
  is_delivery: z.boolean().default(false),
  city_id: z.string().min(1, "City is required"),
});

type DistrictFormValues = z.infer<typeof districtSchema>;

interface District {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  is_delivery: boolean | null;
  city_id: string;
  webflow_item_id: string | null;
  created_at: string;
  updated_at: string;
  cities?: { name: string };
}

interface City {
  id: string;
  name: string;
}

export default function Districts() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [deleteDistrict, setDeleteDistrict] = useState<District | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DistrictFormValues>({
    resolver: zodResolver(districtSchema),
    defaultValues: {
      name: "",
      slug: "",
      short_description: "",
      is_delivery: false,
      city_id: "",
    },
  });

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
      return data as City[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: DistrictFormValues) => {
      const { error } = await supabase.from("districts").insert({
        name: values.name,
        slug: values.slug,
        short_description: values.short_description || null,
        is_delivery: values.is_delivery,
        city_id: values.city_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      setSheetOpen(false);
      form.reset();
      toast({ title: "District created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: DistrictFormValues }) => {
      const { error } = await supabase.from("districts").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      setSheetOpen(false);
      setEditingDistrict(null);
      form.reset();
      toast({ title: "District updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setDeleteDistrict(null);
      toast({ title: "District deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (district: District) => {
    setEditingDistrict(district);
    form.reset({
      name: district.name,
      slug: district.slug,
      short_description: district.short_description ?? "",
      is_delivery: district.is_delivery ?? false,
      city_id: district.city_id,
    });
    setSheetOpen(true);
  };

  const handleSubmit = (values: DistrictFormValues) => {
    if (editingDistrict) {
      updateMutation.mutate({ id: editingDistrict.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (!editingDistrict) {
      form.setValue("slug", slugify(name));
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    {
      key: "cities",
      label: "City",
      render: (_: any, row: District) => row.cities?.name ?? "-",
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
          <h1 className="text-3xl font-bold text-foreground">Districts</h1>
          <p className="text-muted-foreground mt-1">Manage district records</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingDistrict(null);
            form.reset();
          }
        }}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add District
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editingDistrict ? "Edit District" : "Add District"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="city_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a city" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cities.map((city) => (
                            <SelectItem key={city.id} value={city.id}>
                              {city.name}
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
                  {editingDistrict ? "Update District" : "Create District"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <EntityTable
        columns={columns}
        data={districts}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeleteDistrict}
      />

      <DeleteDialog
        open={!!deleteDistrict}
        onOpenChange={() => setDeleteDistrict(null)}
        onConfirm={() => deleteDistrict && deleteMutation.mutate(deleteDistrict.id)}
        title="Delete District"
        description={`Are you sure you want to delete "${deleteDistrict?.name}"? This will also delete all associated areas.`}
      />
    </div>
  );
}
