import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { CityProgressData, CityData } from "@/components/sync/NavioCityProgress";
import type { DeltaCheckResult } from "@/components/sync/DeltaSummary";

const STORAGE_KEY = "navio_import_batch";
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1500;

interface StoredBatch {
  batchId: string;
  cities: Array<{ name: string; countryCode: string }>;
  startedAt: string;
}

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Failed to send a request") ||
    msg.includes("Failed to fetch") ||
    msg.includes("network") ||
    msg.includes("CORS") ||
    msg.includes("timeout") ||
    msg.includes("5") && msg.includes("00") // 500, 502, 503, 504
  );
}

async function invokeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  onRetry?: (attempt: number, maxAttempts: number) => void
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.log(`Retry ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`);
      
      onRetry?.(attempt, maxRetries);
      
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError;
}

export function useNavioImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const abortRef = useRef(false);
  
  const [cityProgress, setCityProgress] = useState<CityProgressData>({
    phase: "idle",
    currentCity: null,
    citiesTotal: 0,
    citiesProcessed: 0,
    cities: [],
  });
  
  const [savedBatch, setSavedBatch] = useState<StoredBatch | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const clearSavedBatch = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedBatch(null);
  }, []);

  const resetProgress = useCallback(() => {
    abortRef.current = false;
    setCityProgress({
      phase: "idle",
      currentCity: null,
      citiesTotal: 0,
      citiesProcessed: 0,
      cities: [],
    });
  }, []);

  const cancelImport = useCallback(() => {
    abortRef.current = true;
    setCityProgress(prev => ({
      ...prev,
      phase: "error",
      errorMessage: "Import cancelled by user",
    }));
  }, []);

  // Process cities loop with retry logic
  const processAllCities = useCallback(async (
    batchId: string,
    cities: Array<{ name: string; countryCode: string }>
  ) => {
    let processedCount = 0;
    let completed = false;

    while (!completed && !abortRef.current) {
      const result = await invokeWithRetry(
        async () => {
          const response = await supabase.functions.invoke("navio-import", {
            body: { batch_id: batchId, mode: "process_city" },
          });
          
          if (response.error) throw response.error;
          if (response.data?.error) throw new Error(response.data.error);
          
          return response.data;
        },
        MAX_RETRIES,
        (attempt, max) => {
          setCityProgress(prev => ({
            ...prev,
            phase: "processing",
            retryAttempt: attempt,
            retryMax: max,
          }));
        }
      );

      // Clear retry state on success
      setCityProgress(prev => ({
        ...prev,
        retryAttempt: undefined,
        retryMax: undefined,
      }));

      const { 
        processedCity, 
        needsMoreProcessing, 
        stage,
        districtProgress,
        districtsDiscovered, 
        neighborhoodsDiscovered 
      } = result;

      if (needsMoreProcessing) {
        // Still working on current city - update district progress
        setCityProgress(prev => ({
          ...prev,
          currentDistrictsProcessed: districtProgress?.processed || 0,
          currentDistrictsTotal: districtProgress?.total || 0,
          currentDistrictName: districtProgress?.currentDistrict,
          currentNeighborhoodsFound: neighborhoodsDiscovered || 0,
          stage,
        }));
      } else if (processedCity) {
        // City fully completed
        processedCount++;
        
        const nextCityIndex = processedCount;
        const nextCity = cities[nextCityIndex]?.name || null;
        
        setCityProgress(prev => ({
          ...prev,
          currentCity: nextCity,
          citiesProcessed: processedCount,
          cities: prev.cities.map((c, idx) => 
            idx === processedCount - 1 
              ? { 
                  ...c, 
                  status: "completed" as const,
                  districtsFound: districtsDiscovered || 0,
                  neighborhoodsFound: neighborhoodsDiscovered || 0,
                }
              : c
          ),
          currentDistrictsProcessed: 0,
          currentDistrictsTotal: 0,
          currentNeighborhoodsFound: 0,
          currentDistrictName: undefined,
          stage,
        }));
      }

      completed = result.completed;
    }

    return { completed, aborted: abortRef.current };
  }, []);

  const navioIncrementalImport = useMutation({
    mutationFn: async ({ batchId, resume = false }: { batchId: string; resume?: boolean }) => {
      abortRef.current = false;
      let cities: Array<{ name: string; countryCode: string }> = [];
      let totalCities = 0;

      if (resume && savedBatch) {
        // Resume from saved batch
        cities = savedBatch.cities;
        totalCities = cities.length;
        
        // Get current progress from database
        const { data: queue } = await supabase
          .from("navio_import_queue")
          .select("city_name, country_code, status, districts_discovered, neighborhoods_discovered")
          .eq("batch_id", batchId);
        
        const completedCount = queue?.filter(q => q.status === "completed").length || 0;
        
        const initialCities: CityData[] = cities.map((c, idx) => {
          const queueEntry = queue?.find(q => q.city_name === c.name);
          return {
            name: c.name,
            countryCode: c.countryCode,
            status: queueEntry?.status === "completed" ? "completed" as const : 
                   queueEntry?.status === "processing" ? "processing" as const : "pending" as const,
            districtsFound: queueEntry?.districts_discovered || 0,
            neighborhoodsFound: queueEntry?.neighborhoods_discovered || 0,
          };
        });

        const processingCity = queue?.find(q => q.status === "processing");
        
        setCityProgress({
          phase: "processing",
          currentCity: processingCity?.city_name || cities[completedCount]?.name || null,
          citiesTotal: totalCities,
          citiesProcessed: completedCount,
          cities: initialCities,
          currentDistrictsTotal: 0,
          currentDistrictsProcessed: 0,
          currentNeighborhoodsFound: 0,
        });
      } else {
        // Fresh start - initialize
        setCityProgress({
          phase: "initializing",
          currentCity: null,
          citiesTotal: 0,
          citiesProcessed: 0,
          cities: [],
        });

        const initResult = await invokeWithRetry(
          async () => {
            const response = await supabase.functions.invoke("navio-import", {
              body: { batch_id: batchId, mode: "initialize" },
            });
            
            if (response.error) throw response.error;
            if (response.data?.error) throw new Error(response.data.error);
            
            return response.data;
          },
          MAX_RETRIES
        );

        cities = initResult.cities;
        totalCities = initResult.totalCities;
        
        if (totalCities === 0) {
          setCityProgress(prev => ({ ...prev, phase: "complete" }));
          clearSavedBatch();
          return { success: true, staged: { cities: 0, districts: 0, areas: 0 } };
        }

        // Save batch to localStorage for resume capability
        const batchData: StoredBatch = {
          batchId,
          cities,
          startedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(batchData));
        setSavedBatch(batchData);

        const initialCities: CityData[] = cities.map((c: { name: string; countryCode: string }) => ({
          name: c.name,
          countryCode: c.countryCode,
          status: "pending" as const,
        }));

        setCityProgress({
          phase: "processing",
          currentCity: cities[0]?.name || null,
          citiesTotal: totalCities,
          citiesProcessed: 0,
          cities: initialCities,
          currentDistrictsTotal: 0,
          currentDistrictsProcessed: 0,
          currentNeighborhoodsFound: 0,
        });
      }

      // Process all cities
      const { completed, aborted } = await processAllCities(batchId, cities);

      if (aborted) {
        throw new Error("Import cancelled");
      }

      // Finalize
      setCityProgress(prev => ({ 
        ...prev, 
        phase: "finalizing", 
        currentCity: null 
      }));

      const finalResult = await invokeWithRetry(
        async () => {
          const response = await supabase.functions.invoke("navio-import", {
            body: { batch_id: batchId, mode: "finalize" },
          });
          
          if (response.error) throw response.error;
          if (response.data?.error) throw new Error(response.data.error);
          
          return response.data;
        },
        MAX_RETRIES
      );

      setCityProgress(prev => ({ ...prev, phase: "complete" }));
      clearSavedBatch();

      return { 
        success: true, 
        staged: finalResult.staged 
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Preview Ready",
        description: `Staged ${data.staged?.cities || 0} cities, ${data.staged?.districts || 0} districts, ${data.staged?.areas || 0} areas for review.`,
      });
      
      setTimeout(() => {
        navigate("/navio-preview");
      }, 1500);
    },
    onError: (error: Error) => {
      // Don't clear batch on error - allow resume
      setCityProgress(prev => ({ 
        ...prev, 
        phase: "error",
        errorMessage: error.message,
        retryAttempt: undefined,
        retryMax: undefined,
      }));
      
      if (error.message !== "Import cancelled") {
        toast({
          title: "Navio Import Failed",
          description: `${error.message}. You can try to resume the import.`,
          variant: "destructive",
        });
      }
    },
  });

  // Resume import function
  const resumeImport = useCallback(() => {
    if (savedBatch) {
      navioIncrementalImport.mutate({ batchId: savedBatch.batchId, resume: true });
    }
  }, [savedBatch, navioIncrementalImport]);

  // Start fresh import
  const startFreshImport = useCallback(() => {
    clearSavedBatch();
    resetProgress();
    const newBatchId = crypto.randomUUID();
    navioIncrementalImport.mutate({ batchId: newBatchId, resume: false });
  }, [clearSavedBatch, resetProgress, navioIncrementalImport]);

  // Delta check mutation
  const deltaCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("navio-import", {
        body: { mode: "delta_check" },
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data as DeltaCheckResult;
    },
    onError: (error: Error) => {
      toast({
        title: "Delta Check Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start import with delta awareness
  const startDeltaImport = useCallback(() => {
    clearSavedBatch();
    resetProgress();
    const newBatchId = crypto.randomUUID();
    navioIncrementalImport.mutate({ batchId: newBatchId, resume: false });
  }, [clearSavedBatch, resetProgress, navioIncrementalImport]);

  // Geo-only sync mutation (no AI, just polygons)
  const queryClient = useQueryClient();
  
  const geoSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("navio-import", {
        body: { mode: "sync_geo", batch_id: crypto.randomUUID() },
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      // Force immediate refetch for always-visible pipeline status
      queryClient.refetchQueries({ queryKey: ["navio-pipeline-status"] });
      
      // Invalidate (mark stale) for tab-based queries - they'll refetch when visited
      queryClient.invalidateQueries({ queryKey: ["production-data"] });
      queryClient.invalidateQueries({ queryKey: ["production-geofences"] });
      
      const productionUpdated = data.result?.production_areas_updated || 0;
      const polygonsSynced = data.result?.polygons_synced || 0;
      
      toast({
        title: "Geo Sync Complete",
        description: `${productionUpdated.toLocaleString()} production areas updated, ${polygonsSynced} polygons synced`,
      });
    },
    onError: (error: Error) => {
      // Also invalidate on error to reset UI state
      queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
      
      toast({
        title: "Geo Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    cityProgress,
    resetProgress,
    cancelImport,
    navioIncrementalImport,
    isImporting: navioIncrementalImport.isPending,
    // Resume functionality
    savedBatch,
    resumeImport,
    startFreshImport,
    clearSavedBatch,
    canResume: !!savedBatch && cityProgress.phase !== "processing",
    // Delta functionality
    deltaCheckMutation,
    deltaResult: deltaCheckMutation.data,
    isCheckingDelta: deltaCheckMutation.isPending,
    checkDelta: deltaCheckMutation.mutate,
    startDeltaImport,
    // Geo-only sync
    geoSyncMutation,
    isGeoSyncing: geoSyncMutation.isPending,
    startGeoSync: geoSyncMutation.mutate,
  };
}
