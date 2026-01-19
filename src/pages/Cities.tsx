import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

const citySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  short_description: z.string().optional(),
  is_delivery: z.boolean().default(false),
});

type CityFormValues = z.infer<typeof citySchema>;

interface City {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  is_delivery: boolean | null;
  webflow_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function Cities() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [deleteCity, setDeleteCity] = useState<City | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CityFormValues>({
    resolver: zodResolver(citySchema),
    defaultValues: {
      name: "",
      slug: "",
      short_description: "",
      is_delivery: false,
    },
  });

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as City[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CityFormValues) => {
      const { error } = await supabase.from("cities").insert({
        name: values.name,
        slug: values.slug,
        short_description: values.short_description || null,
        is_delivery: values.is_delivery,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      setSheetOpen(false);
      form.reset();
      toast({ title: "City created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CityFormValues }) => {
      const { error } = await supabase.from("cities").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      setSheetOpen(false);
      setEditingCity(null);
      form.reset();
      toast({ title: "City updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      setDeleteCity(null);
      toast({ title: "City deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (city: City) => {
    setEditingCity(city);
    form.reset({
      name: city.name,
      slug: city.slug,
      short_description: city.short_description ?? "",
      is_delivery: city.is_delivery ?? false,
    });
    setSheetOpen(true);
  };

  const handleSubmit = (values: CityFormValues) => {
    if (editingCity) {
      updateMutation.mutate({ id: editingCity.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (!editingCity) {
      form.setValue("slug", slugify(name));
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cities</h1>
          <p className="text-muted-foreground mt-1">Manage city records</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingCity(null);
            form.reset();
          }
        }}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add City
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editingCity ? "Edit City" : "Add City"}</SheetTitle>
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
                  {editingCity ? "Update City" : "Create City"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <EntityTable
        columns={columns}
        data={cities}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeleteCity}
      />

      <DeleteDialog
        open={!!deleteCity}
        onOpenChange={() => setDeleteCity(null)}
        onConfirm={() => deleteCity && deleteMutation.mutate(deleteCity.id)}
        title="Delete City"
        description={`Are you sure you want to delete "${deleteCity?.name}"? This will also delete all associated districts and areas.`}
      />
    </div>
  );
}
