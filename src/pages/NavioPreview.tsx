import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, X, Trash2, RefreshCw, ChevronRight, ChevronDown, Globe, AlertTriangle } from "lucide-react";
import { SyncProgressDialog } from "@/components/sync/SyncProgressDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StagingCity {
  id: string;
  batch_id: string;
  name: string;
  country_code: string;
  area_names: string[];
  status: string;
  created_at: string;
  navio_staging_districts: StagingDistrict[];
}

interface StagingDistrict {
  id: string;
  batch_id: string;
  staging_city_id: string;
  name: string;
  area_names: string[];
  status: string;
  created_at: string;
  navio_staging_areas: StagingArea[];
}

interface StagingArea {
  id: string;
  batch_id: string;
  staging_district_id: string;
  navio_service_area_id: string;
  name: string;
  original_name: string;
  status: string;
  created_at: string;
}

export default function NavioPreview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Fetch all batches
  const { data: batches } = useQuery({
    queryKey: ["navio-staging-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navio_staging_cities")
        .select("batch_id, created_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get unique batches
      const uniqueBatches = new Map<string, string>();
      data?.forEach(row => {
        if (!uniqueBatches.has(row.batch_id)) {
          uniqueBatches.set(row.batch_id, row.created_at);
        }
      });
      
      return Array.from(uniqueBatches.entries()).map(([id, date]) => ({
        id,
        created_at: date,
      }));
    },
  });

  // Fetch staging data with hierarchy
  const { data: stagingData, isLoading } = useQuery({
    queryKey: ["navio-staging-data", selectedBatch],
    queryFn: async () => {
      let query = supabase
        .from("navio_staging_cities")
        .select(`
          id, batch_id, name, country_code, area_names, status, created_at,
          navio_staging_districts (
            id, batch_id, staging_city_id, name, area_names, status, created_at,
            navio_staging_areas (
              id, batch_id, staging_district_id, navio_service_area_id, name, original_name, status, created_at
            )
          )
        `)
        .neq("status", "committed")
        .order("name");
      
      if (selectedBatch !== "all") {
        query = query.eq("batch_id", selectedBatch);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as StagingCity[];
    },
  });

  // Calculate summary stats
  const summary = {
    cities: stagingData?.length ?? 0,
    districts: stagingData?.reduce((acc, city) => acc + (city.navio_staging_districts?.length ?? 0), 0) ?? 0,
    areas: stagingData?.reduce((acc, city) => 
      acc + (city.navio_staging_districts?.reduce((d, district) => 
        d + (district.navio_staging_areas?.length ?? 0), 0) ?? 0), 0) ?? 0,
    countries: [...new Set(stagingData?.map(c => c.country_code) ?? [])],
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (cityIds: string[]) => {
      // Update cities to approved
      const { error: citiesError } = await supabase
        .from("navio_staging_cities")
        .update({ status: "approved" })
        .in("id", cityIds);
      
      if (citiesError) throw citiesError;

      // Update all districts for these cities
      const { error: districtsError } = await supabase
        .from("navio_staging_districts")
        .update({ status: "approved" })
        .in("staging_city_id", cityIds);
      
      if (districtsError) throw districtsError;

      // Get district IDs
      const { data: districts } = await supabase
        .from("navio_staging_districts")
        .select("id")
        .in("staging_city_id", cityIds);
      
      if (districts && districts.length > 0) {
        const districtIds = districts.map(d => d.id);
        
        // Update all areas for these districts
        const { error: areasError } = await supabase
          .from("navio_staging_areas")
          .update({ status: "approved" })
          .in("staging_district_id", districtIds);
        
        if (areasError) throw areasError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      setSelectedCities(new Set());
      toast({
        title: "Cities Approved",
        description: "Selected cities have been marked for commit.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (cityIds: string[]) => {
      // Get district IDs first
      const { data: districts } = await supabase
        .from("navio_staging_districts")
        .select("id")
        .in("staging_city_id", cityIds);
      
      if (districts && districts.length > 0) {
        const districtIds = districts.map(d => d.id);
        
        // Delete areas
        await supabase
          .from("navio_staging_areas")
          .delete()
          .in("staging_district_id", districtIds);
      }

      // Delete districts
      await supabase
        .from("navio_staging_districts")
        .delete()
        .in("staging_city_id", cityIds);

      // Delete cities
      const { error } = await supabase
        .from("navio_staging_cities")
        .delete()
        .in("id", cityIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
      setSelectedCities(new Set());
      toast({
        title: "Cities Rejected",
        description: "Selected cities have been removed from staging.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke("navio-import", {
        body: { batch_id: batchId, mode: "commit" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: (batchId: string) => {
      setCurrentBatchId(batchId);
      setProgressOpen(true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
      queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
      toast({
        title: "Commit Complete",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      setProgressOpen(false);
      toast({
        title: "Commit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => setProgressOpen(false), 1500);
    },
  });

  // Clear batch mutation
  const clearBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      // Get all city IDs for this batch
      const { data: cities } = await supabase
        .from("navio_staging_cities")
        .select("id")
        .eq("batch_id", batchId);
      
      if (!cities?.length) return;
      
      const cityIds = cities.map(c => c.id);
      
      // Get district IDs
      const { data: districts } = await supabase
        .from("navio_staging_districts")
        .select("id")
        .in("staging_city_id", cityIds);
      
      if (districts?.length) {
        const districtIds = districts.map(d => d.id);
        await supabase.from("navio_staging_areas").delete().in("staging_district_id", districtIds);
      }
      
      await supabase.from("navio_staging_districts").delete().in("staging_city_id", cityIds);
      await supabase.from("navio_staging_cities").delete().eq("batch_id", batchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
      setSelectedBatch("all");
      toast({
        title: "Batch Cleared",
        description: "All staging data for this batch has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Clear Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleCitySelection = (cityId: string) => {
    const newSelected = new Set(selectedCities);
    if (newSelected.has(cityId)) {
      newSelected.delete(cityId);
    } else {
      newSelected.add(cityId);
    }
    setSelectedCities(newSelected);
  };

  const selectAll = () => {
    if (stagingData) {
      setSelectedCities(new Set(stagingData.map(c => c.id)));
    }
  };

  const deselectAll = () => {
    setSelectedCities(new Set());
  };

  const toggleCityExpand = (cityId: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityId)) {
      newExpanded.delete(cityId);
    } else {
      newExpanded.add(cityId);
    }
    setExpandedCities(newExpanded);
  };

  const toggleDistrictExpand = (districtId: string) => {
    const newExpanded = new Set(expandedDistricts);
    if (newExpanded.has(districtId)) {
      newExpanded.delete(districtId);
    } else {
      newExpanded.add(districtId);
    }
    setExpandedDistricts(newExpanded);
  };

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      NO: "🇳🇴",
      SE: "🇸🇪",
      DK: "🇩🇰",
      FI: "🇫🇮",
      DE: "🇩🇪",
      GB: "🇬🇧",
      US: "🇺🇸",
      XX: "🏳️",
    };
    return flags[code] || "🏳️";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "committed":
        return <Badge variant="outline">Committed</Badge>;
      case "needs_mapping":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs Mapping
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is an internal logistics code that requires manual mapping to a real district/area name.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const approvedCount = stagingData?.filter(c => c.status === "approved").length ?? 0;
  const currentBatchForCommit = selectedBatch !== "all" ? selectedBatch : batches?.[0]?.id;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Navio Import Preview</h1>
        <p className="text-muted-foreground mt-1">
          Review AI classification before committing to database
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {batches?.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {new Date(batch.created_at).toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto">
          {selectedBatch !== "all" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Batch
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear this batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all staging data for this import session. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearBatchMutation.mutate(selectedBatch)}>
                    Clear Batch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">{summary.cities}</p>
              <p className="text-sm text-muted-foreground">Cities</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-3xl font-bold">{summary.districts}</p>
              <p className="text-sm text-muted-foreground">Districts</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-3xl font-bold">{summary.areas}</p>
              <p className="text-sm text-muted-foreground">Areas</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg">
                {summary.countries.map(c => `${getCountryFlag(c)} ${c}`).join(", ") || "No data"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList className="mb-4">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {selectedCities.size} selected
            </span>
            <Button
              size="sm"
              onClick={() => approveMutation.mutate(Array.from(selectedCities))}
              disabled={selectedCities.size === 0 || approveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => rejectMutation.mutate(Array.from(selectedCities))}
              disabled={selectedCities.size === 0 || rejectMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Reject Selected
            </Button>
          </div>

          {/* Cities Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-20">Country</TableHead>
                  <TableHead>City Name</TableHead>
                  <TableHead className="w-28"># Districts</TableHead>
                  <TableHead className="w-28"># Areas</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : stagingData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No staging data available. Use "Fetch & Preview" on the Dashboard to import data.
                    </TableCell>
                  </TableRow>
                ) : (
                  stagingData?.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCities.has(city.id)}
                          onCheckedChange={() => toggleCitySelection(city.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-lg mr-1">{getCountryFlag(city.country_code)}</span>
                        <span className="text-muted-foreground">{city.country_code}</span>
                      </TableCell>
                      <TableCell className="font-medium">{city.name}</TableCell>
                      <TableCell>{city.navio_staging_districts?.length ?? 0}</TableCell>
                      <TableCell>
                        {city.navio_staging_districts?.reduce(
                          (acc, d) => acc + (d.navio_staging_areas?.length ?? 0),
                          0
                        ) ?? 0}
                      </TableCell>
                      <TableCell>{getStatusBadge(city.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : stagingData?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No staging data available.
                </p>
              ) : (
                <div className="space-y-1 font-mono text-sm">
                  {stagingData?.map((city) => (
                    <div key={city.id}>
                      <button
                        onClick={() => toggleCityExpand(city.id)}
                        className="flex items-center gap-1 hover:bg-muted px-2 py-1 rounded w-full text-left"
                      >
                        {expandedCities.has(city.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="mr-1">{getCountryFlag(city.country_code)}</span>
                        <span className="font-semibold">{city.name}</span>
                        <span className="text-muted-foreground ml-1">({city.country_code})</span>
                        {getStatusBadge(city.status)}
                      </button>
                      
                      {expandedCities.has(city.id) && (
                        <div className="ml-6 border-l pl-4">
                          {city.navio_staging_districts?.map((district) => (
                            <div key={district.id}>
                              <button
                                onClick={() => toggleDistrictExpand(district.id)}
                                className="flex items-center gap-1 hover:bg-muted px-2 py-1 rounded w-full text-left"
                              >
                                {expandedDistricts.has(district.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span>{district.name}</span>
                                <span className="text-muted-foreground text-xs ml-1">
                                  ({district.navio_staging_areas?.length ?? 0} areas)
                                </span>
                              </button>
                              
                              {expandedDistricts.has(district.id) && (
                                <div className="ml-6 border-l pl-4 py-1">
                                  {district.navio_staging_areas?.map((area) => (
                                    <div
                                      key={area.id}
                                      className="px-2 py-0.5 text-muted-foreground hover:bg-muted rounded"
                                    >
                                      └── {area.name}
                                      {area.name !== area.original_name && (
                                        <span className="text-xs ml-2 opacity-60">
                                          (from: {area.original_name})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Commit Button */}
      {approvedCount > 0 && currentBatchForCommit && (
        <div className="fixed bottom-6 right-6">
          <Button
            size="lg"
            onClick={() => commitMutation.mutate(currentBatchForCommit)}
            disabled={commitMutation.isPending}
          >
            {commitMutation.isPending ? (
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            Commit {approvedCount} Approved Cities to Database
          </Button>
        </div>
      )}

      <SyncProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        batchId={currentBatchId}
        operation="import"
        entities={["navio"]}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
        }}
      />
    </div>
  );
}
