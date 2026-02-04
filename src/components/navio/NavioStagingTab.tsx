import { useState, useCallback } from "react";
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
import { Check, X, Trash2, ChevronRight, ChevronDown, Globe, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { StagingActionBar } from "@/components/navio/StagingActionBar";
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

type StatusFilter = "all" | "pending" | "approved" | "committed";

export default function NavioStagingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  
  // Incremental commit state
  const [commitProgress, setCommitProgress] = useState<{
    current: number;
    total: number;
    currentCityName?: string;
    retryAttempt?: number;
    retryMax?: number;
  } | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Retry helper for transient network errors
  const isRetryableError = (error: unknown): boolean => {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes("Failed to fetch") ||
      msg.includes("Failed to send") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("504") ||
      msg.includes("502") ||
      msg.includes("503")
    );
  };

  const invokeWithRetry = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelayMs: number = 1500,
    onRetry?: (attempt: number, max: number) => void
  ): Promise<T> => {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`Retry ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`);
        onRetry?.(attempt, maxRetries);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    throw lastError;
  };

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

  // Fetch staging data with hierarchy - include all statuses for filtering
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
        .order("name");
      
      if (selectedBatch !== "all") {
        query = query.eq("batch_id", selectedBatch);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as StagingCity[];
    },
  });

  // Filter data based on status
  const filteredData = stagingData?.filter(city => {
    if (statusFilter === "all") return true;
    return city.status === statusFilter;
  }) || [];

  // Calculate summary stats per status
  const statusCounts = {
    all: stagingData?.length ?? 0,
    pending: stagingData?.filter(c => c.status === "pending").length ?? 0,
    approved: stagingData?.filter(c => c.status === "approved").length ?? 0,
    committed: stagingData?.filter(c => c.status === "committed").length ?? 0,
  };

  // Calculate summary stats for current view
  const summary = {
    cities: filteredData.length,
    districts: filteredData.reduce((acc, city) => acc + (city.navio_staging_districts?.length ?? 0), 0),
    areas: filteredData.reduce((acc, city) => 
      acc + (city.navio_staging_districts?.reduce((d, district) => 
        d + (district.navio_staging_areas?.length ?? 0), 0) ?? 0), 0),
    countries: [...new Set(filteredData.map(c => c.country_code))],
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (cityIds: string[]) => {
      const { error: citiesError } = await supabase
        .from("navio_staging_cities")
        .update({ status: "approved" })
        .in("id", cityIds);
      
      if (citiesError) throw citiesError;

      const { error: districtsError } = await supabase
        .from("navio_staging_districts")
        .update({ status: "approved" })
        .in("staging_city_id", cityIds);
      
      if (districtsError) throw districtsError;

      const { data: districts } = await supabase
        .from("navio_staging_districts")
        .select("id")
        .in("staging_city_id", cityIds);
      
      if (districts && districts.length > 0) {
        const districtIds = districts.map(d => d.id);
        
        const { error: areasError } = await supabase
          .from("navio_staging_areas")
          .update({ status: "approved" })
          .in("staging_district_id", districtIds);
        
        if (areasError) throw areasError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
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
      const { data: districts } = await supabase
        .from("navio_staging_districts")
        .select("id")
        .in("staging_city_id", cityIds);
      
      if (districts && districts.length > 0) {
        const districtIds = districts.map(d => d.id);
        await supabase
          .from("navio_staging_areas")
          .delete()
          .in("staging_district_id", districtIds);
      }

      await supabase
        .from("navio_staging_districts")
        .delete()
        .in("staging_city_id", cityIds);

      const { error } = await supabase
        .from("navio_staging_cities")
        .delete()
        .in("id", cityIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
      queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
      queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
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

  // Clear batch mutation
  const clearBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: cities } = await supabase
        .from("navio_staging_cities")
        .select("id")
        .eq("batch_id", batchId);
      
      if (!cities?.length) return;
      
      const cityIds = cities.map(c => c.id);
      
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
      queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
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
    setSelectedCities(new Set(filteredData.map(c => c.id)));
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
      CA: "🇨🇦",
      XX: "🏳️",
    };
    return flags[code] || "🏳️";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
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
                <p>This is an internal logistics code that requires manual mapping.</p>
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

  // Incremental commit
  const commitIncrementally = useCallback(async (batchId: string) => {
    setIsCommitting(true);
    setCommitProgress({ current: 0, total: approvedCount });
    
    let completed = false;
    let citiesCommitted = 0;
    let totalRemaining = approvedCount;
    
    while (!completed) {
      try {
        const response = await invokeWithRetry(
          async () => {
            const res = await supabase.functions.invoke("navio-import", {
              body: { batch_id: batchId, mode: "commit_city" },
            });
            if (res.error) throw res.error;
            if (res.data?.error) throw new Error(res.data.error);
            return res;
          },
          5,
          1500,
          (attempt, max) => {
            setCommitProgress(prev => prev ? {
              ...prev,
              retryAttempt: attempt,
              retryMax: max,
            } : null);
          }
        );
        
        const { data } = response;
        
        completed = data.completed;
        citiesCommitted++;
        totalRemaining = data.remaining ?? (approvedCount - citiesCommitted);
        
        setCommitProgress({
          current: citiesCommitted,
          total: citiesCommitted + totalRemaining,
          currentCityName: data.committedCity,
        });
        
      } catch (error) {
        setCommitProgress(null);
        setIsCommitting(false);
        
        queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
        
        toast({
          title: citiesCommitted > 0 
            ? `Commit paused after ${citiesCommitted} cities` 
            : "Commit Failed",
          description: citiesCommitted > 0
            ? `Click 'Commit' again to continue with ${totalRemaining} remaining cities.`
            : (error instanceof Error ? error.message : "Unknown error"),
          variant: citiesCommitted > 0 ? "default" : "destructive",
        });
        return;
      }
    }
    
    setCommitProgress(null);
    setIsCommitting(false);
    queryClient.invalidateQueries({ queryKey: ["navio-staging-data"] });
    queryClient.invalidateQueries({ queryKey: ["navio-staging-batches"] });
    queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
    queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
    
    toast({
      title: "Commit Complete",
      description: `Successfully committed ${citiesCommitted} cities to production database.`,
    });
  }, [approvedCount, queryClient, toast]);

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["all", "pending", "approved", "committed"] as StatusFilter[]).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status === "all" ? "All" : status}
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                {statusCounts[status]}
              </Badge>
            </Button>
          ))}
        </div>

        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="w-[200px]">
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

      {/* Summary Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-8 text-center">
            <div>
              <p className="text-2xl font-bold">{summary.cities}</p>
              <p className="text-xs text-muted-foreground">Cities</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{summary.districts}</p>
              <p className="text-xs text-muted-foreground">Districts</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{summary.areas}</p>
              <p className="text-xs text-muted-foreground">Areas</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {summary.countries.map(c => `${getCountryFlag(c)} ${c}`).join(", ") || "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-4">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
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
              Approve
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => rejectMutation.mutate(Array.from(selectedCities))}
              disabled={selectedCities.size === 0 || rejectMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
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
                  <TableHead className="w-24"># Districts</TableHead>
                  <TableHead className="w-24"># Areas</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32">Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {statusFilter === "all" 
                        ? "No staging data available. Run an AI Import to discover areas."
                        : `No ${statusFilter} cities found.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCities.has(city.id)}
                          onCheckedChange={() => toggleCitySelection(city.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-lg mr-1">{getCountryFlag(city.country_code)}</span>
                        <span className="text-muted-foreground text-xs">{city.country_code}</span>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(city.created_at).toLocaleDateString()}
                      </TableCell>
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
              <CardTitle className="text-base">Geographic Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : filteredData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No data to display.
                </p>
              ) : (
                <div className="space-y-1 font-mono text-sm max-h-[500px] overflow-auto">
                  {filteredData.map((city) => (
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
                        <span className="ml-2">{getStatusBadge(city.status)}</span>
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

      {/* Floating Action Bar */}
      <StagingActionBar
        selectedCount={selectedCities.size}
        approvedCount={approvedCount}
        onApprove={() => approveMutation.mutate(Array.from(selectedCities))}
        onReject={() => rejectMutation.mutate(Array.from(selectedCities))}
        onCommit={() => currentBatchForCommit && commitIncrementally(currentBatchForCommit)}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
        isCommitting={isCommitting}
        commitProgress={commitProgress}
      />
    </div>
  );
}
