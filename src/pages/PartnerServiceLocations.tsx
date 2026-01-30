import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Filter, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteDialog } from "@/components/entities/DeleteDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PartnerServiceLocation {
  id: string;
  partner_id: string;
  service_id: string;
  city_id: string;
  district_id: string | null;
  area_id: string | null;
  price_info: string | null;
  duration_info: string | null;
  is_delivery: boolean | null;
  partners?: { name: string };
  services?: { name: string };
  cities?: { name: string };
  districts?: { name: string } | null;
  areas?: { name: string } | null;
}

interface FormData {
  partner_id: string;
  service_id: string;
  city_id: string;
  district_id: string;
  area_id: string;
  price_info: string;
  duration_info: string;
  is_delivery: boolean;
}

const initialFormData: FormData = {
  partner_id: "",
  service_id: "",
  city_id: "",
  district_id: "",
  area_id: "",
  price_info: "",
  duration_info: "",
  is_delivery: false,
};

export default function PartnerServiceLocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PartnerServiceLocation | null>(null);
  const [editingItem, setEditingItem] = useState<PartnerServiceLocation | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Filters
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [filterService, setFilterService] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("");

  // Fetch partner service locations
  const { data: locations, isLoading } = useQuery({
    queryKey: ["partner-service-locations", filterPartner, filterService, filterCity],
    queryFn: async () => {
      let query = supabase
        .from("partner_service_locations")
        .select(`
          *,
          partners(name),
          services(name),
          cities(name),
          districts(name),
          areas(name)
        `)
        .order("created_at", { ascending: false });

      if (filterPartner) query = query.eq("partner_id", filterPartner);
      if (filterService) query = query.eq("service_id", filterService);
      if (filterCity) query = query.eq("city_id", filterCity);

      const { data, error } = await query;
      if (error) throw error;
      return data as PartnerServiceLocation[];
    },
  });

  // Fetch lookup data
  const { data: partners } = useQuery({
    queryKey: ["partners-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: districts } = useQuery({
    queryKey: ["districts-lookup", formData.city_id],
    queryFn: async () => {
      if (!formData.city_id) return [];
      const { data } = await supabase
        .from("districts")
        .select("id, name")
        .eq("city_id", formData.city_id)
        .order("name");
      return data || [];
    },
    enabled: !!formData.city_id,
  });

  const { data: areas } = useQuery({
    queryKey: ["areas-lookup", formData.district_id],
    queryFn: async () => {
      if (!formData.district_id) return [];
      const { data } = await supabase
        .from("areas")
        .select("id, name")
        .eq("district_id", formData.district_id)
        .order("name");
      return data || [];
    },
    enabled: !!formData.district_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = {
        partner_id: data.partner_id,
        service_id: data.service_id,
        city_id: data.city_id,
        district_id: data.district_id || null,
        area_id: data.area_id || null,
        price_info: data.price_info || null,
        duration_info: data.duration_info || null,
        is_delivery: data.is_delivery,
      };

      const { error } = await supabase.from("partner_service_locations").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-service-locations"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Created", description: "Partner service location created successfully" });
      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const updateData = {
        partner_id: data.partner_id,
        service_id: data.service_id,
        city_id: data.city_id,
        district_id: data.district_id || null,
        area_id: data.area_id || null,
        price_info: data.price_info || null,
        duration_info: data.duration_info || null,
        is_delivery: data.is_delivery,
      };

      const { error } = await supabase
        .from("partner_service_locations")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-service-locations"] });
      toast({ title: "Updated", description: "Partner service location updated successfully" });
      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_service_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-service-locations"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({ title: "Deleted", description: "Partner service location deleted" });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partner_id || !formData.service_id || !formData.city_id) {
      toast({ title: "Error", description: "Partner, Service, and City are required", variant: "destructive" });
      return;
    }
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (item: PartnerServiceLocation) => {
    setEditingItem(item);
    setFormData({
      partner_id: item.partner_id,
      service_id: item.service_id,
      city_id: item.city_id,
      district_id: item.district_id || "",
      area_id: item.area_id || "",
      price_info: item.price_info || "",
      duration_info: item.duration_info || "",
      is_delivery: item.is_delivery ?? false,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (item: PartnerServiceLocation) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const clearFilters = () => {
    setFilterPartner("");
    setFilterService("");
    setFilterCity("");
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Partner Service Locations</h1>
          <p className="text-muted-foreground mt-1">
            Define which partners provide which services at which locations
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Coverage
        </Button>
      </div>

      {/* Dialog for Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Partner Service Location" : "Add Partner Service Location"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Partner *</Label>
              <Select
                value={formData.partner_id}
                onValueChange={(v) => setFormData({ ...formData, partner_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service *</Label>
              <Select
                value={formData.service_id}
                onValueChange={(v) => setFormData({ ...formData, service_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>City *</Label>
              <Select
                value={formData.city_id}
                onValueChange={(v) => setFormData({ 
                  ...formData, 
                  city_id: v, 
                  district_id: "", 
                  area_id: "" 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>District (optional)</Label>
              <Select
                value={formData.district_id}
                onValueChange={(v) => setFormData({ 
                  ...formData, 
                  district_id: v, 
                  area_id: "" 
                })}
                disabled={!formData.city_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {districts?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area (optional)</Label>
              <Select
                value={formData.area_id}
                onValueChange={(v) => setFormData({ ...formData, area_id: v })}
                disabled={!formData.district_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {areas?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price Info</Label>
                <Input
                  value={formData.price_info}
                  onChange={(e) => setFormData({ ...formData, price_info: e.target.value })}
                  placeholder="e.g., From 299 kr"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration Info</Label>
                <Input
                  value={formData.duration_info}
                  onChange={(e) => setFormData({ ...formData, duration_info: e.target.value })}
                  placeholder="e.g., 1-2 hours"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_delivery}
                onCheckedChange={(checked) => setFormData({ ...formData, is_delivery: checked })}
              />
              <Label>Delivery Available</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : (editingItem ? "Update" : "Create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger>
                <SelectValue placeholder="All Partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Partners</SelectItem>
                {partners?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger>
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger>
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Cities</SelectItem>
                {cities?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : locations?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No partner service locations found. Add your first one!
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.partners?.name}</TableCell>
                  <TableCell>{loc.services?.name}</TableCell>
                  <TableCell>
                    {[loc.areas?.name, loc.districts?.name, loc.cities?.name]
                      .filter(Boolean)
                      .join(", ")}
                  </TableCell>
                  <TableCell>{loc.price_info || "-"}</TableCell>
                  <TableCell>{loc.duration_info || "-"}</TableCell>
                  <TableCell>{loc.is_delivery ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(loc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(loc)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
        title="Delete Partner Service Location"
        description="Are you sure you want to remove this partner service location? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
