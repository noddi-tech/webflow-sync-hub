import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { CityProgressData } from "@/components/sync/NavioCityProgress";

export function useNavioImport() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [cityProgress, setCityProgress] = useState<CityProgressData>({
    phase: "idle",
    currentCity: null,
    citiesTotal: 0,
    citiesProcessed: 0,
    cities: [],
  });

  const resetProgress = useCallback(() => {
    setCityProgress({
      phase: "idle",
      currentCity: null,
      citiesTotal: 0,
      citiesProcessed: 0,
      cities: [],
    });
  }, []);

  const navioIncrementalImport = useMutation({
    mutationFn: async ({ batchId }: { batchId: string }) => {
      // Phase 1: Initialize
      setCityProgress({
        phase: "initializing",
        currentCity: null,
        citiesTotal: 0,
        citiesProcessed: 0,
        cities: [],
      });

      const initResult = await supabase.functions.invoke("navio-import", {
        body: { batch_id: batchId, mode: "initialize" },
      });

      if (initResult.error) throw initResult.error;
      if (initResult.data?.error) throw new Error(initResult.data.error);

      const { totalCities, cities } = initResult.data;
      
      if (totalCities === 0) {
        setCityProgress(prev => ({ ...prev, phase: "complete" }));
        return { success: true, staged: { cities: 0, districts: 0, areas: 0 } };
      }

      setCityProgress({
        phase: "processing",
        currentCity: cities[0]?.name || null,
        citiesTotal: totalCities,
        citiesProcessed: 0,
        cities: cities,
      });

      // Phase 2: Process cities one by one (with incremental district batching)
      let completed = false;
      let processedCount = 0;

      while (!completed) {
        const result = await supabase.functions.invoke("navio-import", {
          body: { batch_id: batchId, mode: "process_city" },
        });

        if (result.error) throw result.error;
        if (result.data?.error) throw new Error(result.data.error);

        // Check if a city just fully completed (not just partial progress)
        if (result.data.processedCity && !result.data.needsMoreProcessing) {
          processedCount++;
          
          // Find next city to process
          const nextCityIndex = processedCount;
          const nextCity = cities[nextCityIndex]?.name || null;
          
          setCityProgress(prev => ({
            ...prev,
            currentCity: nextCity,
            citiesProcessed: processedCount,
          }));
        }

        // If we're still processing the same city (needsMoreProcessing), 
        // just continue the loop without updating progress
        
        completed = result.data.completed;
      }

      // Phase 3: Finalize
      setCityProgress(prev => ({ 
        ...prev, 
        phase: "finalizing", 
        currentCity: null 
      }));

      const finalResult = await supabase.functions.invoke("navio-import", {
        body: { batch_id: batchId, mode: "finalize" },
      });

      if (finalResult.error) throw finalResult.error;
      if (finalResult.data?.error) throw new Error(finalResult.data.error);

      setCityProgress(prev => ({ ...prev, phase: "complete" }));

      return { 
        success: true, 
        staged: finalResult.data.staged 
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Preview Ready",
        description: `Staged ${data.staged?.cities || 0} cities, ${data.staged?.districts || 0} districts, ${data.staged?.areas || 0} areas for review.`,
      });
      
      // Navigate to preview page after a short delay
      setTimeout(() => {
        navigate("/navio-preview");
      }, 1500);
    },
    onError: (error: Error) => {
      setCityProgress(prev => ({ 
        ...prev, 
        phase: "error",
        errorMessage: error.message 
      }));
      
      toast({
        title: "Navio Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    cityProgress,
    resetProgress,
    navioIncrementalImport,
    isImporting: navioIncrementalImport.isPending,
  };
}
